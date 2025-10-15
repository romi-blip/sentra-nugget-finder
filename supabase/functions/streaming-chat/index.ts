import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // User authentication client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { conversationId, message } = await req.json();
    
    console.log('Streaming chat request:', { conversationId, message: message.substring(0, 50) });

    // Admin client to bypass RLS for webhook config (server-side only)
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Using admin client to fetch webhook configuration for type: chat');

    // Get webhook URL from global_webhooks using admin client
    const { data: webhook, error: webhookError } = await adminSupabase
      .from('global_webhooks')
      .select('url')
      .eq('type', 'chat')
      .eq('enabled', true)
      .single();

    if (webhookError || !webhook?.url) {
      console.error('Failed to fetch webhook config:', webhookError);
      throw new Error('Chat webhook not configured');
    }

    console.log('Using webhook URL:', webhook.url);

    // Create readable stream for SSE with timeout protection
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const WEBHOOK_TIMEOUT = 60000; // 60 seconds timeout
        
        try {
          // Create AbortController for timeout
          const abortController = new AbortController();
          const timeoutId = setTimeout(() => {
            console.error('⏱️ Webhook timeout after 60 seconds');
            abortController.abort();
          }, WEBHOOK_TIMEOUT);

          console.log('🚀 Calling webhook at:', new Date().toISOString());
          
          // Call the streaming webhook with timeout
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message,
              conversationId,
              timestamp: new Date().toISOString(),
              userId: user.id,
            }),
            signal: abortController.signal,
          });

          // Clear timeout on successful response
          clearTimeout(timeoutId);

          console.log('📥 Webhook response status:', response.status);

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'No error details');
            console.error('❌ Webhook error:', {
              status: response.status,
              statusText: response.statusText,
              error: errorText,
              url: webhook.url,
            });
            
            // Provide user-friendly error messages
            let errorMessage = 'The AI service encountered an error.';
            if (response.status === 429) {
              errorMessage = 'Too many requests. Please wait a moment and try again.';
            } else if (response.status === 503) {
              errorMessage = 'The AI service is temporarily unavailable. Please try again in a moment.';
            } else if (response.status >= 500) {
              errorMessage = `Service error (${response.status}). Our team has been notified.`;
            } else if (response.status === 404) {
              errorMessage = 'AI service configuration error. Please contact support.';
            }
            
            throw new Error(errorMessage);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body');
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('Stream complete');
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                console.log('Streaming chunk:', line.substring(0, 100));
                controller.enqueue(encoder.encode(`data: ${line}\n\n`));
              }
            }
          }

          // Send any remaining data
          if (buffer.trim()) {
            controller.enqueue(encoder.encode(`data: ${buffer}\n\n`));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('❌ Streaming error:', error);
          
          let userMessage = 'An unexpected error occurred.';
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              userMessage = 'Request timed out. The question might be too complex. Please try a simpler query.';
            } else if (error.message.includes('fetch')) {
              userMessage = 'Network error. Please check your connection and try again.';
            } else {
              userMessage = error.message;
            }
          }
          
          console.error('📤 Sending error to client:', userMessage);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: userMessage })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in streaming-chat function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
