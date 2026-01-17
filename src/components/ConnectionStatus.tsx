import { useEffect, useState } from "react";
import { Server } from "lucide-react";
import { useAuth } from "../contexts/useAuth";

interface ConnectionStatusProps {
  onConnectionChange?: (connected: boolean) => void;
}

const ConnectionStatus = ({ onConnectionChange }: ConnectionStatusProps) => {
  const { isAuthenticated } = useAuth();
  const [prevAuth, setPrevAuth] = useState(isAuthenticated);

  useEffect(() => {
    // Notify parent when auth status changes
    if (prevAuth !== isAuthenticated) {
      onConnectionChange?.(isAuthenticated);
      setPrevAuth(isAuthenticated);
    }
  }, [isAuthenticated, prevAuth, onConnectionChange]);

  return (
    <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
      <Server className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium text-primary">Backend Connected</span>
      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
    </div>
  );
};

export default ConnectionStatus;
