import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { event_id, lead_ids } = await req.json()
    console.log('Starting Salesforce sync for event:', event_id, 'with leads:', lead_ids)

    // Get N8n webhook URL
    const n8nWebhookUrl = 'https://sentra.app.n8n.cloud/webhook/57567e54-4e70-42d0-a694-d0a05711cce5'

    // Create processing job
    const { data: job, error: jobError } = await supabaseClient
      .from('lead_processing_jobs')
      .insert({
        event_id,
        stage: 'sync',
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (jobError) throw jobError

    // Get leads for sync - either specific leads or all qualified leads
    let leadsQuery = supabaseClient
      .from('event_leads')
      .select('*')
      .eq('event_id', event_id)

    // If specific lead IDs provided, filter by them
    if (lead_ids && lead_ids.length > 0) {
      leadsQuery = leadsQuery.in('id', lead_ids)
    } else {
      // Otherwise, get all leads that passed validation and enrichment
      leadsQuery = leadsQuery
        .eq('validation_status', 'completed')
        .eq('enrichment_status', 'completed')
    }

    const { data: leads, error: leadsError } = await leadsQuery

    if (leadsError) throw leadsError

    // Update job with total count
    await supabaseClient
      .from('lead_processing_jobs')
      .update({ total_leads: leads?.length || 0 })
      .eq('id', job.id)

    // Trigger N8n webhook for Salesforce sync
    const webhookPayload = {
      event_id,
      lead_ids: lead_ids || null,
      job_id: job.id,
      leads_count: leads?.length || 0
    }

    console.log('Triggering N8n webhook with payload:', webhookPayload)

    const webhookResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    })

    if (!webhookResponse.ok) {
      // Update job status to failed
      await supabaseClient
        .from('lead_processing_jobs')
        .update({ 
          status: 'failed', 
          error_message: 'Failed to trigger N8n webhook',
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id)

      const text = await webhookResponse.text()
      console.error('N8n webhook error:', webhookResponse.status, text)
      throw new Error(`N8n webhook failed: ${webhookResponse.status} ${text}`)
    }

    console.log('N8n webhook triggered successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Salesforce sync initiated successfully',
        job_id: job.id,
        leads_count: leads?.length || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error in leads-sync-salesforce function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})