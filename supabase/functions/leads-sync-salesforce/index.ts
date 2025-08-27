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
    console.log('Starting Salesforce sync for event:', event_id)

    // Get Salesforce credentials
    const salesforceUrl = Deno.env.get('SALESFORCE_URL')
    const salesforceUsername = Deno.env.get('SALESFORCE_USERNAME')
    const salesforcePassword = Deno.env.get('SALESFORCE_PASSWORD')
    const salesforceToken = Deno.env.get('SALESFORCE_SECURITY_TOKEN')

    if (!salesforceUrl || !salesforceUsername || !salesforcePassword || !salesforceToken) {
      throw new Error('Missing Salesforce credentials')
    }

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

    // Get enriched leads
    const { data: leads, error: leadsError } = await supabaseClient
      .from('event_leads')
      .select('*')
      .eq('event_id', event_id)
      .eq('enrichment_status', 'completed')

    if (leadsError) throw leadsError

    // Update job with total count
    await supabaseClient
      .from('lead_processing_jobs')
      .update({ total_leads: leads?.length || 0 })
      .eq('id', job.id)

    // Authenticate with Salesforce
    const authResponse = await fetch(`${salesforceUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: Deno.env.get('SALESFORCE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('SALESFORCE_CLIENT_SECRET') ?? '',
        username: salesforceUsername,
        password: salesforcePassword + salesforceToken
      })
    })

    const authData = await authResponse.json()
    if (!authResponse.ok) {
      throw new Error(`Salesforce auth failed: ${authData.error_description}`)
    }

    const accessToken = authData.access_token
    const instanceUrl = authData.instance_url
    
    let processedCount = 0
    let failedCount = 0

    // Sync each lead to Salesforce
    for (const lead of leads || []) {
      try {
        let syncErrors = []

        // Create or update account if needed
        let accountId = lead.salesforce_account_id
        if (!accountId) {
          const accountData = {
            Name: lead.account_name,
            Type: 'Prospect'
          }

          const accountResponse = await fetch(`${instanceUrl}/services/data/v57.0/sobjects/Account`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(accountData)
          })

          const accountResult = await accountResponse.json()
          if (accountResponse.ok) {
            accountId = accountResult.id
          } else {
            syncErrors.push(`Account creation failed: ${accountResult[0]?.message}`)
          }
        }

        // Create or update contact
        let contactId = lead.salesforce_contact_id
        if (accountId && !contactId) {
          const contactData = {
            FirstName: lead.first_name,
            LastName: lead.last_name,
            Email: lead.email,
            AccountId: accountId,
            Phone: lead.phone || lead.zoominfo_phone_1,
            MobilePhone: lead.mobile || lead.zoominfo_phone_2,
            MailingStreet: lead.mailing_street,
            MailingCity: lead.mailing_city,
            MailingState: lead.mailing_state_province || lead.zoominfo_company_state,
            MailingPostalCode: lead.mailing_zip_postal_code,
            MailingCountry: lead.mailing_country || lead.zoominfo_company_country,
            Title: lead.title,
            LeadSource: lead.latest_lead_source || 'Event',
            Description: lead.notes
          }

          const contactResponse = await fetch(`${instanceUrl}/services/data/v57.0/sobjects/Contact`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(contactData)
          })

          const contactResult = await contactResponse.json()
          if (contactResponse.ok) {
            contactId = contactResult.id
          } else {
            syncErrors.push(`Contact creation failed: ${contactResult[0]?.message}`)
          }
        }

        // Update lead with sync results
        await supabaseClient
          .from('event_leads')
          .update({
            sync_status: syncErrors.length > 0 ? 'failed' : 'completed',
            sync_errors: syncErrors,
            salesforce_account_id: accountId,
            salesforce_contact_id: contactId
          })
          .eq('id', lead.id)

        if (syncErrors.length > 0) {
          failedCount++
        } else {
          processedCount++
        }

        console.log(`Synced lead ${lead.id}: ${syncErrors.length > 0 ? 'failed' : 'success'}`)

      } catch (error) {
        console.error(`Error syncing lead ${lead.id}:`, error)
        await supabaseClient
          .from('event_leads')
          .update({
            sync_status: 'failed',
            sync_errors: [error.message]
          })
          .eq('id', lead.id)
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
      .eq('id', job.id)

    console.log(`Salesforce sync completed: ${processedCount} processed, ${failedCount} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        failed: failedCount,
        job_id: job.id
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