import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw, Server } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "./ui/button";

interface ConnectionStatusProps {
  onConnectionChange?: (connected: boolean) => void;
}

const ConnectionStatus = ({ onConnectionChange }: ConnectionStatusProps) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkConnection = async () => {
    setIsChecking(true);
    setError(null);
    
    try {
      const connected = await api.checkConnection();
      setIsConnected(connected);
      onConnectionChange?.(connected);
      
      if (!connected) {
        setError("Backend server not reachable");
      }
    } catch (err) {
      setIsConnected(false);
      setError(err instanceof Error ? err.message : "Connection failed");
      onConnectionChange?.(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isConnected === null) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2">
        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Connecting...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
            <WifiOff className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-foreground">Backend Not Connected</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {error || "Cannot reach the FastAPI server. Make sure it's running."}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <code className="rounded bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">
                python main.py
              </code>
              <p className="text-xs text-muted-foreground">
                Run this command in your backend directory to start the server at http://localhost:8000
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={checkConnection}
            disabled={isChecking}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
      <Server className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium text-primary">Backend Connected</span>
      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
    </div>
  );
};

export default ConnectionStatus;
