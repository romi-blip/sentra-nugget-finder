import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useReviewerPatterns, ReviewerFeedbackPattern } from "@/hooks/useContentReview";
import { AddPatternDialog } from "./AddPatternDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ReviewerSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const priorityColors: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-muted text-muted-foreground border-muted-foreground/20",
};

const typeLabels: Record<string, string> = {
  style: "Style",
  accuracy: "Accuracy",
  tone: "Tone",
  structure: "Structure",
  messaging: "Messaging",
  general: "General",
};

export function ReviewerSettingsDialog({ open, onClose }: ReviewerSettingsDialogProps) {
  const { patterns, isLoading, togglePattern, deletePattern, isDeleting } = useReviewerPatterns();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editPattern, setEditPattern] = useState<ReviewerFeedbackPattern | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleEdit = (pattern: ReviewerFeedbackPattern) => {
    setEditPattern(pattern);
    setAddDialogOpen(true);
  };

  const handleAddDialogClose = () => {
    setAddDialogOpen(false);
    setEditPattern(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      deletePattern(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  // Group patterns by type
  const groupedPatterns = patterns.reduce((acc, pattern) => {
    if (!acc[pattern.feedback_type]) {
      acc[pattern.feedback_type] = [];
    }
    acc[pattern.feedback_type].push(pattern);
    return acc;
  }, {} as Record<string, ReviewerFeedbackPattern[]>);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Reviewer Agent Settings</DialogTitle>
          </DialogHeader>

          <div className="flex justify-between items-center py-2">
            <p className="text-sm text-muted-foreground">
              Manage learned feedback patterns that guide the AI reviewer.
            </p>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Pattern
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : patterns.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No feedback patterns yet.</p>
                <p className="text-sm mt-1">Add patterns manually or submit feedback on content reviews.</p>
              </div>
            ) : (
              Object.entries(groupedPatterns).map(([type, typePatterns]) => (
                <div key={type} className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    {typeLabels[type] || type}
                  </h3>
                  <div className="space-y-2">
                    {typePatterns.map((pattern) => (
                      <div
                        key={pattern.id}
                        className={`border rounded-lg p-4 transition-opacity ${
                          !pattern.is_active ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant="outline"
                                className={priorityColors[pattern.priority] || priorityColors.low}
                              >
                                {pattern.priority}
                              </Badge>
                              <span className="text-sm font-medium truncate">
                                {pattern.feedback_pattern}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {pattern.feedback_instruction}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Switch
                              checked={pattern.is_active}
                              onCheckedChange={(checked) =>
                                togglePattern({ id: pattern.id, isActive: checked })
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(pattern)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirm(pattern.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AddPatternDialog
        open={addDialogOpen}
        onClose={handleAddDialogClose}
        editPattern={editPattern}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete pattern?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this feedback pattern from the reviewer agent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
