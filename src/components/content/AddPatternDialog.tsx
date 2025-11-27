import React, { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { useReviewerPatterns, ReviewerFeedbackPattern } from "@/hooks/useContentReview";
import { Loader2 } from "lucide-react";

interface AddPatternDialogProps {
  open: boolean;
  onClose: () => void;
  editPattern?: ReviewerFeedbackPattern | null;
}

interface PatternFormData {
  feedback_type: string;
  feedback_pattern: string;
  feedback_instruction: string;
  priority: string;
}

const feedbackTypes = [
  { value: "style", label: "Style" },
  { value: "accuracy", label: "Accuracy" },
  { value: "tone", label: "Tone" },
  { value: "structure", label: "Structure" },
  { value: "messaging", label: "Messaging" },
  { value: "general", label: "General" },
];

const priorities = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function AddPatternDialog({ open, onClose, editPattern }: AddPatternDialogProps) {
  const { createPattern, updatePattern, isCreating, isUpdating } = useReviewerPatterns();
  
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<PatternFormData>({
    defaultValues: {
      feedback_type: "general",
      feedback_pattern: "",
      feedback_instruction: "",
      priority: "medium",
    },
  });

  useEffect(() => {
    if (editPattern) {
      reset({
        feedback_type: editPattern.feedback_type,
        feedback_pattern: editPattern.feedback_pattern,
        feedback_instruction: editPattern.feedback_instruction,
        priority: editPattern.priority,
      });
    } else {
      reset({
        feedback_type: "general",
        feedback_pattern: "",
        feedback_instruction: "",
        priority: "medium",
      });
    }
  }, [editPattern, reset, open]);

  const onSubmit = (data: PatternFormData) => {
    if (editPattern) {
      updatePattern({ id: editPattern.id, updates: data }, {
        onSuccess: () => {
          onClose();
        },
      });
    } else {
      createPattern(data, {
        onSuccess: () => {
          onClose();
        },
      });
    }
  };

  const isLoading = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editPattern ? "Edit Pattern" : "Add Feedback Pattern"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="feedback_type">Type</Label>
              <Controller
                name="feedback_type"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {feedbackTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Controller
                name="priority"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback_pattern">Pattern (what to look for)</Label>
            <Input
              id="feedback_pattern"
              placeholder="e.g., Avoid using passive voice excessively"
              {...register("feedback_pattern", { required: "Pattern is required" })}
            />
            {errors.feedback_pattern && (
              <p className="text-sm text-destructive">{errors.feedback_pattern.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback_instruction">Instruction (how to address it)</Label>
            <Textarea
              id="feedback_instruction"
              placeholder="e.g., Replace passive constructions with active voice where possible to improve readability and engagement."
              rows={3}
              {...register("feedback_instruction", { required: "Instruction is required" })}
            />
            {errors.feedback_instruction && (
              <p className="text-sm text-destructive">{errors.feedback_instruction.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editPattern ? "Update" : "Create"} Pattern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
