import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { LLMRankingPrompt } from '@/hooks/useLLMRankingPrompts';
import { Clock, Calendar } from 'lucide-react';

interface PromptScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: LLMRankingPrompt | null;
  onSave: (promptId: string, scheduleEnabled: boolean, scheduledTime: string, scheduleDays: string[]) => Promise<boolean>;
}

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export function PromptScheduleDialog({
  open,
  onOpenChange,
  prompt,
  onSave,
}: PromptScheduleDialogProps) {
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [scheduleDays, setScheduleDays] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (prompt) {
      setScheduleEnabled(prompt.schedule_enabled || false);
      setScheduledTime(prompt.scheduled_time || '09:00');
      setScheduleDays(prompt.schedule_days || []);
    }
  }, [prompt]);

  const handleDayToggle = (day: string) => {
    setScheduleDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const handleSelectAllDays = () => {
    if (scheduleDays.length === DAYS_OF_WEEK.length) {
      setScheduleDays([]);
    } else {
      setScheduleDays([...DAYS_OF_WEEK]);
    }
  };

  const handleSelectWeekdays = () => {
    setScheduleDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  };

  const handleSave = async () => {
    if (!prompt) return;
    
    setIsSaving(true);
    const success = await onSave(prompt.id, scheduleEnabled, scheduledTime, scheduleDays);
    setIsSaving(false);
    
    if (success) {
      onOpenChange(false);
    }
  };

  if (!prompt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule: {prompt.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="schedule-enabled" className="text-base font-medium">
                Enable Schedule
              </Label>
              <p className="text-sm text-muted-foreground">
                Run this prompt automatically on schedule
              </p>
            </div>
            <Switch
              id="schedule-enabled"
              checked={scheduleEnabled}
              onCheckedChange={setScheduleEnabled}
            />
          </div>

          <div className={!scheduleEnabled ? 'opacity-50 pointer-events-none' : ''}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scheduled-time" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Run Time
                </Label>
                <Input
                  id="scheduled-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-40"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Run on Days</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectWeekdays}
                      className="text-xs h-7"
                    >
                      Weekdays
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAllDays}
                      className="text-xs h-7"
                    >
                      {scheduleDays.length === DAYS_OF_WEEK.length ? 'Clear All' : 'All Days'}
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div
                      key={day}
                      className="flex items-center space-x-2 rounded-md border p-2"
                    >
                      <Checkbox
                        id={`day-${day}`}
                        checked={scheduleDays.includes(day)}
                        onCheckedChange={() => handleDayToggle(day)}
                      />
                      <Label
                        htmlFor={`day-${day}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {day}
                      </Label>
                    </div>
                  ))}
                </div>
                
                {scheduleDays.length === 0 && scheduleEnabled && (
                  <p className="text-xs text-muted-foreground">
                    No days selected - prompt will run every day
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
