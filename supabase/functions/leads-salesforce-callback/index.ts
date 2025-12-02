
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate N8N API key for webhook authentication
    const apiKey = req.headers.get('x-n8n-api-key')
    const expectedApiKey = Deno.env.get('N8N_API_KEY')
    
    if (!expectedApiKey) {
      console.error('N8N_API_KEY environment variable not configured')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!apiKey || apiKey !== expectedApiKey) {
      console.warn('Unauthorized access attempt to leads-salesforce-callback')
      return new Response(
        JSON.stringify({ error: 'Unauthorized - valid API key required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { leads, job_id } = await req.json()
    console.log('Processing Salesforce callback for job:', job_id, 'with', leads?.length, 'leads')

    if (!leads || !Array.isArray(leads)) {
      throw new Error('Invalid leads data received')
    }

    let processedCount = 0
    let failedCount = 0

    // Process each lead result from N8N
    for (const leadResult of leads) {
      try {
        const {
          id,
          salesforce_status_detail,
          sf_existing_account,
          sf_existing_contact,
          sf_existing_lead,
          sf_existing_customer,
          sf_existing_opportunity,
          salesforce_lead_id,
          salesforce_account_owner_id,
          salesforce_account_sdr_owner_id,
          salesforce_account_sdr_owner_email,
          salesforce_contact_owner_id,
          salesforce_contact_sdr_owner_id
        } = leadResult

        if (!id) {
          console.error('Missing lead ID in result:', leadResult)
          failedCount++
          continue
        }

        // Determine Salesforce status based on existing flags with proper precedence
        let salesforceStatus = 'net_new' // Default for brand new records
        
        if (sf_existing_customer) {
          salesforceStatus = 'existing_customer'
        } else if (sf_existing_opportunity) {
          salesforceStatus = 'existing_opportunity'
        } else if (sf_existing_contact) {
          salesforceStatus = 'existing_contact'
        } else if (sf_existing_account) {
          salesforceStatus = 'existing_account'  
        } else if (sf_existing_lead) {
          salesforceStatus = 'existing_lead'
        }

        // Update the lead with Salesforce status information
        const { error } = await supabaseClient
          .from('event_leads')
          .update({
            salesforce_status: salesforceStatus,
            salesforce_status_detail,
            sf_existing_account: sf_existing_account || false,
            sf_existing_contact: sf_existing_contact || false,
            sf_existing_lead: sf_existing_lead || false,
            sf_existing_customer: sf_existing_customer || false,
            sf_existing_opportunity: sf_existing_opportunity || false,
            salesforce_lead_id,
            salesforce_account_owner_id,
            salesforce_account_sdr_owner_id,
            salesforce_account_sdr_owner_email,
            salesforce_contact_owner_id,
            salesforce_contact_sdr_owner_id
          })
          .eq('id', id)

        if (error) {
          console.error(`Failed to update lead ${id}:`, error)
          failedCount++
        } else {
          processedCount++
          console.log(`Updated lead ${id} with status: ${salesforceStatus} - ${salesforce_status_detail}`)
        }

      } catch (error) {
        console.error('Error processing lead result:', error)
        failedCount++
      }
    }

    // Update the job status if job_id provided
    if (job_id) {
      await supabaseClient
        .from('lead_processing_jobs')
        .update({
          status: 'completed',
          processed_leads: processedCount,
          failed_leads: failedCount,
          completed_at: new Date().toISOString()
        })
        .eq('id', job_id)
    }

    console.log(`Salesforce callback completed: ${processedCount} processed, ${failedCount} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        failed: failedCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error in leads-salesforce-callback function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
