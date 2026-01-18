// API configuration for the FastAPI backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://study-buddy-hub-backend.onrender.com';

export interface ChatResponse {
  response: string;
  sources: string[];
}

export interface UploadResponse {
  message: string;
  filename: string;
}

export interface LoginResponse {
  access_token: string;
  username: string;
  message: string;
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

// Callback for handling 401 unauthorized
let onUnauthorizedCallback: (() => void) | null = null;

export const setUnauthorizedCallback = (callback: () => void) => {
  onUnauthorizedCallback = callback;
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

const getAuthHeader = (): HeadersInit => {
  const token = localStorage.getItem('authToken');
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
};

const handleUnauthorized = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('username');
  if (onUnauthorizedCallback) {
    onUnauthorizedCallback();
  }
};

const checkResponseStatus = async (response: Response): Promise<Response> => {
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }
  return response;
};

export const api = {
  async register(username: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Registration failed with status ${response.status}`);
      }

      const data: LoginResponse = await response.json();
      localStorage.setItem('authToken', data.access_token);
      localStorage.setItem('username', data.username);
      connectionStatus = { connected: true, lastChecked: new Date() };
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      throw new Error(errorMessage);
    }
  },

  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Login failed with status ${response.status}`);
      }

      const data: LoginResponse = await response.json();
      localStorage.setItem('authToken', data.access_token);
      localStorage.setItem('username', data.username);
      connectionStatus = { connected: true, lastChecked: new Date() };
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      throw new Error(errorMessage);
    }
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/logout`, {
        method: 'POST',
        headers: getAuthHeader(),
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('username');
    }
  },

  async checkConnection(): Promise<boolean> {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/list_pdfs`, {
        method: 'GET',
        headers: getAuthHeader(),
        signal: AbortSignal.timeout(5000),
      });

      await checkResponseStatus(response);
      
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
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Not authenticated. Please log in first.');
      }

      const response = await fetch(`${API_BASE_URL}/upload_pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      await checkResponseStatus(response);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed with status ${response.status}`);
      }

      connectionStatus = { connected: true, lastChecked: new Date() };
      return response.json();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      throw new Error(errorMessage);
    }
  },

  async listPdfs(): Promise<string[]> {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        return [];
      }

      const response = await fetch(`${API_BASE_URL}/list_pdfs`, {
        method: 'GET',
        headers: getAuthHeader(),
      });

      await checkResponseStatus(response);

      if (!response.ok) {
        throw new Error('Failed to fetch PDFs');
      }

      connectionStatus = { connected: true, lastChecked: new Date() };
      return response.json();
    } catch (error) {
      console.error('Error listing PDFs:', error);
      return [];
    }
  },

  async removePdf(filename: string): Promise<{ message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/remove_pdf/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });

      await checkResponseStatus(response);

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
        headers: getAuthHeader(),
        body: JSON.stringify({ query }),
      });

      await checkResponseStatus(response);

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
