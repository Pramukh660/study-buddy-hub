import { ArrowDown, Brain, FileText, MessageSquare } from "lucide-react";
import { Button } from "./ui/button";

interface HeroSectionProps {
  onGetStarted: () => void;
}

const HeroSection = ({ onGetStarted }: HeroSectionProps) => {
  return (
    <section className="relative overflow-hidden gradient-hero py-24 lg:py-32">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary-foreground/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="container relative">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-2">
            <Brain className="h-4 w-4 text-primary-foreground" />
            <span className="text-sm font-medium text-primary-foreground/90">
              AI-Powered Study Assistant
            </span>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl animate-fade-in">
            Master Your Exams with{" "}
            <span className="relative">
              <span className="relative z-10">Intelligent</span>
              <span className="absolute bottom-2 left-0 right-0 h-3 bg-accent/30 -z-10" />
            </span>{" "}
            Revision
          </h1>

          <p className="mt-6 text-lg text-primary-foreground/80 sm:text-xl animate-fade-in" style={{ animationDelay: "0.1s" }}>
            Upload your study materials, ask questions, and get instant AI-powered
            answers with source references. Study smarter, not harder.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <Button variant="hero" size="xl" onClick={onGetStarted}>
              Start Revising
              <ArrowDown className="h-5 w-5" />
            </Button>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-3 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <FeatureCard
              icon={<FileText className="h-6 w-6" />}
              title="Upload PDFs"
              description="Add your textbooks, notes, and past papers"
            />
            <FeatureCard
              icon={<MessageSquare className="h-6 w-6" />}
              title="Ask Anything"
              description="Chat with your documents naturally"
            />
            <FeatureCard
              icon={<Brain className="h-6 w-6" />}
              title="Get Answers"
              description="AI finds relevant information instantly"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard = ({ icon, title, description }: FeatureCardProps) => (
  <div className="group rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-6 backdrop-blur-sm transition-all duration-300 hover:bg-primary-foreground/10 hover:border-primary-foreground/20">
    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/10 text-primary-foreground transition-transform duration-300 group-hover:scale-110">
      {icon}
    </div>
    <h3 className="font-display text-lg font-semibold text-primary-foreground">
      {title}
    </h3>
    <p className="mt-2 text-sm text-primary-foreground/70">{description}</p>
  </div>
);

export default HeroSection;
