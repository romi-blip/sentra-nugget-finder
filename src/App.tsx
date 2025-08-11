import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import KnowledgeBase from "./pages/KnowledgeBase";
import Chat from "./pages/Chat";
import Navbar from "@/components/layout/Navbar";
import WebhookSettingsDialog from "@/components/settings/WebhookSettingsDialog";

const queryClient = new QueryClient();

const App = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Navbar onOpenSettings={() => setSettingsOpen(true)} />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/kb" element={<KnowledgeBase />} />
            <Route path="/chat" element={<Chat />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <WebhookSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
