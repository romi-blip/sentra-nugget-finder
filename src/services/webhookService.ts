import { supabase } from '@/integrations/supabase/client';

export type WebhookType = 'chat' | 'file_upload' | 'google_drive';

export interface WebhookPayload {
  [key: string]: any;
}

export interface WebhookResponse {
  success: boolean;
  status: number;
  data: any;
}

/**
 * Invoke a global webhook without exposing webhook URLs or secrets to client code.
 * All users can use configured webhooks, but only super_admins can manage them.
 */
export const invokeWebhook = async (
  type: WebhookType,
  payload?: WebhookPayload
): Promise<WebhookResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('invoke-webhook', {
      body: { type, payload }
    });

    if (error) {
      throw new Error(error.message || 'Failed to invoke webhook');
    }

    return data;
  } catch (error) {
    console.error('Webhook invocation failed:', error);
    throw error;
  }
};

/**
 * Convenience methods for specific webhook types
 */
export const webhookService = {
  chat: (payload?: WebhookPayload) => invokeWebhook('chat', payload),
  fileUpload: (payload?: WebhookPayload) => invokeWebhook('file_upload', payload),
  googleDrive: (payload?: WebhookPayload) => invokeWebhook('google_drive', payload),
};