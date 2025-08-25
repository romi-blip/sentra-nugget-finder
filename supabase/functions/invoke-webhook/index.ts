import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Extract content from various response formats
 */
const extractContent = (data: any): string => {
  if (typeof data === 'string') {
    return data;
  }
  
  if (data && typeof data === 'object') {
    // Try multiple possible response fields in order of preference
    return data.content || 
           data.output || 
           data.message || 
           data.response ||
           data.text ||
           JSON.stringify(data, null, 2);
  }
  
  if (Array.isArray(data)) {
    // Handle array responses
    if (data.length === 0) return "Empty response received.";
    if (data.length === 1) return extractContent(data[0]);
    return data.map(item => extractContent(item)).join('\n');
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
      payload: payload || {}
    }

    // Prepare headers
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...webhook.headers
    }

    console.log(`Calling webhook URL: ${webhook.url}`)

    // Call the webhook
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), webhook.timeout || 120000)

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