import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { LLMRankingPrompt } from '@/hooks/useLLMRankingPrompts';

const promptSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  prompt_text: z.string().min(10, 'Prompt must be at least 10 characters'),
  category: z.string().optional(),
  is_active: z.boolean().default(true),
  run_frequency: z.string().default('daily'),
});

type PromptFormValues = z.infer<typeof promptSchema>;

interface AddEditPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt?: LLMRankingPrompt | null;
  onSubmit: (values: PromptFormValues) => Promise<boolean>;
}

const categories = [
  { value: 'DSPM', label: 'DSPM' },
  { value: 'Data Security', label: 'Data Security' },
  { value: 'Cloud Security', label: 'Cloud Security' },
  { value: 'AI Security', label: 'AI Security' },
  { value: 'General', label: 'General' },
];

const frequencies = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'manual', label: 'Manual Only' },
];

export function AddEditPromptDialog({
  open,
  onOpenChange,
  prompt,
  onSubmit,
}: AddEditPromptDialogProps) {
  const isEditing = !!prompt;

  const form = useForm<PromptFormValues>({
    resolver: zodResolver(promptSchema),
    defaultValues: {
      name: '',
      prompt_text: '',
      category: '',
      is_active: true,
      run_frequency: 'daily',
    },
  });

  useEffect(() => {
    if (prompt) {
      form.reset({
        name: prompt.name,
        prompt_text: prompt.prompt_text,
        category: prompt.category || '',
        is_active: prompt.is_active,
        run_frequency: prompt.run_frequency,
      });
    } else {
      form.reset({
        name: '',
        prompt_text: '',
        category: '',
        is_active: true,
        run_frequency: 'daily',
      });
    }
  }, [prompt, form]);

  const handleSubmit = async (values: PromptFormValues) => {
    const success = await onSubmit(values);
    if (success) {
      onOpenChange(false);
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Prompt' : 'Add New Prompt'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Best DSPM Tools 2025" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prompt_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt Text</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter the query prompt to send to LLMs..."
                      className="min-h-[120px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    This is the exact prompt that will be sent to LLMs for ranking analysis.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="run_frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Run Frequency</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {frequencies.map((freq) => (
                          <SelectItem key={freq.value} value={freq.value}>
                            {freq.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Only active prompts will be included in scheduled runs.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting 
                  ? 'Saving...' 
                  : isEditing ? 'Save Changes' : 'Add Prompt'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
