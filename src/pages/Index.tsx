import { useState, useEffect, useRef } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentList from "@/components/DocumentList";
import ChatInterface from "@/components/ChatInterface";
import ConnectionStatus from "@/components/ConnectionStatus";
import { api } from "@/lib/api";

const Index = () => {
  const [documents, setDocuments] = useState<string[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const mainSectionRef = useRef<HTMLElement>(null);

  const fetchDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const docs = await api.listPdfs();
      setDocuments(docs);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchDocuments();
    } else {
      setIsLoadingDocs(false);
    }
  }, [isConnected]);

  const handleConnectionChange = (connected: boolean) => {
    setIsConnected(connected);
  };

  const scrollToMain = () => {
    mainSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <HeroSection onGetStarted={scrollToMain} />

      <main ref={mainSectionRef} className="container py-16 lg:py-24">
        <div className="mx-auto max-w-6xl">
          {/* Section Header */}
          <div className="mb-8 text-center">
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
              Your Study Workspace
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Upload materials, manage your library, and chat with AI
            </p>
          </div>

          {/* Connection Status */}
          <div className="mb-8 flex justify-center">
            <ConnectionStatus onConnectionChange={handleConnectionChange} />
          </div>

          <div className="grid gap-8 lg:grid-cols-5">
            {/* Left Sidebar - Documents */}
            <div className="lg:col-span-2 space-y-8">
              {/* Upload Section */}
              <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <h3 className="font-display text-xl font-semibold text-foreground mb-4">
                  Upload Materials
                </h3>
                <DocumentUpload 
                  onUploadSuccess={fetchDocuments} 
                  disabled={!isConnected}
                />
              </section>

              {/* Document Library */}
              <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <DocumentList
                  documents={documents}
                  isLoading={isLoadingDocs && isConnected}
                  onDocumentRemoved={fetchDocuments}
                  disabled={!isConnected}
                />
              </section>
            </div>

            {/* Right - Chat Interface */}
            <div className="lg:col-span-3">
              <ChatInterface 
                hasDocuments={documents.length > 0} 
                isConnected={isConnected}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/30 py-8">
        <div className="container text-center">
          <p className="text-sm text-muted-foreground">
            ReviseAI — AI-powered exam revision assistant
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
