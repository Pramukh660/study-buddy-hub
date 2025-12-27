import { useCallback, useState } from "react";
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface DocumentUploadProps {
  onUploadSuccess: () => void;
  disabled?: boolean;
}

const DocumentUpload = ({ onUploadSuccess, disabled = false }: DocumentUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, 'uploading' | 'success' | 'error'>>(new Map());
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const uploadFile = async (file: File) => {
    if (disabled) {
      toast({
        title: "Backend not connected",
        description: "Please ensure the FastAPI server is running",
        variant: "destructive",
      });
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: "Invalid file type",
        description: "Only PDF files are accepted",
        variant: "destructive",
      });
      return;
    }

    setUploadingFiles(prev => new Map(prev).set(file.name, 'uploading'));

    try {
      await api.uploadPdf(file);
      setUploadingFiles(prev => new Map(prev).set(file.name, 'success'));
      toast({
        title: "Upload successful",
        description: `${file.name} has been indexed`,
      });
      onUploadSuccess();
      
      // Clear success status after 3 seconds
      setTimeout(() => {
        setUploadingFiles(prev => {
          const newMap = new Map(prev);
          newMap.delete(file.name);
          return newMap;
        });
      }, 3000);
    } catch (error) {
      setUploadingFiles(prev => new Map(prev).set(file.name, 'error'));
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(uploadFile);
    e.target.value = '';
  };

  const getStatusIcon = (status: 'uploading' | 'success' | 'error') => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={disabled ? undefined : handleDragOver}
        onDragLeave={disabled ? undefined : handleDragLeave}
        onDrop={disabled ? undefined : handleDrop}
        className={`
          relative rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300
          ${disabled 
            ? 'opacity-50 cursor-not-allowed border-muted'
            : isDragging
            ? 'border-primary bg-primary/5 scale-[1.02]' 
            : 'border-border hover:border-primary/50 hover:bg-secondary/50'}
        `}
      >
        <input
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileSelect}
          disabled={disabled}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        
        <div className="flex flex-col items-center gap-4">
          <div className={`
            flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300
            ${isDragging ? 'bg-primary text-primary-foreground scale-110' : 'bg-secondary text-muted-foreground'}
          `}>
            <Upload className="h-8 w-8" />
          </div>
          
          <div>
            <p className="text-lg font-semibold text-foreground">
              Drop your PDFs here
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              or click to browse • PDF files only
            </p>
          </div>
        </div>
      </div>

      {/* Upload status list */}
      {uploadingFiles.size > 0 && (
        <div className="space-y-2">
          {Array.from(uploadingFiles.entries()).map(([filename, status]) => (
            <div
              key={filename}
              className="flex items-center gap-3 rounded-lg bg-card p-3 shadow-soft animate-fade-in"
            >
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="flex-1 truncate text-sm font-medium">{filename}</span>
              {getStatusIcon(status)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
