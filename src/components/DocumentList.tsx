import { FileText, Trash2, Loader2, FolderOpen } from "lucide-react";
import { Button } from "./ui/button";
import { api } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface DocumentListProps {
  documents: string[];
  isLoading: boolean;
  onDocumentRemoved: () => void;
  disabled?: boolean;
}

const DocumentList = ({ documents, isLoading, onDocumentRemoved, disabled = false }: DocumentListProps) => {
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDelete = async (filename: string) => {
    setDeletingDoc(filename);
    try {
      await api.removePdf(filename);
      toast({
        title: "Document removed",
        description: `${filename} has been deleted`,
      });
      onDocumentRemoved();
    } catch (error) {
      toast({
        title: "Failed to remove",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeletingDoc(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="mt-4 font-display text-lg font-semibold text-foreground">
          No documents yet
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload PDFs to start chatting with your study materials
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold text-foreground">
          Your Documents
        </h3>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {documents.length} file{documents.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {documents.map((doc, index) => (
          <div
            key={doc}
            className="group flex items-center gap-3 rounded-xl bg-card p-4 shadow-soft transition-all duration-200 hover:shadow-elevated animate-fade-in"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-foreground">{doc}</p>
              <p className="text-xs text-muted-foreground">PDF Document</p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(doc)}
              disabled={deletingDoc === doc}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              {deletingDoc === doc ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentList;
