import { BookOpen, Sparkles } from "lucide-react";

const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <a href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-soft">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-foreground">
              ReviseAI
            </h1>
            <p className="text-xs text-muted-foreground">Smart Exam Prep</p>
          </div>
        </a>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-accent/10 px-4 py-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent-foreground">AI Powered</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
