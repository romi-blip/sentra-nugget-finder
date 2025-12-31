import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft, Play, Loader2 } from 'lucide-react';
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<LLMRankingPrompt | null>(null);
  const [deletePromptId, setDeletePromptId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {
    prompts,
    isLoading,
    isTriggering,
    createPrompt,
    updatePrompt,
    deletePrompt,
    triggerPromptRun,
    triggerBulkRun,
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

  const handleBulkRun = async () => {
    if (selectedIds.length > 0) {
      const success = await triggerBulkRun(selectedIds);
      if (success) {
        setSelectedIds([]);
      }
    }
  };

  return (
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

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="mb-4 p-3 bg-muted rounded-lg flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedIds.length} prompt{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds([])}
            >
              Clear selection
            </Button>
            <Button
              size="sm"
              onClick={handleBulkRun}
              disabled={isTriggering === 'bulk'}
            >
              {isTriggering === 'bulk' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run Selected ({selectedIds.length})
            </Button>
          </div>
        </div>
      )}

      <PromptManagementTable
        prompts={prompts}
        isLoading={isLoading}
        isTriggering={isTriggering}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
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
  );
}
