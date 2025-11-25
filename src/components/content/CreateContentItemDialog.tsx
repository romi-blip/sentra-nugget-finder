import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { ContentPlanItem, CreateContentItemData } from "@/services/contentService";

interface CreateContentItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateContentItemData) => void;
  isLoading?: boolean;
  editItem?: ContentPlanItem | null;
}

export const CreateContentItemDialog: React.FC<CreateContentItemDialogProps> = ({
  open,
  onClose,
  onSubmit,
  isLoading,
  editItem,
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateContentItemData>({
    defaultValues: editItem ? {
      title: editItem.title,
      strategic_purpose: editItem.strategic_purpose,
      target_keywords: editItem.target_keywords || '',
      outline: editItem.outline || '',
    } : undefined,
  });

  React.useEffect(() => {
    if (open) {
      reset(editItem ? {
        title: editItem.title,
        strategic_purpose: editItem.strategic_purpose,
        target_keywords: editItem.target_keywords || '',
        outline: editItem.outline || '',
      } : {
        title: '',
        strategic_purpose: '',
        target_keywords: '',
        outline: '',
      });
    }
  }, [open, editItem, reset]);

  const handleFormSubmit = (data: CreateContentItemData) => {
    onSubmit(data);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit Content Item' : 'Add Content Item'}</DialogTitle>
          <DialogDescription>
            {editItem ? 'Update the content item details.' : 'Add a new item to your content plan.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              {...register('title', { required: 'Title is required' })}
              placeholder="e.g., Blog: Data Security Best Practices"
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="strategic_purpose">Strategic Purpose *</Label>
            <Textarea
              id="strategic_purpose"
              {...register('strategic_purpose', { required: 'Strategic purpose is required' })}
              placeholder="e.g., Thought leadership for security buyers"
              rows={2}
            />
            {errors.strategic_purpose && (
              <p className="text-xs text-destructive">{errors.strategic_purpose.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_keywords">Target Keywords</Label>
            <Input
              id="target_keywords"
              {...register('target_keywords')}
              placeholder="e.g., DSPM, data security, cloud"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="outline">Outline</Label>
            <Textarea
              id="outline"
              {...register('outline')}
              placeholder="Content structure or key points..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : (editItem ? 'Update' : 'Add Item')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
