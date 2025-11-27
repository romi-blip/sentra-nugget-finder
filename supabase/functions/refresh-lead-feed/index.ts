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

    // Fetch the research record
    const { data: research, error: fetchError } = await supabase
      .from('lead_research')
      .select('*')
      .eq('id', leadResearchId)
      .single();

    if (fetchError || !research) {
      throw new Error('Research record not found');
    }

    console.log('Refreshing feed for:', research.full_name);

    const feedItems: any[] = [];

    // Fetch LinkedIn posts if we have LinkedIn URL
    if (research.linkedin_url) {
      const linkedinPosts = await fetchLinkedInPosts(research.linkedin_url);
      feedItems.push(...linkedinPosts.map((post: any) => ({
        lead_research_id: leadResearchId,
        feed_type: 'linkedin_post',
        source_url: post.postUrl || post.url,
        title: null,
        content: post.text || post.content || 'LinkedIn post',
        published_at: post.postedAt || post.date || null,
        raw_data: post
      })));
    }

    // Search for news mentions
    const name = research.full_name || `${research.first_name || ''} ${research.last_name || ''}`.trim();
    const company = research.company_name;
    
    if (name || company) {
      const newsMentions = await searchNewsMentions(name, company);
      feedItems.push(...newsMentions.map((news: any) => ({
        lead_research_id: leadResearchId,
        feed_type: 'news_mention',
        source_url: news.url,
        title: news.title,
        content: news.snippet || news.description || 'News mention',
        published_at: news.date || null,
        raw_data: news
      })));
    }

    // Insert new feed items (upsert based on source_url to avoid duplicates)
    if (feedItems.length > 0) {
      for (const item of feedItems) {
        // Check if already exists
        const { data: existing } = await supabase
          .from('lead_research_feed')
          .select('id')
          .eq('lead_research_id', leadResearchId)
          .eq('source_url', item.source_url)
          .single();

        if (!existing) {
          await supabase
            .from('lead_research_feed')
            .insert(item);
        }
      }
    }

    console.log(`Added ${feedItems.length} feed items for:`, leadResearchId);

    return new Response(
      JSON.stringify({ success: true, itemsAdded: feedItems.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Feed refresh error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchLinkedInPosts(linkedinUrl: string): Promise<any[]> {
  const apifyToken = Deno.env.get('APIFY_API_TOKEN');
  if (!apifyToken) {
    console.log('APIFY_API_TOKEN not set, skipping LinkedIn posts');
    return [];
  }

  try {
    // Extract profile identifier from URL
    const profileMatch = linkedinUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
    if (!profileMatch) {
      console.log('Could not parse LinkedIn profile URL');
      return [];
    }

    const response = await fetch(
      'https://api.apify.com/v2/acts/curious_coder~linkedin-post-search-scraper/run-sync-get-dataset-items?token=' + apifyToken,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchUrls: [`https://www.linkedin.com/in/${profileMatch[1]}/recent-activity/all/`],
          maxResults: 10,
          proxy: { useApifyProxy: true }
        })
      }
    );

    if (!response.ok) {
      console.error('Apify LinkedIn posts error:', await response.text());
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('LinkedIn posts fetch error:', error);
    return [];
  }
}

async function searchNewsMentions(name: string, company: string): Promise<any[]> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    console.log('OPENAI_API_KEY not set, skipping news search');
    return [];
  }

  try {
    const searchQuery = [name, company].filter(Boolean).join(' ');
    
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        tools: [{ type: 'web_search' }],
        input: `Find recent news articles (from the last 30 days) mentioning "${searchQuery}". 
        
Return a JSON array of news items with these fields:
- title: article title
- url: article URL
- snippet: brief description
- date: publication date if available

Only return the JSON array, no other text.`
      })
    });

    if (!response.ok) {
      console.error('OpenAI news search error:', await response.text());
      return [];
    }

    const data = await response.json();
    const content = data.output_text || data.choices?.[0]?.message?.content || '';
    
    // Try to parse JSON from response
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.log('Could not parse news JSON:', e);
    }
    
    return [];
  } catch (error) {
    console.error('News search error:', error);
    return [];
  }
}
