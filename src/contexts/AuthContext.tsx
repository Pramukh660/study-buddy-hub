import React, { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setUnauthorizedCallback } from '../lib/api';

export interface User {
  username: string;
  authToken: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  register: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');
    if (token && username) {
      setUser({ username, authToken: token });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Set up the callback for handling 401 unauthorized responses
    setUnauthorizedCallback(() => {
      setUser(null);
      navigate('/login', { replace: true });
    });
  }, [navigate]);

  const register = async (username: string, password: string) => {
    const response = await api.register(username, password);
    setUser({ username: response.username, authToken: response.access_token });
  };

  const login = async (username: string, password: string) => {
    const response = await api.login(username, password);
    setUser({ username: response.username, authToken: response.access_token });
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, register, login, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
};
