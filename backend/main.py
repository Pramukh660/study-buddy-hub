# main.py - FastAPI Backend for Exam Revision Chatbot with User Authentication

import os
from dotenv import load_dotenv
import shutil
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Dict, Optional, Any
import uuid
import json
from datetime import datetime, timedelta

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header
from pydantic import BaseModel

from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_huggingface import HuggingFaceEmbeddings
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

# ==================== PYDANTIC MODELS ====================
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    username: str
    message: str

# ==================== GLOBAL STATE ====================
# Users: {username: {password, created_at}}
users_db: Dict[str, Dict] = {}

# Active sessions: {token: {username, created_at, expires_at}}
sessions_db: Dict[str, Dict] = {}

# User vector stores: {username: vectorstore}
user_vectorstores: Dict[str, Optional[FAISS]] = {}

# User retrievers: {username: retriever}
user_retrievers: Dict[str, Optional[Any]] = {}

# User QA chains: {username: qa_chain}
user_qa_chains: Dict[str, Optional[Any]] = {}


# ==================== CONFIGURATION ====================
PDF_DIRECTORY = "./pdf_documents"
VECTOR_DB_PATH = "./vector_db"
USERS_DB_FILE = "./users_db.json"
SESSION_TIMEOUT_MINUTES = 480  # 8 hours

load_dotenv()
# Open Router API Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE")
if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY environment variable not set")

EMBED_MODEL = "all-MiniLM-L6-v2"  # Free, open-source embedding model
LLM_MODEL = "meta-llama/llama-3.2-1b-instruct"  # Using Open Router

# Ensure directories exist
os.makedirs(PDF_DIRECTORY, exist_ok=True)
Path(VECTOR_DB_PATH).mkdir(exist_ok=True)


# ==================== MODELS ====================
embedding_model = HuggingFaceEmbeddings(model_name=EMBED_MODEL)

llm = ChatOpenAI(
    model=LLM_MODEL,
    temperature=0,
    api_key=OPENROUTER_API_KEY,
    base_url=OPENAI_API_BASE
)

# ==================== AUTH HELPER FUNCTIONS ====================
def load_users_from_disk():
    global users_db
    if os.path.exists(USERS_DB_FILE):
        try:
            with open(USERS_DB_FILE, 'r') as f:
                users_db = json.load(f)
            logger.info(f"Loaded {len(users_db)} users from disk")
        except Exception as e:
            logger.error(f"Failed to load users database: {str(e)}")
            users_db = {}
    else:
        users_db = {}


def save_users_to_disk():
    try:
        with open(USERS_DB_FILE, 'w') as f:
            json.dump(users_db, f)
        logger.info("Users database saved to disk")
    except Exception as e:
        logger.error(f"Failed to save users database: {str(e)}")


def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """Dependency to extract and validate user from token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization[7:]  # Remove "Bearer " prefix
    if token not in sessions_db:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    session = sessions_db[token]
    
    # Check if session expired
    if datetime.fromisoformat(session["expires_at"]) < datetime.now():
        del sessions_db[token]
        raise HTTPException(status_code=401, detail="Session expired")
    
    return session["username"]


def get_user_vector_db_path(username: str) -> str:
    """Get the vector DB path for a specific user"""
    user_path = os.path.join(VECTOR_DB_PATH, username)
    Path(user_path).mkdir(exist_ok=True)
    return user_path


def get_user_pdf_directory(username: str) -> str:
    """Get the PDF directory for a specific user"""
    user_path = os.path.join(PDF_DIRECTORY, username)
    os.makedirs(user_path, exist_ok=True)
    return user_path
def add_document_to_vectorstore(username: str, pdf_path: str, filename: str):
    """Add document to user-specific vectorstore"""
    global user_vectorstores, user_retrievers, user_qa_chains

    logger.info(f"Starting indexing for user '{username}', PDF: {filename} (path: {pdf_path})")

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
            if "page" in doc.metadata:
                logger.debug(f"Page {doc.metadata['page'] + 1}: {doc.page_content[:200]}...")

        logger.info(f"Added metadata to {len(docs)} document pages")

        # Split into chunks
        splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=300)
        chunks = splitter.split_documents(docs)

        logger.info(f"Split into {len(chunks)} chunks")

        if len(chunks) == 0:
            logger.warning(f"No chunks created from '{filename}'.")
            return

        # Create or update user-specific vectorstore
        user_db_path = get_user_vector_db_path(username)
        
        if username not in user_vectorstores or user_vectorstores[username] is None:
            logger.info(f"Creating new FAISS vectorstore for user '{username}'")
            user_vectorstores[username] = FAISS.from_documents(chunks, embedding_model)
            logger.info(f"New vectorstore created with {len(chunks)} vectors")
        else:
            old_count = user_vectorstores[username].index.ntotal if hasattr(user_vectorstores[username].index, 'ntotal') else "unknown"
            logger.info(f"Adding {len(chunks)} chunks to user's vectorstore (previous: {old_count})")
            user_vectorstores[username].add_documents(chunks)
            new_count = user_vectorstores[username].index.ntotal if hasattr(user_vectorstores[username].index, 'ntotal') else "unknown"
            logger.info(f"New total vectors: {new_count}")

        # Update retriever and QA chain for this user
        _update_user_retriever_and_chain(username)
        logger.info(f"Retriever and QA chain updated for user '{username}'")

        # Persist to disk
        user_vectorstores[username].save_local(user_db_path)
        logger.info(f"Vector database saved to {user_db_path}")

        logger.info(f"Successfully indexed '{filename}' for user '{username}'")

    except Exception as e:
        logger.error(f"Failed to index '{filename}' for user '{username}': {str(e)}", exc_info=True)
        raise


def remove_document_from_vectorstore(username: str, filename: str):
    """Remove document from user-specific vectorstore"""
    global user_vectorstores, user_retrievers, user_qa_chains

    logger.info(f"Starting removal of document '{filename}' for user '{username}'")

    if username not in user_vectorstores or user_vectorstores[username] is None:
        logger.warning(f"Vectorstore is None for user '{username}'")
        return

    try:
        vectorstore = user_vectorstores[username]
        
        # Find all internal document IDs where metadata["document_id"] == filename
        ids_to_delete = [
            doc_id for doc_id, doc in vectorstore.docstore._dict.items()
            if doc.metadata.get("document_id") == filename
        ]

        logger.info(f"Found {len(ids_to_delete)} chunks to delete for document '{filename}'")

        if not ids_to_delete:
            logger.warning(f"No chunks found with document_id='{filename}'")
            return

        # Perform deletion
        old_count = vectorstore.index.ntotal
        vectorstore.delete(ids_to_delete)
        new_count = vectorstore.index.ntotal

        logger.info(f"Deleted {len(ids_to_delete)} vectors. Count: {old_count} → {new_count}")

        # Update retriever and chain
        _update_user_retriever_and_chain(username)
        logger.info(f"Retriever and QA chain updated for user '{username}'")

        # Save updated vectorstore
        user_db_path = get_user_vector_db_path(username)
        vectorstore.save_local(user_db_path)
        logger.info(f"Vector database updated and saved for user '{username}'")

        logger.info(f"Successfully removed '{filename}' for user '{username}'")

    except Exception as e:
        logger.error(f"Failed to remove '{filename}' for user '{username}': {str(e)}", exc_info=True)
        raise


def _update_user_retriever_and_chain(username: str):
    """Update retriever and chain for a specific user"""
    global user_retrievers, user_qa_chains
    
    if username in user_vectorstores and user_vectorstores[username] is not None:
        user_retrievers[username] = user_vectorstores[username].as_retriever(
            search_type="mmr",
            search_kwargs={"k": 6, "fetch_k": 20, "lambda_mult": 0.7}
        )
        user_qa_chains[username] = RetrievalQA.from_chain_type(
            llm=llm,
            retriever=user_retrievers[username],
            chain_type="stuff",
            return_source_documents=True
        )


# ==================== LIFESPAN ====================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load users and existing vector databases
    global user_vectorstores, user_retrievers, user_qa_chains

    load_users_from_disk()

    # Load vector databases for each user if they exist
    for username in users_db.keys():
        user_db_path = get_user_vector_db_path(username)
        if os.path.exists(user_db_path) and os.listdir(user_db_path):
            try:
                user_vectorstores[username] = FAISS.load_local(
                    folder_path=user_db_path,
                    embeddings=embedding_model,
                    allow_dangerous_deserialization=True
                )
                _update_user_retriever_and_chain(username)
                logger.info(f"Vector database loaded for user '{username}'")
            except Exception as e:
                logger.error(f"Failed to load vector database for user '{username}': {str(e)}")
                user_vectorstores[username] = None

    print("Application startup complete. User data loaded.")

    yield  # App runs here

    # Shutdown
    save_users_to_disk()
    print("Application shutdown. User data saved.")


# ==================== FASTAPI APP ====================
app = FastAPI(
    title="Exam Revision Chatbot",
    description="Upload PDFs and chat with your study materials - with user authentication",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Allow all (DEV ONLY)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== ENDPOINTS ====================

@app.post("/register", response_model=LoginResponse)
async def register(request: LoginRequest):
    """Register a new user"""
    username = request.username.strip()
    password = request.password.strip()
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required")
    
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    
    # Check if user already exists
    if username in users_db:
        raise HTTPException(status_code=400, detail="Username already exists. Please login or choose a different username.")
    
    # Create new user
    users_db[username] = {
        "password": password,
        "created_at": datetime.now().isoformat()
    }
    user_vectorstores[username] = None
    user_retrievers[username] = None
    user_qa_chains[username] = None
    save_users_to_disk()
    logger.info(f"New user '{username}' registered")
    
    # Create session token
    token = str(uuid.uuid4())
    expires_at = datetime.now() + timedelta(minutes=SESSION_TIMEOUT_MINUTES)
    sessions_db[token] = {
        "username": username,
        "created_at": datetime.now().isoformat(),
        "expires_at": expires_at.isoformat()
    }
    
    return LoginResponse(
        access_token=token,
        username=username,
        message=f"Welcome, {username}! Your account has been created."
    )


@app.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Login an existing user"""
    username = request.username.strip()
    password = request.password.strip()
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required")
    
    # Check if user exists
    if username not in users_db:
        raise HTTPException(status_code=401, detail="Username not found. Please register first.")
    
    # Verify password
    if users_db[username]["password"] != password:
        raise HTTPException(status_code=401, detail="Invalid password")
    
    logger.info(f"User '{username}' logged in")
    
    # Create session token
    token = str(uuid.uuid4())
    expires_at = datetime.now() + timedelta(minutes=SESSION_TIMEOUT_MINUTES)
    sessions_db[token] = {
        "username": username,
        "created_at": datetime.now().isoformat(),
        "expires_at": expires_at.isoformat()
    }
    
    return LoginResponse(
        access_token=token,
        username=username,
        message=f"Welcome back, {username}!"
    )


@app.post("/logout")
async def logout(current_user: str = Depends(get_current_user)):
    """Logout the current user (invalidate token)"""
    # Find and remove the token for this user
    tokens_to_remove = [token for token, session in sessions_db.items() if session["username"] == current_user]
    for token in tokens_to_remove:
        del sessions_db[token]
    
    logger.info(f"User '{current_user}' logged out")
    return {"message": f"Goodbye {current_user}!"}


@app.post("/upload_pdf")
async def upload_pdf(file: UploadFile = File(...), current_user: str = Depends(get_current_user)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    filename = file.filename
    user_pdf_dir = get_user_pdf_directory(current_user)
    file_path = os.path.join(user_pdf_dir, filename)

    if os.path.exists(file_path):
        raise HTTPException(
            status_code=400,
            detail=f"File '{filename}' already exists. Delete it first or upload with a different name."
        )

    # Save the file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        add_document_to_vectorstore(current_user, file_path, filename)
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
async def remove_pdf(filename: str, current_user: str = Depends(get_current_user)):
    user_pdf_dir = get_user_pdf_directory(current_user)
    file_path = os.path.join(user_pdf_dir, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="PDF not found")

    logger.info(f"Delete request from user '{current_user}' for: {filename}")

    # Remove from vectorstore first
    remove_document_from_vectorstore(current_user, filename)

    # Then remove physical file
    os.remove(file_path)
    logger.info(f"Physical file deleted: {file_path}")

    return {"message": f"PDF '{filename}' removed successfully."}


@app.get("/list_pdfs", response_model=List[str])
async def list_pdfs(current_user: str = Depends(get_current_user)):
    user_pdf_dir = get_user_pdf_directory(current_user)
    pdfs = [f for f in os.listdir(user_pdf_dir) if f.lower().endswith(".pdf")]
    return sorted(pdfs)


@app.post("/chat")
async def chat(query: dict, current_user: str = Depends(get_current_user)):
    qa_chain = user_qa_chains.get(current_user)
    
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
    uvicorn.run("main:app", host="0.0.0.0", port=8000)