import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type GlobalWebhook = Database['public']['Tables']['global_webhooks']['Row'];
type WebhookInsert = Database['public']['Tables']['global_webhooks']['Insert'];
type WebhookUpdate = Database['public']['Tables']['global_webhooks']['Update'];

export const useGlobalWebhooks = () => {
  const [webhooks, setWebhooks] = useState<GlobalWebhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load webhooks from database
  const loadWebhooks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('global_webhooks')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setWebhooks(data || []);
    } catch (error) {
      console.error('Failed to load webhooks:', error);
      toast({
        title: 'Load Failed',
        description: 'Failed to load webhook configurations.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save webhook
  const saveWebhook = useCallback(async (webhook: WebhookUpdate & { id: string }) => {
    try {
      const { error } = await supabase
        .from('global_webhooks')
        .update(webhook)
        .eq('id', webhook.id);

      if (error) throw error;
      
      await loadWebhooks(); // Reload to get updated data
      
      toast({
        title: 'Webhook Saved',
        description: 'Webhook configuration has been updated.',
      });
    } catch (error) {
      console.error('Failed to save webhook:', error);
      toast({
        title: 'Save Failed',
        description: 'Failed to save webhook configuration.',
        variant: 'destructive',
      });
    }
  }, [loadWebhooks]);

  // Test webhook connection
  const testWebhook = useCallback(async (webhook: GlobalWebhook): Promise<boolean> => {
    if (!webhook.url) {
      toast({
        title: 'Test Failed',
        description: 'Webhook URL is required for testing.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), webhook.timeout);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhook.headers as Record<string, string> || {}),
        },
        body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // Update last tested timestamp
        await saveWebhook({
          id: webhook.id,
          last_tested: new Date().toISOString(),
        });
        
        toast({
          title: 'Connection Success',
          description: `${webhook.name} is responding correctly.`,
        });
        return true;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Connection Failed',
        description: `${webhook.name}: ${errorMessage}`,
        variant: 'destructive',
      });
      return false;
    }
  }, [saveWebhook]);

  // Get webhook by type
  const getWebhookByType = useCallback((type: string): GlobalWebhook | undefined => {
    return webhooks.find(w => w.type === type && w.enabled && w.url);
  }, [webhooks]);

  // Mark webhook as used
  const markWebhookAsUsed = useCallback(async (type: string) => {
    const webhook = getWebhookByType(type);
    if (webhook) {
      await saveWebhook({
        id: webhook.id,
        last_used: new Date().toISOString(),
      });
    }
  }, [getWebhookByType, saveWebhook]);

  useEffect(() => {
    loadWebhooks();

    // Set up real-time subscription
    const subscription = supabase
      .channel('global_webhooks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'global_webhooks'
        },
        () => {
          loadWebhooks();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [loadWebhooks]);

  return {
    webhooks,
    isLoading,
    saveWebhook,
    testWebhook,
    getWebhookByType,
    markWebhookAsUsed,
    loadWebhooks,
  };
};