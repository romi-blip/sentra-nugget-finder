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
    console.log('Starting enrichment for event:', event_id)

    // Get ZoomInfo credentials
    const zoomInfoApiKey = Deno.env.get('ZOOMINFO_API_KEY')
    const zoomInfoUsername = Deno.env.get('ZOOMINFO_USERNAME')
    const zoomInfoPassword = Deno.env.get('ZOOMINFO_PASSWORD')

    if (!zoomInfoApiKey || !zoomInfoUsername || !zoomInfoPassword) {
      throw new Error('Missing ZoomInfo credentials')
    }

    // Create processing job
    const { data: job, error: jobError } = await supabaseClient
      .from('lead_processing_jobs')
      .insert({
        event_id,
        stage: 'enrich',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (jobError) throw jobError

    // Get leads that passed validation and Salesforce check
    const { data: leads, error: leadsError } = await supabaseClient
      .from('event_leads')
      .select('*')
      .eq('event_id', event_id)
      .eq('validation_status', 'completed')
      .eq('salesforce_status', 'completed')

    if (leadsError) throw leadsError

    // Update job with total count
    await supabaseClient
      .from('lead_processing_jobs')
      .update({ total_leads: leads?.length || 0 })
      .eq('id', job.id)

    // Authenticate with ZoomInfo
    const authResponse = await fetch('https://api.zoominfo.com/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: zoomInfoUsername,
        password: zoomInfoPassword
      })
    })

    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      console.error('ZoomInfo auth failed:', authResponse.status, errorText)
      throw new Error(`ZoomInfo auth failed: ${authResponse.status} - ${errorText}`)
    }

    const authData = await authResponse.json()

    const accessToken = authData.jwt
    
    let processedCount = 0
    let failedCount = 0

    // Enrich each lead
    for (const lead of leads || []) {
      try {
        // Search for contact in ZoomInfo
        const searchResponse = await fetch('https://api.zoominfo.com/search/person', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            emails: [lead.email],
            firstName: lead.first_name,
            lastName: lead.last_name,
            companyName: lead.account_name
          })
        })

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text()
          console.error(`ZoomInfo search failed for lead ${lead.id}:`, searchResponse.status, errorText)
          throw new Error(`ZoomInfo search failed: ${searchResponse.status}`)
        }

        const searchData = await searchResponse.json()
        
        let phone1 = null
        let phone2 = null
        let companyState = null
        let companyCountry = null

        if (searchResponse.ok && searchData.data && searchData.data.length > 0) {
          const contact = searchData.data[0]
          
          // Extract phone numbers
          if (contact.phones && contact.phones.length > 0) {
            phone1 = contact.phones[0].number
            if (contact.phones.length > 1) {
              phone2 = contact.phones[1].number
            }
          }

          // Extract company location
          if (contact.company) {
            companyState = contact.company.state
            companyCountry = contact.company.country
          }
        }

        // Update lead with enrichment data
        await supabaseClient
          .from('event_leads')
          .update({
            enrichment_status: 'completed',
            zoominfo_phone_1: phone1,
            zoominfo_phone_2: phone2,
            zoominfo_company_state: companyState,
            zoominfo_company_country: companyCountry
          })
          .eq('id', lead.id)

        processedCount++
        console.log(`Enriched lead ${lead.id}`)

        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`Error enriching lead ${lead.id}:`, error)
        await supabaseClient
          .from('event_leads')
          .update({ enrichment_status: 'failed' })
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

    console.log(`Enrichment completed: ${processedCount} processed, ${failedCount} failed`)

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
    console.error('Error in leads-enrich function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})