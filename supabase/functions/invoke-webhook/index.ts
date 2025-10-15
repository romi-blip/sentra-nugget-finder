import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Extract content from various response formats
 */
const extractContent = (data: any): string => {
  if (typeof data === 'string') {
    // Try to parse JSON-like strings first
    const trimmed = data.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(data);
        return extractContent(parsed);
      } catch (e) {
        // Not valid JSON, return as-is
        return data;
      }
    }
    return data;
  }
  
  // Handle arrays first - with deduplication
  if (Array.isArray(data)) {
    if (data.length === 0) return "Empty response received.";
    
    // Extract content from all array items
    const contents = data.map(item => extractContent(item)).filter(content => content && content.trim());
    
    // Remove duplicates and very similar content
    const uniqueContents = contents.filter((content, index) => {
      // Keep if it's the first occurrence or significantly different from previous ones
      return contents.findIndex(c => c === content || (c.length > 100 && content.length > 100 && c.substring(0, 100) === content.substring(0, 100))) === index;
    });
    
    if (uniqueContents.length === 0) return "No valid content found in array.";
    if (uniqueContents.length === 1) return uniqueContents[0];
    
    // Join multiple unique contents
    return uniqueContents.join('\n\n---\n\n');
  }
  
  if (data && typeof data === 'object') {
    // Deep search for content fields - handle nested structures
    const deepExtract = (obj: any, visited = new Set()): string | null => {
      if (!obj || typeof obj !== 'object' || visited.has(obj)) return null;
      visited.add(obj);
      
      // Check direct content fields first
      const contentFields = ['content', 'output', 'message', 'response', 'text'];
      for (const field of contentFields) {
        if (obj[field] && typeof obj[field] === 'string' && obj[field].trim()) {
          return obj[field];
        }
      }
      
      // Recursively search nested objects
      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object') {
          const found = deepExtract(value, visited);
          if (found) return found;
        }
      }
      
      return null;
    };
    
    const extracted = deepExtract(data);
    if (extracted) return extracted;
    
    // Fallback to stringified JSON if no content found
    return JSON.stringify(data, null, 2);
  }
  
  return "Unable to extract content from response.";
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid authorization')
    }

    const { type, payload } = await req.json()

    if (!type) {
      throw new Error('Webhook type is required')
    }

    console.log(`Invoking webhook of type: ${type} for user: ${user.email}`)
    console.log('Using service role client to fetch webhook configuration (bypasses RLS)')

    // Auto-create chat job if missing jobId for chat webhooks
    let enhancedPayload = payload || {};
    if (type === 'chat' && !enhancedPayload.jobId) {
      console.log('Auto-creating chat job for request without jobId')
      
      const conversationId = enhancedPayload.sessionId || `temp_${Date.now()}`;
      const { data: jobData, error: jobError } = await supabaseClient
        .from('chat_jobs')
        .insert({
          user_id: user.id,
          conversation_id: conversationId,
          webhook_type: 'chat',
          payload: enhancedPayload,
          status: 'pending'
        })
        .select()
        .single();

      if (jobError) {
        console.error('Failed to auto-create chat job:', jobError);
        throw new Error(`Failed to create chat job: ${jobError.message}`);
      }

      // Enhance payload with jobId and callbackUrl
      enhancedPayload = {
        ...enhancedPayload,
        jobId: jobData.id,
        callbackUrl: `https://gmgrlphiopslkyxmuced.supabase.co/functions/v1/webhook-callback`
      };
      
      console.log(`Auto-created chat job with ID: ${jobData.id}`);
      
      // Update job status to processing after webhook call
      await supabaseClient
        .from('chat_jobs')
        .update({ status: 'processing' })
        .eq('id', jobData.id);
    }

    // Get the global webhook configuration
    const { data: webhook, error: webhookError } = await supabaseClient
      .from('global_webhooks')
      .select('*')
      .eq('type', type)
      .eq('enabled', true)
      .single()

    if (webhookError) {
      if (webhookError.code === 'PGRST116') {
        throw new Error(`No enabled webhook found for type: ${type}`)
      }
      throw new Error(`Failed to fetch webhook: ${webhookError.message}`)
    }

    if (!webhook.url) {
      throw new Error(`Webhook URL not configured for type: ${type}`)
    }

    // Prepare the webhook payload
    const webhookPayload = {
      type,
      user_id: user.id,
      user_email: user.email,
      timestamp: new Date().toISOString(),
      payload: enhancedPayload
    }

    // Prepare headers
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...webhook.headers
    }

    console.log(`Calling webhook URL: ${webhook.url}`)

    // Call the webhook
    const controller = new AbortController()
    const timeoutMs = webhook.timeout || 180000
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(webhookPayload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Update last_used timestamp
      await supabaseClient
        .from('global_webhooks')
        .update({ last_used: new Date().toISOString() })
        .eq('id', webhook.id)

      const responseText = await response.text()
      let responseData
      try {
        responseData = JSON.parse(responseText)
      } catch {
        responseData = responseText
      }

      // Standardize response shape for consistent client handling
      const standardizedData = {
        content: extractContent(responseData),
        format: "markdown",
        raw: responseData // for debugging
      }

      console.log(`Webhook response: ${response.status}, content length: ${standardizedData.content.length}`)

      return new Response(
        JSON.stringify({
          success: response.ok,
          status: response.status,
          data: standardizedData
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )

    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error.name === 'AbortError') {
        throw new Error(`Webhook timeout after ${webhook.timeout}ms`)
      }
      
      throw new Error(`Webhook call failed: ${error.message}`)
    }

  } catch (error) {
    console.error('Error in invoke-webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})