import React, { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import KnowledgeBase from "./pages/KnowledgeBase";
import Chat from "./pages/Chat";
import Auth from "./pages/Auth";
import UserManagement from "./pages/UserManagement";
import EventManagement from "./pages/EventManagement";
import Navbar from "@/components/layout/Navbar";
import WebhookSettingsDialog from "@/components/settings/WebhookSettingsDialog";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AdminSettings from "./pages/AdminSettings";

const queryClient = new QueryClient();

const App = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <Navbar onOpenSettings={() => setSettingsOpen(true)} />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route 
              path="/kb" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                  <KnowledgeBase />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/chat" 
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/lists" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                  <EventManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/users" 
              element={
                <ProtectedRoute requiredRoles={['super_admin']}>
                  <UserManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/settings" 
              element={
                <ProtectedRoute requiredRoles={['super_admin']}>
                  <AdminSettings />
                </ProtectedRoute>
              } 
            />
            <Route path="/auth" element={<Auth />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
        <WebhookSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
