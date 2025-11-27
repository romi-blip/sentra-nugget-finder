import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadResearchId } = await req.json();
    
    if (!leadResearchId) {
      return new Response(
        JSON.stringify({ error: 'leadResearchId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update status to researching
    await supabase
      .from('lead_research')
      .update({ status: 'researching' })
      .eq('id', leadResearchId);

    // Fetch the research record
    const { data: research, error: fetchError } = await supabase
      .from('lead_research')
      .select('*')
      .eq('id', leadResearchId)
      .single();

    if (fetchError || !research) {
      throw new Error('Research record not found');
    }

    console.log('Starting research for:', research);

    let linkedinData = null;
    let salesforceData = null;
    let webResearchData = null;

    // Extract data based on input type
    if (research.input_type === 'linkedin' && research.linkedin_url) {
      linkedinData = await extractLinkedInData(research.linkedin_url);
      console.log('LinkedIn data extracted:', linkedinData);
    } else if (research.input_type === 'salesforce' && research.input_url) {
      salesforceData = await extractSalesforceData(research.input_url);
      console.log('Salesforce data extracted:', salesforceData);
    }

    // Update record with extracted data
    const updateData: Record<string, any> = {};
    
    if (linkedinData) {
      updateData.raw_linkedin_data = linkedinData;
      updateData.first_name = linkedinData.firstName || research.first_name;
      updateData.last_name = linkedinData.lastName || research.last_name;
      updateData.full_name = linkedinData.fullName || research.full_name;
      updateData.title = linkedinData.headline || research.title;
      updateData.company_name = linkedinData.companyName || research.company_name;
      updateData.location = linkedinData.location || research.location;
    }

    if (salesforceData) {
      updateData.raw_salesforce_data = salesforceData;
      updateData.first_name = salesforceData.FirstName || research.first_name;
      updateData.last_name = salesforceData.LastName || research.last_name;
      updateData.full_name = salesforceData.Name || research.full_name;
      updateData.email = salesforceData.Email || research.email;
      updateData.title = salesforceData.Title || research.title;
      updateData.company_name = salesforceData.Company || salesforceData.Account?.Name || research.company_name;
    }

    // Do web research
    const searchName = updateData.full_name || research.full_name || `${research.first_name || ''} ${research.last_name || ''}`.trim();
    const searchCompany = updateData.company_name || research.company_name;
    
    if (searchName || searchCompany) {
      webResearchData = await performWebResearch(searchName, searchCompany, updateData.title || research.title);
      console.log('Web research completed');
      updateData.raw_web_research = webResearchData;
    }

    // Generate comprehensive summary
    const summary = await generateSummary({
      ...research,
      ...updateData,
      raw_linkedin_data: linkedinData || research.raw_linkedin_data,
      raw_salesforce_data: salesforceData || research.raw_salesforce_data,
      raw_web_research: webResearchData || research.raw_web_research
    });

    updateData.research_summary = summary;
    updateData.status = 'completed';

    // Update the record
    const { error: updateError } = await supabase
      .from('lead_research')
      .update(updateData)
      .eq('id', leadResearchId);

    if (updateError) {
      throw updateError;
    }

    console.log('Research completed for:', leadResearchId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Research error:', error);
    
    // Try to update status to failed
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { leadResearchId } = await req.json().catch(() => ({}));
      if (leadResearchId) {
        await supabase
          .from('lead_research')
          .update({ 
            status: 'failed', 
            error_message: error instanceof Error ? error.message : 'Unknown error' 
          })
          .eq('id', leadResearchId);
      }
    } catch (e) {
      console.error('Failed to update error status:', e);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function extractLinkedInData(linkedinUrl: string): Promise<any> {
  const apifyToken = Deno.env.get('APIFY_API_TOKEN');
  if (!apifyToken) {
    console.log('APIFY_API_TOKEN not set, skipping LinkedIn extraction');
    return null;
  }

  try {
    // Use Apify LinkedIn profile scraper
    const response = await fetch(
      'https://api.apify.com/v2/acts/curious_coder~linkedin-profile-scraper/run-sync-get-dataset-items?token=' + apifyToken,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileUrls: [linkedinUrl],
          proxy: { useApifyProxy: true }
        })
      }
    );

    if (!response.ok) {
      console.error('Apify LinkedIn error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data[0] || null;
  } catch (error) {
    console.error('LinkedIn extraction error:', error);
    return null;
  }
}

async function extractSalesforceData(salesforceUrl: string): Promise<any> {
  const n8nApiKey = Deno.env.get('N8N_API_KEY');
  if (!n8nApiKey) {
    console.log('N8N_API_KEY not set, skipping Salesforce extraction');
    return null;
  }

  try {
    // Parse Salesforce URL to get object type and ID
    const urlMatch = salesforceUrl.match(/\/([a-zA-Z0-9]{15,18})(?:\/|$|\?)/);
    if (!urlMatch) {
      console.error('Could not parse Salesforce URL');
      return null;
    }

    const recordId = urlMatch[1];
    let objectType = 'Lead';
    
    // Determine object type from URL or ID prefix
    if (salesforceUrl.includes('/Lead/') || recordId.startsWith('00Q')) {
      objectType = 'Lead';
    } else if (salesforceUrl.includes('/Contact/') || recordId.startsWith('003')) {
      objectType = 'Contact';
    } else if (salesforceUrl.includes('/Account/') || recordId.startsWith('001')) {
      objectType = 'Account';
    }

    // Call N8n webhook to fetch Salesforce data
    const response = await fetch(
      'https://sentra.app.n8n.cloud/webhook/salesforce-extract',
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${n8nApiKey}`
        },
        body: JSON.stringify({
          recordId,
          objectType,
          salesforceUrl
        })
      }
    );

    if (!response.ok) {
      console.error('N8n Salesforce error:', await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Salesforce extraction error:', error);
    return null;
  }
}

async function performWebResearch(name: string, company: string, title: string): Promise<any> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    console.log('OPENAI_API_KEY not set, skipping web research');
    return null;
  }

  try {
    const searchQuery = [name, title, company].filter(Boolean).join(' ');
    
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        tools: [{ type: 'web_search' }],
        input: `Research the following person and their company thoroughly. Find information about their professional background, recent activities, company news, and any relevant insights for a sales conversation.

Person: ${name || 'Unknown'}
Title: ${title || 'Unknown'}
Company: ${company || 'Unknown'}

Please search for:
1. The person's professional background and career history
2. Recent news or announcements about them
3. Their company's business, recent news, challenges, and industry
4. Any public speaking, articles, or social media presence
5. Company's technology stack if available

Provide detailed findings with sources.`
      })
    });

    if (!response.ok) {
      console.error('OpenAI web search error:', await response.text());
      return null;
    }

    const data = await response.json();
    return {
      findings: data.output_text || data.choices?.[0]?.message?.content,
      raw: data
    };
  } catch (error) {
    console.error('Web research error:', error);
    return null;
  }
}

async function generateSummary(research: any): Promise<string> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return generateBasicSummary(research);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `You are a sales intelligence analyst creating comprehensive lead research summaries for Sentra, a data security company. Create detailed, actionable summaries in markdown format.

Structure your summary with these sections:
# Lead Research: {Full Name}

## Executive Summary
{2-3 paragraph overview of the person, their role, company context, and key insights}

## Contact Profile
- **Name:** {Full Name}
- **Title:** {Title}
- **Company:** {Company}
- **Email:** {Email if available}
- **LinkedIn:** {URL if available}
- **Location:** {Location if available}

## Company Overview
### About {Company}
{Company description, what they do, industry position}

### Key Facts
- Industry: {Industry}
- Size: {Employee count if available}
- Website: {URL if available}

## Strategic Insights
### Likely Pain Points
{Based on role and company, what data security challenges might they face}

### Opportunities for Sentra
{How Sentra's DSPM/DDR capabilities could help}

## Recommended Talking Points
1. {Specific talking point based on research}
2. {Another talking point}
3. {Another talking point}

## Recent Activity
{Summary of any recent posts, news, or activity found}

## Sources
{List sources used}`
          },
          {
            role: 'user',
            content: `Create a comprehensive lead research summary based on this data:

Name: ${research.full_name || `${research.first_name || ''} ${research.last_name || ''}`.trim() || 'Unknown'}
Title: ${research.title || 'Unknown'}
Email: ${research.email || 'Not available'}
Company: ${research.company_name || 'Unknown'}
Company Website: ${research.company_website || 'Not available'}
Location: ${research.location || 'Not available'}
LinkedIn: ${research.linkedin_url || 'Not available'}

LinkedIn Data: ${JSON.stringify(research.raw_linkedin_data || {}, null, 2)}

Salesforce Data: ${JSON.stringify(research.raw_salesforce_data || {}, null, 2)}

Web Research: ${JSON.stringify(research.raw_web_research?.findings || research.raw_web_research || 'No web research available', null, 2)}`
          }
        ],
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      console.error('OpenAI summary error:', await response.text());
      return generateBasicSummary(research);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Summary generation error:', error);
    return generateBasicSummary(research);
  }
}

function generateBasicSummary(research: any): string {
  const name = research.full_name || `${research.first_name || ''} ${research.last_name || ''}`.trim() || 'Unknown';
  
  return `# Lead Research: ${name}

## Contact Profile
- **Name:** ${name}
- **Title:** ${research.title || 'Not available'}
- **Company:** ${research.company_name || 'Not available'}
- **Email:** ${research.email || 'Not available'}
- **LinkedIn:** ${research.linkedin_url || 'Not available'}
- **Location:** ${research.location || 'Not available'}

## Company Overview
### About ${research.company_name || 'Unknown Company'}
${research.company_industry ? `Industry: ${research.company_industry}` : ''}
${research.company_website ? `Website: ${research.company_website}` : ''}

---
*Note: Full research summary could not be generated. Please check API configuration.*`;
}
