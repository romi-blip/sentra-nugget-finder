
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

    const { event_id } = await req.json()
    console.log('Starting Salesforce check for event:', event_id)

    // Get count of valid leads to set total_leads
    const { count: validLeadsCount } = await supabaseClient
      .from('event_leads')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', event_id)
      .eq('validation_status', 'completed')

    // Create processing job
    const { data: job, error: jobError } = await supabaseClient
      .from('lead_processing_jobs')
      .insert({
        event_id,
        stage: 'check_salesforce',
        status: 'running',
        total_leads: validLeadsCount || 0,
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (jobError) throw jobError

    // Send minimal trigger to N8N webhook
    const webhookUrl = 'https://sentra.app.n8n.cloud/webhook/572ccfec-0a34-43c0-b23a-952c7ffcbfc0'
    
    console.log('Triggering N8N Salesforce check workflow:', webhookUrl)
    
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_id: event_id,
        job_id: job.id,
        trigger: 'check_salesforce'
      })
    })

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text()
      console.error('N8N webhook failed:', webhookResponse.status, errorText)
      
      // Update job as failed
      await supabaseClient
        .from('lead_processing_jobs')
        .update({
          status: 'failed',
          error_message: `Webhook failed: ${webhookResponse.status} ${errorText}`,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id)

      throw new Error(`Webhook failed: ${webhookResponse.status} ${errorText}`)
    }

    const webhookResult = await webhookResponse.text()
    console.log('N8N webhook response:', webhookResult)

    console.log('Salesforce check triggered successfully for event:', event_id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Salesforce check initiated',
        job_id: job.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error in leads-check-salesforce function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
