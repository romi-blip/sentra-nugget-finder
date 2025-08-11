import { useState, useCallback, useEffect } from 'react';
import { WebhookConfig, WebhookType, WebhookStorageData, DEFAULT_WEBHOOK_CONFIGS } from '@/types/webhook';
import { toast } from '@/hooks/use-toast';

const STORAGE_KEY = 'n8n_webhook_configs';
const STORAGE_VERSION = '1.0';

export const useWebhooks = () => {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load webhooks from localStorage
  const loadWebhooks = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: WebhookStorageData = JSON.parse(stored);
        setWebhooks(data.webhooks.map(w => ({
          ...w,
          lastTested: w.lastTested ? new Date(w.lastTested) : undefined,
          lastUsed: w.lastUsed ? new Date(w.lastUsed) : undefined,
        })));
      } else {
        // Check for legacy webhook URL
        const legacyUrl = localStorage.getItem('n8nWebhookUrl');
        if (legacyUrl) {
          migrateFromLegacy(legacyUrl);
        } else {
          initializeDefaults();
        }
      }
    } catch (error) {
      console.error('Failed to load webhooks:', error);
      initializeDefaults();
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize with default configs
  const initializeDefaults = () => {
    const defaultWebhooks = DEFAULT_WEBHOOK_CONFIGS.map((config, index) => ({
      ...config,
      id: `webhook_${index + 1}`,
      url: '',
    }));
    setWebhooks(defaultWebhooks);
  };

  // Migrate from legacy single webhook URL
  const migrateFromLegacy = (legacyUrl: string) => {
    const migratedWebhooks = DEFAULT_WEBHOOK_CONFIGS.map((config, index) => ({
      ...config,
      id: `webhook_${index + 1}`,
      url: config.type === 'chat' ? legacyUrl : '', // Only assign to chat webhook
    }));
    setWebhooks(migratedWebhooks);
    saveWebhooks(migratedWebhooks);
    toast({
      title: 'Webhooks Migrated',
      description: 'Your existing webhook has been migrated to the new system.',
    });
  };

  // Save webhooks to localStorage
  const saveWebhooks = useCallback((webhooksToSave: WebhookConfig[]) => {
    try {
      const data: WebhookStorageData = {
        webhooks: webhooksToSave,
        version: STORAGE_VERSION,
        lastUpdated: new Date(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setWebhooks(webhooksToSave);
    } catch (error) {
      console.error('Failed to save webhooks:', error);
      toast({
        title: 'Save Failed',
        description: 'Failed to save webhook configuration.',
        variant: 'destructive',
      });
    }
  }, []);

  // Test webhook connection
  const testWebhook = useCallback(async (webhookId: string): Promise<boolean> => {
    const webhook = webhooks.find(w => w.id === webhookId);
    if (!webhook || !webhook.url) {
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
          ...webhook.headers,
        },
        body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // Update last tested timestamp
        const updatedWebhooks = webhooks.map(w =>
          w.id === webhookId ? { ...w, lastTested: new Date() } : w
        );
        saveWebhooks(updatedWebhooks);
        
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
  }, [webhooks, saveWebhooks]);

  // Get webhook by type
  const getWebhookByType = useCallback((type: WebhookType): WebhookConfig | undefined => {
    return webhooks.find(w => w.type === type && w.enabled && w.url);
  }, [webhooks]);

  // Update webhook
  const updateWebhook = useCallback((webhookId: string, updates: Partial<WebhookConfig>) => {
    const updatedWebhooks = webhooks.map(w =>
      w.id === webhookId ? { ...w, ...updates } : w
    );
    saveWebhooks(updatedWebhooks);
  }, [webhooks, saveWebhooks]);

  // Mark webhook as used
  const markWebhookAsUsed = useCallback((type: WebhookType) => {
    const webhook = getWebhookByType(type);
    if (webhook) {
      updateWebhook(webhook.id, { lastUsed: new Date() });
    }
  }, [getWebhookByType, updateWebhook]);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  return {
    webhooks,
    isLoading,
    saveWebhooks,
    testWebhook,
    getWebhookByType,
    updateWebhook,
    markWebhookAsUsed,
    loadWebhooks,
  };
};