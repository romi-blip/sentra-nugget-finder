import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-n8n-api-key, x-job-id',
}

interface CallbackPayload {
  status: 'completed' | 'failed';
  result?: any;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Validate N8N API Key
    const n8nApiKey = Deno.env.get('N8N_API_KEY')
    const providedKey = req.headers.get('x-n8n-api-key') || 
                       req.headers.get('authorization')?.replace('Bearer ', '')

    if (!providedKey || providedKey !== n8nApiKey) {
      console.log('Invalid or missing N8N API key')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get jobId from header
    const jobId = req.headers.get('x-job-id')
    
    // Parse request body
    const payload: CallbackPayload = await req.json()
    console.log('Received callback payload:', payload)
    console.log('JobId from header:', jobId)

    const { status, result, error } = payload

    if (!jobId || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: x-job-id header and status in body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Update job status in chat_jobs table
    const { error: updateError } = await supabase
      .from('chat_jobs')
      .update({
        status,
        result: status === 'completed' ? result : null,
        error: status === 'failed' ? error : null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (updateError) {
      console.error('Error updating job status:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update job status' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Successfully updated job ${jobId} with status: ${status}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Job status updated successfully' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Webhook callback error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})