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

export interface ConnectionStatus {
  connected: boolean;
  lastChecked: Date;
  error?: string;
}

let connectionStatus: ConnectionStatus = {
  connected: false,
  lastChecked: new Date(),
};

export const getConnectionStatus = () => connectionStatus;

const handleFetchError = (error: unknown, operation: string): never => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
    connectionStatus = {
      connected: false,
      lastChecked: new Date(),
      error: 'Backend server not reachable. Make sure your FastAPI server is running on ' + API_BASE_URL,
    };
    throw new Error(`Cannot connect to backend server. Please ensure your FastAPI server is running at ${API_BASE_URL}`);
  }
  
  throw new Error(`${operation}: ${errorMessage}`);
};

export const api = {
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/list_pdfs`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      connectionStatus = {
        connected: response.ok,
        lastChecked: new Date(),
      };
      
      return response.ok;
    } catch {
      connectionStatus = {
        connected: false,
        lastChecked: new Date(),
        error: 'Backend server not reachable',
      };
      return false;
    }
  },

  async uploadPdf(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload_pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to upload PDF');
      }

      connectionStatus = { connected: true, lastChecked: new Date() };
      return response.json();
    } catch (error) {
      return handleFetchError(error, 'Upload failed');
    }
  },

  async listPdfs(): Promise<string[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/list_pdfs`);

      if (!response.ok) {
        throw new Error('Failed to fetch PDFs');
      }

      connectionStatus = { connected: true, lastChecked: new Date() };
      return response.json();
    } catch (error) {
      return handleFetchError(error, 'Failed to list documents');
    }
  },

  async removePdf(filename: string): Promise<{ message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/remove_pdf/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to remove PDF');
      }

      connectionStatus = { connected: true, lastChecked: new Date() };
      return response.json();
    } catch (error) {
      return handleFetchError(error, 'Failed to remove document');
    }
  },

  async chat(query: string): Promise<ChatResponse> {
    try {
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

      connectionStatus = { connected: true, lastChecked: new Date() };
      return response.json();
    } catch (error) {
      return handleFetchError(error, 'Chat failed');
    }
  },
};
