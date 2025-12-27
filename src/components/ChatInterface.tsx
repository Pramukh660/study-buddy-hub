import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, FileText, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";
import { api, ChatResponse } from "@/lib/api";

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'error';
  content: string;
  sources?: string[];
  timestamp: Date;
}

interface ChatInterfaceProps {
  hasDocuments: boolean;
}

const ChatInterface = ({ hasDocuments }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !hasDocuments) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await api.chat(userMessage.content);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.response,
        sources: response.sources,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'error',
        content: error instanceof Error ? error.message : "Failed to get response",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-[600px] rounded-2xl border border-border bg-card shadow-elevated overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-secondary/30 px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-soft">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            Study Assistant
          </h3>
          <p className="text-xs text-muted-foreground">
            {hasDocuments ? "Ask anything about your documents" : "Upload documents to start"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${hasDocuments ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
          <span className="text-xs text-muted-foreground">
            {hasDocuments ? 'Ready' : 'Waiting'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 mb-6">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <h4 className="font-display text-xl font-semibold text-foreground">
              Ready to Help You Study
            </h4>
            <p className="mt-2 max-w-sm text-muted-foreground">
              {hasDocuments 
                ? "Ask any question about your uploaded materials and I'll find the answers!"
                : "Upload some PDFs first, then start asking questions about your study materials."
              }
            </p>
            {hasDocuments && (
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {["Summarize the key concepts", "What are the main topics?", "Explain the important formulas"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground transition-all hover:bg-secondary/80 hover:shadow-soft"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((message, index) => (
          <MessageBubble key={message.id} message={message} index={index} />
        ))}

        {isLoading && (
          <div className="flex items-start gap-3 animate-fade-in">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-soft shrink-0">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="rounded-2xl rounded-tl-md bg-secondary px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Searching your documents...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border p-4 bg-secondary/30">
        <div className="flex items-end gap-3">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasDocuments ? "Ask about your study materials..." : "Upload documents first..."}
              disabled={!hasDocuments || isLoading}
              rows={1}
              className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading || !hasDocuments}
            className="h-12 w-12 shrink-0 rounded-xl"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </form>
    </div>
  );
};

interface MessageBubbleProps {
  message: Message;
  index: number;
}

const MessageBubble = ({ message, index }: MessageBubbleProps) => {
  const isUser = message.type === 'user';
  const isError = message.type === 'error';

  return (
    <div
      className={`flex items-start gap-3 animate-fade-in ${isUser ? 'flex-row-reverse' : ''}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className={`
        flex h-10 w-10 items-center justify-center rounded-xl shrink-0 shadow-soft
        ${isUser ? 'bg-accent' : isError ? 'bg-destructive' : 'bg-primary'}
      `}>
        {isUser ? (
          <User className="h-5 w-5 text-accent-foreground" />
        ) : isError ? (
          <AlertTriangle className="h-5 w-5 text-destructive-foreground" />
        ) : (
          <Bot className="h-5 w-5 text-primary-foreground" />
        )}
      </div>

      <div className={`max-w-[75%] ${isUser ? 'text-right' : ''}`}>
        <div className={`
          rounded-2xl px-4 py-3
          ${isUser 
            ? 'rounded-tr-md bg-accent text-accent-foreground' 
            : isError 
              ? 'rounded-tl-md bg-destructive/10 text-foreground border border-destructive/20' 
              : 'rounded-tl-md bg-secondary text-secondary-foreground'
          }
        `}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        </div>

        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.sources.map((source) => (
              <span
                key={source}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary"
              >
                <FileText className="h-3 w-3" />
                {source}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
