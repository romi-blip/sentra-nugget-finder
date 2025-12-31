import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import { WebhookSettingsDialog } from '@/components/settings/WebhookSettingsDialog';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft } from 'lucide-react';
import { PromptManagementTable } from '@/components/llm-ranking/PromptManagementTable';
import { AddEditPromptDialog } from '@/components/llm-ranking/AddEditPromptDialog';
import { useLLMRankingPrompts, LLMRankingPrompt } from '@/hooks/useLLMRankingPrompts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function LLMRankingSettings() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<LLMRankingPrompt | null>(null);
  const [deletePromptId, setDeletePromptId] = useState<string | null>(null);

  const {
    prompts,
    isLoading,
    isTriggering,
    createPrompt,
    updatePrompt,
    deletePrompt,
    triggerPromptRun,
    togglePromptActive,
  } = useLLMRankingPrompts();

  const handleEdit = (prompt: LLMRankingPrompt) => {
    setEditingPrompt(prompt);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deletePromptId) {
      await deletePrompt(deletePromptId);
      setDeletePromptId(null);
    }
  };

  const handleSubmit = async (values: any) => {
    if (editingPrompt) {
      return updatePrompt({ id: editingPrompt.id, ...values });
    }
    return createPrompt(values);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingPrompt(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar onOpenSettings={() => setSettingsOpen(true)} />
      <WebhookSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/llm-ranking">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Analytics
            </Button>
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">LLM Ranking Settings</h1>
              <p className="text-muted-foreground mt-1">
                Manage prompts used for LLM ranking analysis
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Prompt
            </Button>
          </div>
        </div>

        <PromptManagementTable
          prompts={prompts}
          isLoading={isLoading}
          isTriggering={isTriggering}
          onEdit={handleEdit}
          onDelete={(id) => setDeletePromptId(id)}
          onTriggerRun={triggerPromptRun}
          onToggleActive={togglePromptActive}
        />

        <AddEditPromptDialog
          open={dialogOpen}
          onOpenChange={handleDialogClose}
          prompt={editingPrompt}
          onSubmit={handleSubmit}
        />

        <AlertDialog open={!!deletePromptId} onOpenChange={(open) => !open && setDeletePromptId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this prompt? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
