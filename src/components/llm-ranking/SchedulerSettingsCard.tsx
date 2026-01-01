import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useSchedulerSettings } from '@/hooks/useSchedulerSettings';

export function SchedulerSettingsCard() {
  const { settings, isLoading, isSaving, toggleScheduler, setDefaultRunTime } = useSchedulerSettings();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-muted-foreground text-center">
            Failed to load scheduler settings
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Scheduler Settings
        </CardTitle>
        <CardDescription>
          Configure automated prompt execution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="scheduler-enabled" className="text-base font-medium">
              Enable Scheduler
            </Label>
            <p className="text-sm text-muted-foreground">
              Automatically run scheduled prompts at their configured times
            </p>
          </div>
          <Switch
            id="scheduler-enabled"
            checked={settings.scheduler_enabled}
            onCheckedChange={toggleScheduler}
            disabled={isSaving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="default-time" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Default Run Time
          </Label>
          <Input
            id="default-time"
            type="time"
            value={settings.default_run_time}
            onChange={(e) => setDefaultRunTime(e.target.value)}
            disabled={isSaving}
            className="w-40"
          />
          <p className="text-xs text-muted-foreground">
            Default time for new scheduled prompts
          </p>
        </div>

        {settings.last_run_at && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              Last scheduler run:{' '}
              <span className="font-medium text-foreground">
                {format(new Date(settings.last_run_at), 'MMM d, yyyy HH:mm')}
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
