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

export interface ChatJob {
  id: string;
  user_id: string;
  conversation_id: string;
  webhook_type: string;
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  created_at: string;
  completed_at?: string;
  updated_at: string;
}

/**
 * Create an async chat job that will be processed by webhook callback
 */
export const createChatJob = async (
  conversationId: string,
  payload: WebhookPayload
): Promise<{ jobId: string; error?: any }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { jobId: '', error: { message: 'User not authenticated' } };
    }

    const { data, error } = await supabase
      .from('chat_jobs')
      .insert({
        user_id: user.id,
        conversation_id: conversationId,
        webhook_type: 'chat',
        payload,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create chat job:', error);
      return { jobId: '', error };
    }

    // Invoke webhook with job ID for callback
    const callbackUrl = `https://gmgrlphiopslkyxmuced.supabase.co/functions/v1/webhook-callback`;
    const { error: webhookError } = await supabase.functions.invoke('invoke-webhook', {
      body: {
        type: 'chat',
        payload: {
          ...payload,
          jobId: data.id,
          callbackUrl
        }
      }
    });

    if (webhookError) {
      console.error('Failed to invoke webhook:', webhookError);
      // Update job status to failed
      await supabase
        .from('chat_jobs')
        .update({ status: 'failed', error: webhookError.message })
        .eq('id', data.id);
      return { jobId: '', error: webhookError };
    }

    // Update status to processing
    await supabase
      .from('chat_jobs')
      .update({ status: 'processing' })
      .eq('id', data.id);

    return { jobId: data.id };
  } catch (error) {
    console.error('Chat job creation failed:', error);
    return { jobId: '', error };
  }
};

/**
 * Get job status and result
 */
export const getChatJob = async (jobId: string): Promise<{ job: ChatJob | null; error?: any }> => {
  try {
    const { data, error } = await supabase
      .from('chat_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error('Failed to get chat job:', error);
      return { job: null, error };
    }

    return { job: data as ChatJob };
  } catch (error) {
    console.error('Get chat job failed:', error);
    return { job: null, error };
  }
};

/**
 * Invoke a global webhook without exposing webhook URLs or secrets to client code.
 * All users can use configured webhooks, but only super_admins can manage them.
 * @deprecated Use createChatJob for async processing instead
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
 * @deprecated Use createChatJob for async processing instead
 */
export const webhookService = {
  chat: (payload?: WebhookPayload) => invokeWebhook('chat', payload),
  fileUpload: (payload?: WebhookPayload) => invokeWebhook('file_upload', payload),
  googleDrive: (payload?: WebhookPayload) => invokeWebhook('google_drive', payload),
};