import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

export const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const { register, login } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('Registering with username:', username);
      await register(username, password);
      console.log('Registration successful, navigating to home...');
      navigate('/');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Registration failed';
      console.error('Registration error:', errorMsg);
      setError(errorMsg);
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('Logging in with username:', username);
      await login(username, password);
      console.log('Login successful, navigating to home...');
      navigate('/');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Login failed';
      console.error('Login error:', errorMsg);
      setError(errorMsg);
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (isRegisterMode) {
      handleRegister(e);
    } else {
      handleLogin(e);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="p-8">
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">Study Buddy Hub</h1>
          <p className="text-center text-gray-600 mb-8">
            {isRegisterMode ? 'Create your account' : 'Login to your account'}
          </p>

          {error && (
            <Alert className="mb-6 bg-red-50 border-red-200">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={isLoading}
                minLength={3}
                required
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Min 3 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                required
                className="w-full"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2"
            >
              {isLoading 
                ? (isRegisterMode ? 'Creating account...' : 'Logging in...') 
                : (isRegisterMode ? 'Register' : 'Login')}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setError('');
              }}
              disabled={isLoading}
              className="w-full text-sm text-indigo-600 hover:text-indigo-700 font-medium py-2 transition-colors"
            >
              {isRegisterMode 
                ? '← Back to Login' 
                : 'Create new account →'}
            </button>
            <p className="text-xs text-gray-500 text-center mt-4">
              💡 {isRegisterMode 
                ? 'Register first, then use the same credentials to login' 
                : 'Don\'t have an account? Click above to register'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
