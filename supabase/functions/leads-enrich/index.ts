import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// ZoomInfo Enterprise API base URL
const ZI_BASE_URL = Deno.env.get('ZOOMINFO_BASE_URL') || 'https://api.zoominfo.com'

// Helper: sleep for ms
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

// Helper: fetch with retry (handles 429/5xx with exponential backoff)
async function fetchWithRetry(url: string, init: RequestInit, opts?: { retries?: number; minDelayMs?: number; maxDelayMs?: number }) {
  const retries = opts?.retries ?? 3
  const minDelayMs = opts?.minDelayMs ?? 300
  const maxDelayMs = opts?.maxDelayMs ?? 2000

  let attempt = 0
  let lastErr: any

  while (attempt <= retries) {
    const res = await fetch(url, init)

    // Success
    if (res.ok) return res

    // If 429 or 5xx, backoff and retry
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      const retryAfter = res.headers.get('Retry-After')
      const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(maxDelayMs, minDelayMs * Math.pow(2, attempt))
      await sleep(delay)
      attempt++
      continue
    }

    // Other errors - capture and break
    lastErr = new Error(`${res.status} ${res.statusText}: ${await res.text()}`)
    break
  }

  throw lastErr ?? new Error('Request failed with unknown error')
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let supabaseClient: ReturnType<typeof createClient> | null = null
  let job: any | null = null

  try {
    // Init Supabase admin client
    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { event_id } = await req.json()
    if (!event_id) {
      return new Response(JSON.stringify({ success: false, error: 'Missing event_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log('Starting enrichment for event:', event_id)

    // ZoomInfo creds
    const zoomInfoApiKey = Deno.env.get('ZOOMINFO_API_KEY')
    const zoomInfoUsername = Deno.env.get('ZOOMINFO_USERNAME')
    const zoomInfoPassword = Deno.env.get('ZOOMINFO_PASSWORD')

    if (!zoomInfoApiKey || !zoomInfoUsername || !zoomInfoPassword) {
      throw new Error('Missing ZoomInfo credentials')
    }

    // Create processing job
    {
      const { data, error } = await (supabaseClient as any)
        .from('lead_processing_jobs')
        .insert({
          event_id,
          stage: 'enrich',
          status: 'running',
          started_at: new Date().toISOString(),
          processed_leads: 0,
          failed_leads: 0
        })
        .select()
        .single()
      if (error) throw error
      job = data
    }

    // Get leads that passed validation and Salesforce check
    const { data: leads, error: leadsError } = await (supabaseClient as any)
      .from('event_leads')
      .select('*')
      .eq('event_id', event_id)
      .eq('validation_status', 'completed')
      .eq('salesforce_status', 'completed')

    if (leadsError) throw leadsError

    const totalLeads = leads?.length || 0

    // Update job with total count
    await (supabaseClient as any)
      .from('lead_processing_jobs')
      .update({ total_leads: totalLeads })
      .eq('id', job.id)

    if (!leads || leads.length === 0) {
      await (supabaseClient as any)
        .from('lead_processing_jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', job.id)

      return new Response(JSON.stringify({ success: true, processed: 0, failed: 0, job_id: job.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Authenticate with ZoomInfo
    const authRes = await fetchWithRetry(`${ZI_BASE_URL}/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: zoomInfoUsername, password: zoomInfoPassword })
    }, { retries: 2, minDelayMs: 300, maxDelayMs: 1500 })

    const authData = await authRes.json()
    const accessToken = authData?.jwt
    if (!accessToken) {
      throw new Error('ZoomInfo auth failed: missing jwt in response')
    }

    let processedCount = 0
    let failedCount = 0

    // Per-lead enrichment
    for (const lead of leads) {
      const attemptedEndpoints: { path: string; status?: number; note?: string }[] = []

      try {
        // Build common headers
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': zoomInfoApiKey,
          'Content-Type': 'application/json'
        }

        // 1) Try Person Search first (corrected path: /search/person)
        const searchBody: Record<string, any> = {}
        if (lead?.email) searchBody.emails = [lead.email]
        if (lead?.first_name) searchBody.firstName = lead.first_name
        if (lead?.last_name) searchBody.lastName = lead.last_name
        if (lead?.account_name) searchBody.companyName = lead.account_name

        let contact: any = null

        if (Object.keys(searchBody).length > 0) {
          const searchPath = '/search/person'
          attemptedEndpoints.push({ path: searchPath })
          const searchRes = await fetchWithRetry(`${ZI_BASE_URL}${searchPath}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(searchBody)
          })

          const searchData = await searchRes.json()

          if (Array.isArray(searchData?.data) && searchData.data.length > 0) {
            contact = searchData.data[0]
          } else if (Array.isArray(searchData) && searchData.length > 0) {
            contact = searchData[0]
          } else if (searchData && typeof searchData === 'object') {
            contact = searchData
          }
        }

        // Fallback: if no contact found but we have email, try enrich endpoint (path: /enrich/person)
        if (!contact && lead?.email) {
          const enrichPath = '/enrich/person'
          attemptedEndpoints.push({ path: enrichPath })
          const enrichRes = await fetchWithRetry(`${ZI_BASE_URL}${enrichPath}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'apikey': zoomInfoApiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: lead.email })
          })

          const enrichData = await enrichRes.json()
          if (enrichData) {
            contact = Array.isArray(enrichData?.data) && enrichData.data.length > 0 ? enrichData.data[0] : enrichData
          }
        }

        let phone1: string | null = null
        let phone2: string | null = null
        let companyState: string | null = null
        let companyCountry: string | null = null

        if (contact) {
          // Extract phone numbers robustly
          const phones = (contact.phones ?? contact.phoneNumbers ?? contact.phoneList ?? []) as any[]
          if (Array.isArray(phones) && phones.length > 0) {
            const p0 = phones[0]
            phone1 = typeof p0 === 'string' ? p0 : (p0.number ?? p0.phone ?? null)
            if (phones.length > 1) {
              const p1 = phones[1]
              phone2 = typeof p1 === 'string' ? p1 : (p1.number ?? p1.phone ?? null)
            }
          } else if (contact.phone) {
            phone1 = contact.phone
          }

          // Extract company location
          const comp = contact.company ?? contact.currentCompany ?? null
          if (comp) {
            companyState = comp.state || comp.stateCode || comp.companyState || null
            companyCountry = comp.country || comp.countryCode || comp.companyCountry || null
          } else {
            companyState = contact.companyState || contact.company_state || null
            companyCountry = contact.companyCountry || contact.company_country || null
          }
        }

        // Update lead with enrichment data
        await (supabaseClient as any)
          .from('event_leads')
          .update({
            enrichment_status: 'completed',
            zoominfo_phone_1: phone1,
            zoominfo_phone_2: phone2,
            zoominfo_company_state: companyState,
            zoominfo_company_country: companyCountry,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lead.id)

        processedCount++

        // Update job progress after each lead
        await (supabaseClient as any)
          .from('lead_processing_jobs')
          .update({ processed_leads: processedCount, failed_leads: failedCount, updated_at: new Date().toISOString() })
          .eq('id', job.id)

        console.log(`Enriched lead ${lead.id}`)

        // Rate limiting - wait a bit between requests
        await sleep(120)
      } catch (err: any) {
        console.error(`Error enriching lead ${lead?.id}:`, err?.message || err)

        // Mark lead as failed with sync_errors entry
        try {
          await (supabaseClient as any)
            .from('event_leads')
            .update({
              enrichment_status: 'failed',
              sync_errors: [
                {
                  stage: 'enrich',
                  error: String(err?.message || err),
                  timestamp: new Date().toISOString(),
                  attempted_endpoints: attemptedEndpoints,
                },
              ],
              updated_at: new Date().toISOString(),
            })
            .eq('id', lead.id)
        } catch (updateErr) {
          console.error('Failed to update lead failure status:', updateErr)
        }

        failedCount++

        // Update job progress after failure
        try {
          await (supabaseClient as any)
            .from('lead_processing_jobs')
            .update({ processed_leads: processedCount, failed_leads: failedCount, updated_at: new Date().toISOString() })
            .eq('id', job.id)
        } catch (jobErr) {
          console.error('Failed to update job progress:', jobErr)
        }

        // Small pause before next lead
        await sleep(120)
      }
    }

    // Update job completion
    await (supabaseClient as any)
      .from('lead_processing_jobs')
      .update({
        status: 'completed',
        processed_leads: processedCount,
        failed_leads: failedCount,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    console.log(`Enrichment completed: ${processedCount} processed, ${failedCount} failed`)

    return new Response(
      JSON.stringify({ success: true, processed: processedCount, failed: failedCount, job_id: job.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in leads-enrich function:', error?.message || error)

    // Best effort: update job status
    try {
      if (supabaseClient && job?.id) {
        await (supabaseClient as any)
          .from('lead_processing_jobs')
          .update({
            status: 'failed',
            error_message: String(error?.message || error),
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
        console.log(`Updated job ${job.id} to failed status`)
      }
    } catch (jobUpdateError) {
      console.error('Failed to update job status:', jobUpdateError)
    }

    return new Response(
      JSON.stringify({ success: false, error: String(error?.message || error), timestamp: new Date().toISOString() }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
