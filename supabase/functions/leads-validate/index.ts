import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface Lead {
  id: string
  event_id: string
  email: string
  first_name: string
  last_name: string
  account_name: string
  email_validation_status?: string
  email_validation_result?: any
  email_validation_score?: number
  email_validation_reason?: string
}

interface TrueListBatchResponse {
  id: string
  batch_state: string
  email_count: number
  processed_count?: number
  annotated_csv_url?: string
  safest_bet_csv_url?: string
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

    const truelistApiKey = Deno.env.get('TRUELIST_API_KEY')
    if (!truelistApiKey) {
      throw new Error('TRUELIST_API_KEY is not configured')
    }

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

    // Step 1: Email validation using TrueList API
    console.log('Starting TrueList email validation...')
    await performEmailValidation(supabaseClient, leads || [], truelistApiKey, job.id)

    // Step 2: Basic validation patterns
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

async function performEmailValidation(
  supabaseClient: any,
  leads: Lead[],
  truelistApiKey: string,
  jobId: string
) {
  console.log('=== STARTING TRUELIST EMAIL VALIDATION ===')
  
  try {
    // Extract unique emails for validation
    const uniqueEmails = [...new Set(leads.map(lead => lead.email).filter(Boolean))]
    console.log(`📧 Found ${uniqueEmails.length} unique emails to validate`)
    console.log(`📧 Sample emails: ${uniqueEmails.slice(0, 3).join(', ')}...`)

    if (uniqueEmails.length === 0) {
      console.log('⚠️ No emails to validate - skipping TrueList API')
      return
    }

    // Check API key
    if (!truelistApiKey || truelistApiKey.trim() === '') {
      console.error('❌ TRUELIST_API_KEY is missing or empty')
      throw new Error('TrueList API key is not configured')
    }
    console.log('✅ TrueList API key is configured')

    // Submit batch validation request
    console.log('🚀 Submitting batch validation request to TrueList...')
    
    // Format emails as required by TrueList API: [["email1"], ["email2"], ...]
    const emailData = uniqueEmails.map(email => [email])
    console.log(`📧 Formatted ${emailData.length} emails for TrueList batch API`)
    
    const batchResponse = await fetch('https://api.truelist.io/api/v1/batches', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${truelistApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        data: JSON.stringify(emailData)
      })
    })

    console.log(`📡 TrueList batch API response status: ${batchResponse.status} ${batchResponse.statusText}`)

    if (!batchResponse.ok) {
      const errorText = await batchResponse.text()
      console.error('❌ TrueList batch submission failed:', {
        status: batchResponse.status,
        statusText: batchResponse.statusText,
        error: errorText
      })
      throw new Error(`TrueList API error: ${batchResponse.status} - ${errorText}`)
    }

    const batchData: TrueListBatchResponse = await batchResponse.json()
    console.log('✅ Batch submission successful:', {
      batch_id: batchData.id,
      status: batchData.batch_state,
      total_emails: batchData.email_count
    })

    // Poll for results
    console.log('⏳ Starting polling for batch results...')
    let attempts = 0
    const maxAttempts = 30 // 5 minutes with 10-second intervals
    
    while (attempts < maxAttempts) {
      attempts++
      console.log(`🔄 Polling attempt ${attempts}/${maxAttempts} - waiting 10 seconds...`)
      
      await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds

      console.log(`📡 Checking batch status for ID: ${batchData.id}`)
      const statusResponse = await fetch(`https://api.truelist.io/api/v1/batches/${batchData.id}`, {
        headers: {
          'Authorization': `Bearer ${truelistApiKey}`
        }
      })

      console.log(`📡 Status check response: ${statusResponse.status} ${statusResponse.statusText}`)

      if (!statusResponse.ok) {
        console.error(`❌ Failed to check batch status (attempt ${attempts}):`, {
          status: statusResponse.status,
          statusText: statusResponse.statusText
        })
        continue
      }

      const statusData: TrueListBatchResponse = await statusResponse.json()
      console.log(`📊 Batch progress:`, {
        status: statusData.batch_state,
        completed: statusData.processed_count,
        total: statusData.email_count,
        progress: statusData.processed_count && statusData.email_count ? 
          `${Math.round((statusData.processed_count / statusData.email_count) * 100)}%` : 'N/A'
      })

      if (statusData.batch_state === 'completed' && statusData.annotated_csv_url) {
        console.log('🎉 Email validation completed! Downloading results...')
        console.log(`📈 CSV URL: ${statusData.annotated_csv_url}`)
        
        // Download and parse the CSV results
        const csvResponse = await fetch(statusData.annotated_csv_url, {
          headers: {
            'Authorization': `Bearer ${truelistApiKey}`
          }
        })
        
        if (!csvResponse.ok) {
          console.error('❌ Failed to download CSV results:', csvResponse.statusText)
          throw new Error(`Failed to download CSV results: ${csvResponse.statusText}`)
        }
        
        const csvText = await csvResponse.text()
        console.log('📁 Downloaded CSV results, parsing...')
        
        // Parse CSV (simple parsing for comma-separated values)
        const lines = csvText.split('\n').filter(line => line.trim())
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
        console.log('📋 CSV headers:', headers)
        
        let updateCount = 0
        let updateErrors = 0
        
        // Process each row (skip header)
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
          if (values.length < headers.length) continue
          
          const row: any = {}
          headers.forEach((header, index) => {
            row[header] = values[index]
          })
          
          // Extract email and validation status
          const email = row['Email Address'] || row[''] || row[headers[0]] // TrueList puts email in 'Email Address' or empty header
          const emailState = row['Email State'] || 'unknown'
          const emailSubState = row['Email Sub-State'] || 'unknown'
          
          if (!email) continue
          
          try {
            const leadUpdates = {
              email_validation_status: emailState === 'ok' ? 'valid' : 'invalid',
              email_validation_result: row,
              email_validation_score: emailState === 'ok' ? 100 : 0,
              email_validation_reason: emailSubState
            }

            const { error: updateError } = await supabaseClient
              .from('event_leads')
              .update(leadUpdates)
              .eq('email', email)

            if (updateError) {
              console.error(`❌ Failed to update lead for email ${email}:`, updateError)
              updateErrors++
            } else {
              updateCount++
              if (updateCount <= 3) { // Log first few updates
                console.log(`✅ Updated email validation for ${email}: ${emailState} (${emailSubState})`)
              }
            }
          } catch (updateErr) {
            console.error(`❌ Exception updating email ${email}:`, updateErr)
            updateErrors++
          }
        }

        console.log(`📊 Database update summary: ${updateCount} successful, ${updateErrors} failed`)
        console.log('✅ TrueList email validation process completed successfully')
        return
        
      } else if (statusData.batch_state === 'failed') {
        console.error('❌ TrueList batch validation failed')
        throw new Error('TrueList batch validation failed')
      } else {
        console.log(`⏳ Batch still processing... (status: ${statusData.batch_state})`)
      }
    }

    if (attempts >= maxAttempts) {
      console.warn('⚠️ Email validation timed out after 5 minutes, but continuing with other validations')
      console.warn(`⚠️ Batch ID ${batchData.id} may still be processing - check TrueList dashboard`)
    }

  } catch (error) {
    console.error('💥 Email validation error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    // Don't throw - continue with other validations
    console.log('⚠️ Continuing with basic validation despite email validation failure')
  }
  
  console.log('=== TRUELIST EMAIL VALIDATION ENDED ===')
}