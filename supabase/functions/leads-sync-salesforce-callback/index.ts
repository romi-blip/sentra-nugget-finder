import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify N8n API key for security
    const apiKey = req.headers.get('x-n8n-api-key')
    const expectedApiKey = Deno.env.get('N8N_API_KEY')
    
    if (!apiKey || apiKey !== expectedApiKey) {
      console.error('Invalid or missing N8n API key')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { job_id, lead_results } = await req.json()
    console.log('Processing Salesforce sync callback for job:', job_id)

    if (!job_id || !lead_results || !Array.isArray(lead_results)) {
      throw new Error('Invalid callback payload - missing job_id or lead_results')
    }

    let processedCount = 0
    let failedCount = 0

    // Update each lead with sync results
    for (const leadResult of lead_results) {
      try {
        const { 
          lead_id, 
          success, 
          salesforce_account_id, 
          salesforce_contact_id, 
          salesforce_lead_id,
          error_message 
        } = leadResult

        await supabaseClient
          .from('event_leads')
          .update({
            salesforce_status: success ? 'synced' : 'failed',
            sync_errors: success ? [] : [error_message || 'Sync failed'],
            salesforce_account_id: salesforce_account_id || null,
            salesforce_contact_id: salesforce_contact_id || null,
            salesforce_lead_id: salesforce_lead_id || null
          })
          .eq('id', lead_id)

        if (success) {
          processedCount++
        } else {
          failedCount++
        }

        console.log(`Updated lead ${lead_id}: ${success ? 'success' : 'failed'}`)

      } catch (error) {
        console.error(`Error updating lead ${leadResult.lead_id}:`, error)
        failedCount++
      }
    }

    // Update job completion
    await supabaseClient
      .from('lead_processing_jobs')
      .update({
        status: 'completed',
        processed_leads: processedCount,
        failed_leads: failedCount,
        completed_at: new Date().toISOString()
      })
      .eq('id', job_id)

    console.log(`Salesforce sync callback completed: ${processedCount} processed, ${failedCount} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        failed: failedCount,
        job_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error in leads-sync-salesforce-callback function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})