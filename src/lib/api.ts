// API configuration for the FastAPI backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface ChatResponse {
  response: string;
  sources: string[];
}

export interface UploadResponse {
  message: string;
  filename: string;
}

export const api = {
  async uploadPdf(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload_pdf`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to upload PDF');
    }

    return response.json();
  },

  async listPdfs(): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/list_pdfs`);

    if (!response.ok) {
      throw new Error('Failed to fetch PDFs');
    }

    return response.json();
  },

  async removePdf(filename: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/remove_pdf/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to remove PDF');
    }

    return response.json();
  },

  async chat(query: string): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get response');
    }

    return response.json();
  },
};
