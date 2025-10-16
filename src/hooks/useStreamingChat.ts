import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseStreamingChatOptions {
  onChunk: (chunk: string) => void;
  onComplete: (fullMessage: string) => void;
  onError: (error: string) => void;
}

export const useStreamingChat = ({ onChunk, onComplete, onError }: UseStreamingChatOptions) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messageBufferRef = useRef<string>('');
  const chunkBufferRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const sendMessageWithRetry = useCallback(async (
    conversationId: string, 
    message: string,
    retryCount: number = 0
  ): Promise<void> => {
    const MAX_RETRIES = 2;
    const RETRY_DELAYS = [1000, 2000]; // Exponential backoff: 1s, 2s

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        'https://gmgrlphiopslkyxmuced.supabase.co/functions/v1/streaming-chat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtZ3JscGhpb3BzbGt5eG11Y2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MjMyNTMsImV4cCI6MjA2MzM5OTI1M30.Q-_VO1v2-sBim_YLpbebsdIO33WBD7o3YGA5OYk2pYg',
          },
          body: JSON.stringify({ conversationId, message }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream reading complete');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              console.log('Received completion signal');
              onComplete(messageBufferRef.current);
              setIsStreaming(false);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              
              // Handle N8n streaming format: {"type":"item","content":"text chunk"}
              let textContent = '';
              if (parsed.type === 'item' && parsed.content) {
                textContent = parsed.content;
                console.log('📦 Extracted chunk:', textContent.substring(0, 50));
              } else if (typeof parsed === 'string') {
                textContent = parsed;
              } else if (parsed.output) {
                textContent = parsed.output;
              } else if (parsed.text) {
                textContent = parsed.text;
              } else if (parsed.content) {
                textContent = parsed.content;
              } else if (parsed.message) {
                textContent = parsed.message;
              }

              if (textContent) {
                messageBufferRef.current += textContent;
                chunkBufferRef.current += textContent;
                
                // Debounce chunk updates (batch every 50ms)
                if (debounceTimerRef.current) {
                  clearTimeout(debounceTimerRef.current);
                }
                debounceTimerRef.current = setTimeout(() => {
                  if (chunkBufferRef.current) {
                    onChunk(chunkBufferRef.current);
                    chunkBufferRef.current = '';
                  }
                }, 50);
                
                console.log('✅ Chunk added to buffer, total length:', messageBufferRef.current.length);
              }
            } catch (parseError) {
              // If not JSON, treat as plain text
              if (data && data !== '') {
                console.log('📝 Plain text chunk:', data.substring(0, 50));
                messageBufferRef.current += data;
                chunkBufferRef.current += data;
                
                // Debounce chunk updates
                if (debounceTimerRef.current) {
                  clearTimeout(debounceTimerRef.current);
                }
                debounceTimerRef.current = setTimeout(() => {
                  if (chunkBufferRef.current) {
                    onChunk(chunkBufferRef.current);
                    chunkBufferRef.current = '';
                  }
                }, 50);
              }
            }
          }
        }
      }

      // Flush any remaining debounced chunks
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (chunkBufferRef.current) {
        onChunk(chunkBufferRef.current);
        chunkBufferRef.current = '';
      }
      
      onComplete(messageBufferRef.current);
    } catch (error) {
      // Flush on error too
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Stream aborted by user');
        onComplete(messageBufferRef.current);
        setIsStreaming(false);
        abortControllerRef.current = null;
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Streaming failed';
      const isNetworkError = errorMessage.includes('Network') || 
                            errorMessage.includes('fetch') ||
                            errorMessage.includes('timeout') ||
                            errorMessage.includes('HTTP 500') ||
                            errorMessage.includes('HTTP 503');

      // Retry only on network errors, not on 4xx errors
      if (isNetworkError && retryCount < MAX_RETRIES) {
        console.log(`🔄 Retry attempt ${retryCount + 1}/${MAX_RETRIES} after ${RETRY_DELAYS[retryCount]}ms`);
        
        setIsStreaming(false);
        abortControllerRef.current = null;
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retryCount]));
        
        // Recursive retry
        return sendMessageWithRetry(conversationId, message, retryCount + 1);
      }

      // Max retries reached or non-retryable error
      console.error('❌ Streaming error (no more retries):', error);
      onError(errorMessage);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [onChunk, onComplete, onError]);

  const sendMessage = useCallback(async (conversationId: string, message: string) => {
    setIsStreaming(true);
    messageBufferRef.current = '';
    return sendMessageWithRetry(conversationId, message, 0);
  }, [sendMessageWithRetry]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    isStreaming,
    sendMessage,
    stopStreaming,
  };
};
