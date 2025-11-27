import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface ReviewerFeedbackDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (feedback: string) => void;
  isLoading?: boolean;
}

export const ReviewerFeedbackDialog: React.FC<ReviewerFeedbackDialogProps> = ({
  open,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [feedback, setFeedback] = useState("");

  const handleSubmit = () => {
    if (feedback.trim()) {
      onSubmit(feedback.trim());
      setFeedback("");
    }
  };

  const handleClose = () => {
    setFeedback("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Feedback to Reviewer</DialogTitle>
          <DialogDescription>
            Share your feedback about this review. The system will learn from your input 
            and apply it to future content reviews.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="feedback">Your Feedback</Label>
            <Textarea
              id="feedback"
              placeholder="e.g., The reviewer missed that we should always mention agentless deployment as a key differentiator when discussing DSPM..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Be specific about what the AI reviewer should do differently. 
              Your feedback will be converted into a pattern for future reviews.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium mb-1">Examples of good feedback:</p>
            <ul className="text-muted-foreground space-y-1">
              <li>• "Always check that competitor comparisons are balanced"</li>
              <li>• "Ensure CTAs are specific, not generic 'learn more'"</li>
              <li>• "Flag content that uses fear-based language"</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!feedback.trim() || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              "Add to Reviewer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
