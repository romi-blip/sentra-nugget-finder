import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface Lead {
  id: string
  event_id: string
  email: string
  first_name: string
  last_name: string
  account_name: string
}

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
    console.log('Starting validation for event:', event_id)

    // Create processing job
    const { data: job, error: jobError } = await supabaseClient
      .from('lead_processing_jobs')
      .insert({
        event_id,
        stage: 'validate',
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (jobError) {
      console.error('Error creating job:', jobError)
      throw jobError
    }

    // Get all leads for this event
    const { data: leads, error: leadsError } = await supabaseClient
      .from('event_leads')
      .select('*')
      .eq('event_id', event_id)

    if (leadsError) {
      console.error('Error fetching leads:', leadsError)
      throw leadsError
    }

    // Update job with total count
    await supabaseClient
      .from('lead_processing_jobs')
      .update({ total_leads: leads?.length || 0 })
      .eq('id', job.id)

    let processedCount = 0
    let failedCount = 0

    // Validate each lead
    for (const lead of leads || []) {
      const errors = []

      // Email validation
      if (!lead.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
        errors.push('Invalid email format')
      }

      // Required fields validation
      if (!lead.first_name?.trim()) {
        errors.push('First name is required')
      }
      if (!lead.last_name?.trim()) {
        errors.push('Last name is required')
      }
      if (!lead.account_name?.trim()) {
        errors.push('Account name is required')
      }

      // Check for duplicates within the same event
      if (lead.email) {
        const { data: duplicates } = await supabaseClient
          .from('event_leads')
          .select('id')
          .eq('event_id', event_id)
          .eq('email', lead.email)
          .neq('id', lead.id)

        if (duplicates && duplicates.length > 0) {
          errors.push('Duplicate email within event')
        }
      }

      const status = errors.length > 0 ? 'failed' : 'completed'
      if (errors.length > 0) failedCount++
      else processedCount++

      // Update lead with validation results
      await supabaseClient
        .from('event_leads')
        .update({
          validation_status: status,
          validation_errors: errors
        })
        .eq('id', lead.id)

      console.log(`Validated lead ${lead.id}: ${status}`)
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

    console.log(`Validation completed: ${processedCount} processed, ${failedCount} failed`)

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
    console.error('Error in leads-validate function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})