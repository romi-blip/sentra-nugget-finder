import { useState, useEffect, useRef } from 'react';
import { getChatJob, type ChatJob } from '@/services/webhookService';

interface UseChatJobPollingOptions {
  jobId: string | null;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
  pollingInterval?: number;
  maxPollingTime?: number;
}

export const useChatJobPolling = ({
  jobId,
  onComplete,
  onError,
  pollingInterval = 2000, // 2 seconds
  maxPollingTime = 180000, // 3 minutes
}: UseChatJobPollingOptions) => {
  const [job, setJob] = useState<ChatJob | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!jobId) {
      setIsPolling(false);
      setJob(null);
      return;
    }

    setIsPolling(true);
    startTimeRef.current = Date.now();

    const pollJob = async () => {
      try {
        const { job: currentJob, error } = await getChatJob(jobId);

        if (error) {
          console.error('Failed to poll job:', error);
          onError?.(error.message || 'Failed to get job status');
          stopPolling();
          return;
        }

        setJob(currentJob);

        // Check if job is completed (by status OR by having completed_at + result)
        const isJobCompleted = currentJob?.status === 'completed' || 
          (currentJob?.completed_at && currentJob?.result);
        
        if (isJobCompleted) {
          // Parse stringified JSON results if needed
          let result = currentJob?.result;
          if (typeof result === 'string') {
            try {
              result = JSON.parse(result);
            } catch (e) {
              // Keep as string if not valid JSON
            }
          }
          onComplete?.(result);
          stopPolling();
        } else if (currentJob?.status === 'failed') {
          onError?.(currentJob.error || 'Job failed');
          stopPolling();
        } else {
          // Check if we've exceeded max polling time
          const elapsed = Date.now() - (startTimeRef.current || 0);
          if (elapsed > maxPollingTime) {
            onError?.('Job timed out');
            stopPolling();
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        onError?.(error instanceof Error ? error.message : 'Polling failed');
        stopPolling();
      }
    };

    const stopPolling = () => {
      setIsPolling(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Start polling immediately
    pollJob();

    // Set up interval for continued polling
    intervalRef.current = setInterval(pollJob, pollingInterval);

    return stopPolling;
  }, [jobId, onComplete, onError, pollingInterval, maxPollingTime]);

  const stopPolling = () => {
    setIsPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  return {
    job,
    isPolling,
    stopPolling,
  };
};