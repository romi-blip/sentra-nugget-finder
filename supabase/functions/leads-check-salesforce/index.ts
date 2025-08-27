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

    // Check each lead in Salesforce
    for (const lead of leads || []) {
      try {
        // Search for existing contact by email
        const contactQuery = `SELECT Id, Account.Id, Account.Name, Owner.Id, Account.Owner.Id FROM Contact WHERE Email = '${lead.email}' LIMIT 1`
        const contactResponse = await fetch(
          `${instanceUrl}/services/data/v57.0/query?q=${encodeURIComponent(contactQuery)}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        )

        const contactData = await contactResponse.json()
        
        let salesforceStatus = 'new_account_new_contact'
        let accountId = null
        let contactId = null
        let ownerId = null
        let sdrOwnerId = null

        if (contactData.records && contactData.records.length > 0) {
          const contact = contactData.records[0]
          contactId = contact.Id
          accountId = contact.Account.Id
          ownerId = contact.Owner.Id
          sdrOwnerId = contact.Account.Owner.Id
          salesforceStatus = 'existing_account_existing_contact'
        } else {
          // Search for existing account by name
          const accountQuery = `SELECT Id, Owner.Id FROM Account WHERE Name = '${lead.account_name.replace(/'/g, "\\'")}' LIMIT 1`
          const accountResponse = await fetch(
            `${instanceUrl}/services/data/v57.0/query?q=${encodeURIComponent(accountQuery)}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          )

          const accountData = await accountResponse.json()
          if (accountData.records && accountData.records.length > 0) {
            const account = accountData.records[0]
            accountId = account.Id
            sdrOwnerId = account.Owner.Id
            salesforceStatus = 'existing_account_new_contact'
          }
        }

        // Update lead with Salesforce status
        await supabaseClient
          .from('event_leads')
          .update({
            salesforce_status: 'completed',
            salesforce_account_id: accountId,
            salesforce_contact_id: contactId,
            salesforce_owner_id: ownerId,
            salesforce_sdr_owner_id: sdrOwnerId
          })
          .eq('id', lead.id)

        processedCount++
        console.log(`Checked lead ${lead.id}: ${salesforceStatus}`)

      } catch (error) {
        console.error(`Error checking lead ${lead.id}:`, error)
        await supabaseClient
          .from('event_leads')
          .update({ salesforce_status: 'failed' })
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

    console.log(`Salesforce check completed: ${processedCount} processed, ${failedCount} failed`)

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