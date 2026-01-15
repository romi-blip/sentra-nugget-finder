import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { MessageSquare, MessageSquarePlus, BookOpen, List, PenTool, UserSearch, Palette, BarChart3 } from "lucide-react";

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
  const { hasRole, canAccessKnowledgeBase } = useUserRoles();

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
          <p className="text-sm uppercase tracking-wider text-brand-foreground/90">Sentra Marketing Ops</p>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
            Your Marketing Nuggets, All in One Place
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            Where insights don't just live in dashboards—they drive action. AI-powered content suggestions, 
            competitive intelligence, and campaign automation that turns data into revenue.
          </p>
          <p className="mt-6 text-base text-muted-foreground/80 max-w-xl italic">
            "The secret sauce for marketing teams who want to move fast, stay on-brand, and never miss an opportunity."
          </p>
        </div>
      </header>

      {user && (
        <main className="mx-auto max-w-7xl px-4 py-10">
          <h2 className="text-2xl font-bold mb-6">Quick Access</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Link to="/chat" className="block">
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader>
                  <MessageSquare className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>AI Chat</CardTitle>
                  <CardDescription>Get tailored content suggestions grounded in the knowledge base.</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            {(hasRole('admin') || hasRole('super_admin') || hasRole('marketing')) && (
              <Link to="/engagement" className="block">
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <MessageSquarePlus className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>Engagement</CardTitle>
                    <CardDescription>Track Reddit discussions and generate engagement opportunities.</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )}

            {canAccessKnowledgeBase() && (
              <Link to="/kb" className="block">
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <BookOpen className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>Knowledge Base</CardTitle>
                    <CardDescription>Manage files and sources that power the AI assistant.</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )}

            {(hasRole('admin') || hasRole('super_admin')) && (
              <Link to="/lists" className="block">
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <List className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>List Management</CardTitle>
                    <CardDescription>Manage event lists and lead processing workflows.</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )}

            {(hasRole('admin') || hasRole('super_admin') || hasRole('marketing')) && (
              <Link to="/content" className="block">
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <PenTool className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>Content Creation</CardTitle>
                    <CardDescription>Plan, research, and create content with AI assistance.</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )}

            {(hasRole('admin') || hasRole('super_admin') || hasRole('sales')) && (
              <Link to="/lead-research" className="block">
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <UserSearch className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>Lead Research</CardTitle>
                    <CardDescription>Research leads from Salesforce, LinkedIn, or manual input.</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )}

            {(hasRole('admin') || hasRole('super_admin') || hasRole('marketing')) && (
              <Link to="/brand-designer" className="block">
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <Palette className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>Brand Designer</CardTitle>
                    <CardDescription>Create branded documents with custom templates and styling.</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )}

            {(hasRole('admin') || hasRole('super_admin') || hasRole('marketing')) && (
              <Link to="/llm-ranking" className="block">
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <BarChart3 className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>LLM Ranking</CardTitle>
                    <CardDescription>Track Sentra's visibility and positioning across AI models.</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )}
          </div>
        </main>
      )}

      <section className="mx-auto max-w-7xl px-4 py-10 grid gap-6 md:grid-cols-3">
        <div className="p-6 rounded-xl border glass-card">
          <h3 className="font-semibold mb-1">All your content, organized</h3>
          <p className="text-sm text-muted-foreground">Files and Drive folders turn into searchable knowledge so reps find the best artifact fast.</p>
        </div>
        <div className="p-6 rounded-xl border glass-card">
          <h3 className="font-semibold mb-1">AI suggestions that sell</h3>
          <p className="text-sm text-muted-foreground">Get tailored email and LinkedIn snippets grounded in Sentra's knowledge base.</p>
        </div>
        <div className="p-6 rounded-xl border glass-card">
          <h3 className="font-semibold mb-1">Built for security</h3>
          <p className="text-sm text-muted-foreground">Keep data in your environment with Supabase and your n8n pipeline.</p>
        </div>
      </section>
    </div>
  );
};

export default Index;
