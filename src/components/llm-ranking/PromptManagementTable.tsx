import React from 'react';
import { LLMRankingPrompt } from '@/hooks/useLLMRankingPrompts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Play, Pencil, Trash2, Loader2, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PromptManagementTableProps {
  prompts: LLMRankingPrompt[];
  isLoading: boolean;
  isTriggering: string | null;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onEdit: (prompt: LLMRankingPrompt) => void;
  onDelete: (id: string) => void;
  onTriggerRun: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onSchedule: (prompt: LLMRankingPrompt) => void;
}

const categoryColors: Record<string, string> = {
  DSPM: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'Data Security': 'bg-green-500/10 text-green-500 border-green-500/20',
  'Cloud Security': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  'AI Security': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  General: 'bg-muted text-muted-foreground border-muted',
};

const frequencyLabels: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  manual: 'Manual',
};

export function PromptManagementTable({
  prompts,
  isLoading,
  isTriggering,
  selectedIds,
  onSelectionChange,
  onEdit,
  onDelete,
  onTriggerRun,
  onToggleActive,
  onSchedule,
}: PromptManagementTableProps) {
  const allSelected = prompts.length > 0 && selectedIds.length === prompts.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < prompts.length;

  const handleSelectAll = (checked: boolean) => {
    onSelectionChange(checked ? prompts.map(p => p.id) : []);
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter(i => i !== id));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No prompts configured yet. Add your first prompt to get started.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all"
                className={someSelected ? "opacity-50" : ""}
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Last Run</TableHead>
            <TableHead className="w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prompts.map((prompt) => (
            <TableRow key={prompt.id} data-state={selectedIds.includes(prompt.id) ? "selected" : undefined}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.includes(prompt.id)}
                  onCheckedChange={(checked) => handleSelectOne(prompt.id, !!checked)}
                  aria-label={`Select ${prompt.name}`}
                />
              </TableCell>
              <TableCell className="font-medium">
                <div>
                  <div>{prompt.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1 max-w-md">
                    {prompt.prompt_text}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {prompt.category && (
                  <Badge 
                    variant="outline" 
                    className={categoryColors[prompt.category] || categoryColors.General}
                  >
                    {prompt.category}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5">
                        {prompt.schedule_enabled ? (
                          <>
                            <Clock className="h-3.5 w-3.5 text-green-500" />
                            <span className="text-sm text-green-600 dark:text-green-400">
                              {prompt.scheduled_time?.slice(0, 5) || '09:00'}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {frequencyLabels[prompt.run_frequency] || 'Manual'}
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {prompt.schedule_enabled ? (
                        <div className="text-xs">
                          <p>Runs at {prompt.scheduled_time?.slice(0, 5)}</p>
                          {prompt.schedule_days && prompt.schedule_days.length > 0 && (
                            <p className="text-muted-foreground">
                              {prompt.schedule_days.join(', ')}
                            </p>
                          )}
                          {prompt.next_scheduled_run && (
                            <p className="mt-1">
                              Next: {format(new Date(prompt.next_scheduled_run), 'MMM d, HH:mm')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p>No schedule configured</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell>
                <Switch
                  checked={prompt.is_active}
                  onCheckedChange={(checked) => onToggleActive(prompt.id, checked)}
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {prompt.last_run_at 
                  ? format(new Date(prompt.last_run_at), 'MMM d, yyyy HH:mm')
                  : 'Never'}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onTriggerRun(prompt.id)}
                    disabled={isTriggering === prompt.id || isTriggering === 'bulk'}
                    title="Run now"
                  >
                    {isTriggering === prompt.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onSchedule(prompt)}
                    title="Configure schedule"
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => onEdit(prompt)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onSchedule(prompt)}>
                        <Calendar className="mr-2 h-4 w-4" />
                        Schedule
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onDelete(prompt.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
