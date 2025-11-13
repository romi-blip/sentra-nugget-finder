import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb } from "lucide-react";

const PointerGlow = () => {
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const root = document.documentElement;
      root.style.setProperty("--cursor-x", `${e.clientX}px`);
      root.style.setProperty("--cursor-y", `${e.clientY}px`);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  return null;
};

const Index = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreatingIdeas, setIsCreatingIdeas] = useState(false);

  const handleCreateBlogIdeas = async () => {
    setIsCreatingIdeas(true);
    try {
      const response = await fetch('https://sentra.app.n8n.cloud/webhook/d1c02680-8b93-4d0e-a6e0-e82fdfe1f7fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Blog post ideas are being generated.",
        });
      } else {
        throw new Error('Failed to trigger webhook');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create blog post ideas. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingIdeas(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Sentra GTM Assistant"
        description="Manage knowledge base sources and chat with an AI copilot to get content and messaging suggestions."
        canonicalPath="/"
      />
      <PointerGlow />
      <header className="bg-hero">
        <div className="mx-auto max-w-7xl px-4 py-20 md:py-28">
          <p className="text-sm uppercase tracking-wider text-brand-foreground/90">For Sentra Sales & GTM</p>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
            Secure, On-Brand Content Suggestions
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            Upload and index collateral, connect Google Drive, and chat with an AI assistant that recommends what to share with prospects.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/kb"><Button variant="hero" className="animate-float">Manage Knowledge Base</Button></Link>
            {user ? (
              <Link to="/chat"><Button variant="secondary">Open AI Chat</Button></Link>
            ) : (
              <Link to="/auth"><Button variant="secondary">Sign In to Chat</Button></Link>
            )}
            <Button 
              variant="outline" 
              onClick={handleCreateBlogIdeas}
              disabled={isCreatingIdeas}
              className="gap-2"
            >
              <Lightbulb className="h-4 w-4" />
              {isCreatingIdeas ? "Creating..." : "Create Blog Post Ideas"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 grid gap-6 md:grid-cols-3">
        <div className="p-6 rounded-xl border glass-card">
          <h3 className="font-semibold mb-1">All your content, organized</h3>
          <p className="text-sm text-muted-foreground">Files and Drive folders turn into searchable knowledge so reps find the best artifact fast.</p>
        </div>
        <div className="p-6 rounded-xl border glass-card">
          <h3 className="font-semibold mb-1">AI suggestions that sell</h3>
          <p className="text-sm text-muted-foreground">Get tailored email and LinkedIn snippets grounded in Sentra’s knowledge base.</p>
        </div>
        <div className="p-6 rounded-xl border glass-card">
          <h3 className="font-semibold mb-1">Built for security</h3>
          <p className="text-sm text-muted-foreground">Keep data in your environment with Supabase and your n8n pipeline.</p>
        </div>
      </main>
    </div>
  );
};

export default Index;
