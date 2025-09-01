
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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

    // Create processing job
    const { data: job, error: jobError } = await supabaseClient
      .from('lead_processing_jobs')
      .insert({
        event_id,
        stage: 'check_salesforce',
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (jobError) throw jobError

    // Get validated leads
    const { data: leads, error: leadsError } = await supabaseClient
      .from('event_leads')
      .select('*')
      .eq('event_id', event_id)
      .eq('validation_status', 'completed')

    if (leadsError) throw leadsError

    if (!leads || leads.length === 0) {
      await supabaseClient
        .from('lead_processing_jobs')
        .update({
          status: 'completed',
          total_leads: 0,
          processed_leads: 0,
          failed_leads: 0,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'No validated leads to process',
          processed: 0,
          job_id: job.id
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Update job with total count
    await supabaseClient
      .from('lead_processing_jobs')
      .update({ total_leads: leads.length })
      .eq('id', job.id)

    // Prepare leads data for N8N webhook
    const leadsForWebhook = leads.map(lead => ({
      id: lead.id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      account_name: lead.account_name,
      title: lead.title,
      phone: lead.phone,
      mobile: lead.mobile,
      mailing_city: lead.mailing_city,
      mailing_state_province: lead.mailing_state_province,
      mailing_country: lead.mailing_country
    }))

    // Send to N8N webhook
    const webhookUrl = 'https://sentra.app.n8n.cloud/webhook/572ccfec-0a34-43c0-b23a-952c7ffcbfc0'
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/leads-salesforce-callback`
    
    console.log('Sending leads to N8N webhook:', webhookUrl)
    
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leads: leadsForWebhook,
        job_id: job.id,
        callback_url: callbackUrl,
        event_id: event_id
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

    console.log(`Salesforce check initiated: ${leads.length} leads sent to N8N for processing`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Salesforce check initiated',
        leads_sent: leads.length,
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
