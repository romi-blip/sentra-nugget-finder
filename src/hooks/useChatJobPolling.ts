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
  const isFetchingRef = useRef(false);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (!jobId) {
      setIsPolling(false);
      setJob(null);
      hasCompletedRef.current = false;
      return;
    }

    // Reset completion flag for new job
    hasCompletedRef.current = false;
    setIsPolling(true);
    startTimeRef.current = Date.now();

    const pollJob = async () => {
      // Prevent concurrent polling
      if (isFetchingRef.current || hasCompletedRef.current) {
        return;
      }
      
      isFetchingRef.current = true;
      
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
        
        if (isJobCompleted && !hasCompletedRef.current) {
          hasCompletedRef.current = true;
          
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
      } finally {
        isFetchingRef.current = false;
      }
    };

    const stopPolling = () => {
      setIsPolling(false);
      isFetchingRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Start polling with async wrapper to avoid race conditions
    const startPolling = async () => {
      // First poll immediately and await it
      await pollJob();
      
      // Only set interval if job hasn't already completed
      if (!hasCompletedRef.current) {
        intervalRef.current = setInterval(pollJob, pollingInterval);
      }
    };

    startPolling();

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