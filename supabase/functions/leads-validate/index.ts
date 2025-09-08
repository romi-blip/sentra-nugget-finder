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

  // Define validation patterns
  const genericEmailDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'mail.com', 'protonmail.com', 'yandex.com'
  ]
  
  const disposableEmailDomains = [
    '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 'mailinator.com',
    'temp-mail.org', 'throwaway.email', 'maildrop.cc'
  ]
  
  const blockedDomainKeywords = [
    'sentra', 'cyera', 'varonis', 'bigid'
  ]
  
  const roleBasedEmails = [
    'admin', 'administrator', 'info', 'support', 'contact', 'sales', 'marketing',
    'webmaster', 'noreply', 'no-reply', 'postmaster', 'root', 'mail', 'email'
  ]
  
  const junkNamePatterns = [
    /test/i, /demo/i, /sample/i, /example/i, /fake/i, /dummy/i,
    /asdf/i, /qwerty/i, /123/i, /abc/i, /xxx/i
  ]

  // Validate each lead
  for (const lead of leads || []) {
    const errors = []

    // Basic email format validation
    if (!lead.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
      errors.push('Invalid email format')
    } else {
      const emailLower = lead.email.toLowerCase()
      const emailDomain = emailLower.split('@')[1]
      const emailLocalPart = emailLower.split('@')[0]
      
      // Generic email domain check
      if (genericEmailDomains.includes(emailDomain)) {
        errors.push('Generic email domain not allowed')
      }
      
      // Disposable email domain check
      if (disposableEmailDomains.includes(emailDomain)) {
        errors.push('Disposable email domain not allowed')
      }
      
      // Blocked domain keywords check (competitors)
      if (blockedDomainKeywords.some(keyword => emailDomain.includes(keyword))) {
        errors.push('Competitor domain not allowed')
      }
      
      // Role-based email check
      if (roleBasedEmails.some(role => emailLocalPart.startsWith(role))) {
        errors.push('Role-based email not allowed')
      }
    }

    // Required fields validation
    if (!lead.first_name?.trim()) {
      errors.push('First name is required')
    } else {
      // Check for junk names
      if (junkNamePatterns.some(pattern => pattern.test(lead.first_name))) {
        errors.push('Invalid first name detected')
      }
    }
    
    if (!lead.last_name?.trim()) {
      errors.push('Last name is required')
    } else {
      // Check for junk names
      if (junkNamePatterns.some(pattern => pattern.test(lead.last_name))) {
        errors.push('Invalid last name detected')
      }
    }
    
    if (!lead.account_name?.trim()) {
      errors.push('Account name is required')
    } else {
      // Check for junk company names
      if (junkNamePatterns.some(pattern => pattern.test(lead.account_name))) {
        errors.push('Invalid company name detected')
      }
    }

    // Country restriction (US/Canada only)
    const allowedCountries = ['United States', 'USA', 'US', 'Canada', 'CA']
    if (lead.mailing_country && !allowedCountries.some(country => 
      lead.mailing_country.toLowerCase().includes(country.toLowerCase())
    )) {
      errors.push('Only US and Canada leads are allowed')
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