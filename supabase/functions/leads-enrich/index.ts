import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
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

  // Init Supabase admin client
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { event_id } = await req.json()
    if (!event_id) {
      return new Response(JSON.stringify({ success: false, error: 'Missing event_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log('Starting enrichment request for event:', event_id)

    // Get candidate leads and count upfront
    const { data: leads, error: leadsError } = await supabaseClient
      .from('event_leads')
      .select('*')
      .eq('event_id', event_id)
      .eq('validation_status', 'completed')
      .eq('salesforce_status', 'completed')

    if (leadsError) throw leadsError

    const totalLeads = leads?.length || 0

    // Supersede any existing running enrich jobs for this event
    try {
      await supabaseClient
        .from('lead_processing_jobs')
        .update({ status: 'failed', error_message: 'Superseded by a new enrichment run', completed_at: new Date().toISOString() })
        .eq('event_id', event_id)
        .eq('stage', 'enrich')
        .eq('status', 'running')
    } catch (e) {
      console.warn('Failed to supersede previous jobs:', e)
    }

    // Create processing job (status: running)
    const { data: job, error: jobError } = await supabaseClient
      .from('lead_processing_jobs')
      .insert({
        event_id,
        stage: 'enrich',
        status: 'running',
        total_leads: totalLeads,
        processed_leads: 0,
        failed_leads: 0,
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (jobError) throw jobError

    // If nothing to process, complete immediately
    if (totalLeads === 0) {
      await supabaseClient
        .from('lead_processing_jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', job.id)

      return new Response(JSON.stringify({ success: true, message: 'No leads to enrich', job_id: job.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Kick off enrichment in background so the client gets a fast response
    EdgeRuntime.waitUntil((async () => {
      console.log(`Background enrichment started for job ${job.id} with ${totalLeads} leads`)

      try {
        // ZoomInfo creds
        const zoomInfoApiKey = Deno.env.get('ZOOMINFO_API_KEY')
        const zoomInfoUsername = Deno.env.get('ZOOMINFO_USERNAME')
        const zoomInfoPassword = Deno.env.get('ZOOMINFO_PASSWORD')

        if (!zoomInfoApiKey || !zoomInfoUsername || !zoomInfoPassword) {
          throw new Error('Missing ZoomInfo credentials')
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

        for (const lead of leads || []) {
          const attemptedEndpoints: { path: string; status?: number; note?: string }[] = []
          try {
            const headers: Record<string, string> = {
              'Authorization': `Bearer ${accessToken}`,
              'apikey': zoomInfoApiKey,
              'Content-Type': 'application/json'
            }

            // Prefer search with all available hints
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
                method: 'POST', headers, body: JSON.stringify(searchBody)
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

            // Fallback enrich by email
            if (!contact && lead?.email) {
              const enrichPath = '/enrich/person'
              attemptedEndpoints.push({ path: enrichPath })
              const enrichRes = await fetchWithRetry(`${ZI_BASE_URL}${enrichPath}`, {
                method: 'POST', headers, body: JSON.stringify({ email: lead.email })
              })
              const enrichData = await enrichRes.json()
              if (enrichData) {
                contact = Array.isArray(enrichData?.data) && enrichData.data.length > 0 ? enrichData.data[0] : enrichData
              }
            }

            // Extract enrichment data
            let phone1: string | null = null
            let phone2: string | null = null
            let companyState: string | null = null
            let companyCountry: string | null = null

            if (contact) {
              // Extract phone numbers - check various field patterns
              const phoneFields = ['phone', 'directPhone', 'mobilePhone', 'companyPhone']
              for (const field of phoneFields) {
                if (contact[field] && typeof contact[field] === 'string' && !phone1) {
                  phone1 = contact[field]
                  break
                }
              }
              
              // Check phone arrays
              const phones = contact.phones ?? contact.phoneNumbers ?? contact.phoneList ?? []
              if (Array.isArray(phones) && phones.length > 0) {
                const p0 = phones[0]
                if (!phone1) {
                  phone1 = typeof p0 === 'string' ? p0 : (p0.number ?? p0.phone ?? null)
                }
                if (phones.length > 1) {
                  const p1 = phones[1]
                  phone2 = typeof p1 === 'string' ? p1 : (p1.number ?? p1.phone ?? null)
                }
              }

              // Extract company location - multiple possible structures
              const comp = contact.company ?? contact.currentCompany ?? null
              if (comp) {
                companyState = comp.state || comp.stateCode || comp.companyState || null
                companyCountry = comp.country || comp.countryCode || comp.companyCountry || null
              } else {
                companyState = contact.companyState || contact.company_state || null
                companyCountry = contact.companyCountry || contact.company_country || null
              }
              
              console.log(`Enriched lead ${lead.id}: phone=${phone1 ? 'found' : 'none'}, state=${companyState || 'none'}, country=${companyCountry || 'none'}`)
            } else {
              console.log(`No contact data found for lead ${lead.id}`)
            }

            await supabaseClient
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
          } catch (err: any) {
            console.error(`Error enriching lead ${lead?.id}:`, err?.message || err)
            
            // Create detailed error message with endpoint info
            let errorMessage = 'Enrichment failed'
            if (err instanceof Error) {
              errorMessage = err.message
              if (attemptedEndpoints.length > 0) {
                const endpoints = attemptedEndpoints.map(ep => `${ep.path}:${ep.status || 'unknown'}`).join(', ')
                errorMessage = `${err.message} (endpoints: ${endpoints})`
              }
            }
            
            try {
              await supabaseClient
                .from('event_leads')
                .update({
                  enrichment_status: 'failed',
                  sync_errors: [
                    {
                      stage: 'enrich',
                      error: errorMessage,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                  updated_at: new Date().toISOString(),
                })
                .eq('id', lead.id)
            } catch (updateErr) {
              console.error('Failed to update lead failure status:', updateErr)
            }
            failedCount++
          } finally {
            // Update job progress regardless of success/failure
            try {
              await supabaseClient
                .from('lead_processing_jobs')
                .update({ processed_leads: processedCount, failed_leads: failedCount, updated_at: new Date().toISOString() })
                .eq('id', job.id)
            } catch (jobErr) {
              console.error('Failed to update job progress:', jobErr)
            }
            await sleep(120)
          }
        }

        await supabaseClient
          .from('lead_processing_jobs')
          .update({ status: 'completed', processed_leads: processedCount, failed_leads: failedCount, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', job.id)

        console.log(`Background enrichment completed for job ${job.id}: ${processedCount} processed, ${failedCount} failed`)
      } catch (error: any) {
        console.error('Background enrichment failed:', error?.message || error)
        try {
          await supabaseClient
            .from('lead_processing_jobs')
            .update({ status: 'failed', error_message: String(error?.message || error), completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', job.id)
        } catch (jobUpdateError) {
          console.error('Failed to update job status in background:', jobUpdateError)
        }
      }
    })())

    // Immediate response to unblock UI
    return new Response(
      JSON.stringify({ success: true, message: 'Lead enrichment started', job_id: job.id, total_leads: totalLeads }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in leads-enrich handler:', error?.message || error)
    return new Response(
      JSON.stringify({ success: false, error: String(error?.message || error), timestamp: new Date().toISOString() }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
