# main.py - FastAPI Backend for Exam Revision Chatbot (NO AUTHENTICATION)

import os
from dotenv import load_dotenv
import shutil
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List

from fastapi import FastAPI, UploadFile, File, HTTPException

from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain_classic.chains import RetrievalQA
from fastapi.middleware.cors import CORSMiddleware

import logging

# Configure logging at the top of your file (after imports)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()  # Prints to console
        # logging.FileHandler("app.log")  # Uncomment to also save to file
    ]
)

logger = logging.getLogger(__name__)

# ==================== GLOBAL STATE ====================
vectorstore = None
retriever = None
qa_chain = None


# ==================== CONFIGURATION ====================
PDF_DIRECTORY = "./pdf_documents"
VECTOR_DB_PATH = "./vector_db"

load_dotenv()
# Open Router API Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE")
if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY environment variable not set")

EMBED_MODEL = "text-embedding-3-small"  # OpenAI embedding model
LLM_MODEL = "meta-llama/llama-3.2-1b-instruct"  # Using Open Router

# Ensure directories exist
os.makedirs(PDF_DIRECTORY, exist_ok=True)
Path(VECTOR_DB_PATH).mkdir(exist_ok=True)


# ==================== MODELS ====================
embedding_model = OpenAIEmbeddings(
    model=EMBED_MODEL,
    api_key=OPENROUTER_API_KEY
)

llm = ChatOpenAI(
    model=LLM_MODEL,
    temperature=0,
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1"
)


# ==================== HELPER FUNCTIONS ====================
def add_document_to_vectorstore(pdf_path: str, filename: str):
    global vectorstore, retriever, qa_chain

    logger.info(f"Starting indexing for PDF: {filename} (path: {pdf_path})")

    try:
        # Load PDF
        loader = PyMuPDFLoader(pdf_path)
        docs = loader.load()

        logger.info(f"Successfully loaded PDF with {len(docs)} pages")

        if len(docs) == 0:
            logger.warning(f"PDF '{filename}' has no extractable text pages. Skipping indexing.")
            return

        # Add metadata
        for i, doc in enumerate(docs):
            doc.metadata["source"] = filename
            doc.metadata["document_id"] = filename
            # Optional: add page number
            if "page" in doc.metadata:
                logger.debug(f"Page {doc.metadata['page'] + 1}: {doc.page_content[:200]}...")

        logger.info(f"Added metadata (source & document_id) to {len(docs)} document pages")

        # Split into chunks
        splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=300)
        chunks = splitter.split_documents(docs)

        logger.info(f"Split into {len(chunks)} chunks (chunk_size=f{splitter._chunk_size}, overlap=f{splitter._chunk_overlap})")

        if len(chunks) == 0:
            logger.warning(f"No chunks created from '{filename}'. Possible empty or unreadable content.")
            return

        # Create or update vectorstore
        if vectorstore is None:
            logger.info("Creating new FAISS vectorstore from scratch")
            vectorstore = FAISS.from_documents(chunks, embedding_model)
            logger.info(f"New vectorstore created with {len(chunks)} vectors")
        else:
            old_count = vectorstore.index.ntotal if hasattr(vectorstore.index, 'ntotal') else "unknown"
            logger.info(f"Adding {len(chunks)} chunks to existing vectorstore (previous: {old_count} vectors)")
            vectorstore.add_documents(chunks)
            new_count = vectorstore.index.ntotal if hasattr(vectorstore.index, 'ntotal') else "unknown"
            logger.info(f"Successfully added chunks. New total vectors: {new_count}")

        # Update retriever and QA chain
        _update_retriever_and_chain()
        logger.info("Retriever and QA chain updated")

        # Persist to disk
        vectorstore.save_local(VECTOR_DB_PATH)
        logger.info(f"Vector database saved to disk at {VECTOR_DB_PATH}")

        logger.info(f"Successfully indexed '{filename}'")

    except Exception as e:
        logger.error(f"Failed to index '{filename}': {str(e)}", exc_info=True)
        raise  # Re-raise so FastAPI can return 500


def remove_document_from_vectorstore(filename: str):
    global vectorstore, retriever, qa_chain

    logger.info(f"Starting removal of document: {filename} from vector database")

    if vectorstore is None:
        logger.warning("Vectorstore is None — nothing to remove.")
        return

    try:
        # Find all internal document IDs where metadata["document_id"] == filename
        ids_to_delete = [
            doc_id for doc_id, doc in vectorstore.docstore._dict.items()
            if doc.metadata.get("document_id") == filename
        ]

        logger.info(f"Found {len(ids_to_delete)} chunks to delete for document '{filename}'")

        if not ids_to_delete:
            logger.warning(f"No chunks found in vectorstore with document_id='{filename}'. "
                           "It may have already been removed or never indexed.")
            return

        # Perform the actual deletion
        old_count = vectorstore.index.ntotal
        vectorstore.delete(ids_to_delete)
        new_count = vectorstore.index.ntotal

        logger.info(f"Successfully deleted {len(ids_to_delete)} vectors. "
                    f"Vector count: {old_count} → {new_count}")

        # Update retriever and chain
        _update_retriever_and_chain()
        logger.info("Retriever and QA chain updated after deletion")

        # Save updated vectorstore to disk
        vectorstore.save_local(VECTOR_DB_PATH)
        logger.info(f"Vector database updated and saved to {VECTOR_DB_PATH}")

        logger.info(f"Successfully removed '{filename}' from vector database")

    except Exception as e:
        logger.error(f"Failed to remove '{filename}' from vectorstore: {str(e)}", exc_info=True)
        raise


def _update_retriever_and_chain():
    global retriever, qa_chain
    if vectorstore is not None:  # Only if there's data
        retriever = vectorstore.as_retriever(
            search_type="mmr",
            search_kwargs={"k": 6, "fetch_k": 20, "lambda_mult": 0.7}
        )
        qa_chain = RetrievalQA.from_chain_type(
            llm=llm,
            retriever=retriever,
            chain_type="stuff",
            return_source_documents=True
        )


# ==================== LIFESPAN ====================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load existing vector database if available
    global vectorstore, retriever, qa_chain

    if os.path.exists(VECTOR_DB_PATH) and os.listdir(VECTOR_DB_PATH):
        vectorstore = FAISS.load_local(
            folder_path=VECTOR_DB_PATH,
            embeddings=embedding_model,
            allow_dangerous_deserialization=True
        )
        _update_retriever_and_chain()
        print("Vector database loaded from disk.")
    else:
        print("No existing vector database found. Starting fresh.")

    yield  # App runs here

    # Shutdown
    print("Shutting down...")


# ==================== FASTAPI APP ====================
app = FastAPI(
    title="Exam Revision Chatbot",
    description="Upload PDFs and chat with your study materials",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # 👈 allow all (DEV ONLY)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== ENDPOINTS ====================

@app.post("/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    filename = file.filename
    file_path = os.path.join(PDF_DIRECTORY, filename)

    if os.path.exists(file_path):
        raise HTTPException(
            status_code=400,
            detail=f"File '{filename}' already exists. Delete it first or upload with a different name."
        )

    # Save the file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        add_document_to_vectorstore(file_path, filename)
        return {
            "message": f"PDF '{filename}' uploaded and indexed successfully.",
            "filename": filename
        }
    except Exception as e:
        # Cleanup on failure
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to index document: {str(e)}")


@app.delete("/remove_pdf/{filename}")
async def remove_pdf(filename: str):
    file_path = os.path.join(PDF_DIRECTORY, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="PDF not found")

    logger.info(f"Delete request received for: {filename}")

    # Remove from vectorstore first (with logs)
    remove_document_from_vectorstore(filename)

    # Then remove physical file
    os.remove(file_path)
    logger.info(f"Physical file deleted: {file_path}")

    return {"message": f"PDF '{filename}' removed successfully from storage and vector database."}


@app.get("/list_pdfs", response_model=List[str])
async def list_pdfs():
    pdfs = [f for f in os.listdir(PDF_DIRECTORY) if f.lower().endswith(".pdf")]
    return sorted(pdfs)


@app.post("/chat")
async def chat(query: dict):
    if not qa_chain:
        raise HTTPException(status_code=503, detail="No documents indexed yet. Please upload at least one PDF.")

    if "query" not in query or not query["query"].strip():
        raise HTTPException(status_code=400, detail="Missing or empty 'query' field.")

    result = qa_chain.invoke({"query": query["query"]})

    sources = list({
        doc.metadata.get("source", "Unknown") for doc in result["source_documents"]
    })

    return {
        "response": result["result"],
        "sources": sources
    }


# ==================== RUN ====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, workers=3)