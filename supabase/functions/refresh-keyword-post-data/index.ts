import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apifyToken = Deno.env.get('APIFY_API_TOKEN')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting refresh of keyword posts with incomplete data...');

    // Find keyword posts with null pub_date or author
    const { data: postsNeedingRefresh, error: fetchError } = await supabase
      .from('reddit_posts')
      .select('id, reddit_id, link, keyword_id, title')
      .not('keyword_id', 'is', null)
      .or('pub_date.is.null,author.is.null')
      .limit(50);

    if (fetchError) {
      console.error('Error fetching posts:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${postsNeedingRefresh?.length || 0} posts needing refresh`);

    if (!postsNeedingRefresh || postsNeedingRefresh.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No posts need refreshing', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build list of URLs to scrape - use trudax/reddit-scraper-lite which accepts startUrls
    const urlsToScrape = postsNeedingRefresh.map(post => ({ url: post.link }));
    console.log(`Scraping ${urlsToScrape.length} Reddit URLs via Apify...`);

    // Start Apify actor run with trudax/reddit-scraper-lite
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/trudax~reddit-scraper-lite/runs?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: urlsToScrape,
          maxPostCount: urlsToScrape.length,
          maxComments: 0, // We only need post data, not comments
          proxy: {
            useApifyProxy: true
          }
        })
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Failed to start Apify run:', errorText);
      throw new Error(`Failed to start Apify run: ${runResponse.status} - ${errorText}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`Apify run started: ${runId}`);

    // Poll for completion (max 3 minutes)
    let runStatus = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 36;

    while (runStatus === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
      );
      const statusData = await statusResponse.json();
      runStatus = statusData.data.status;
      attempts++;
      console.log(`Run status: ${runStatus} (attempt ${attempts}/${maxAttempts})`);
    }

    if (runStatus !== 'SUCCEEDED') {
      console.error(`Apify run did not succeed: ${runStatus}`);
      throw new Error(`Apify run status: ${runStatus}`);
    }

    // Fetch results from dataset
    const datasetId = runData.data.defaultDatasetId;
    const datasetResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`
    );
    const items = await datasetResponse.json();
    console.log(`Retrieved ${items.length} items from Apify`);
    
    // Log sample item structure for debugging
    if (items.length > 0) {
      console.log('Sample Apify item keys:', Object.keys(items[0]));
      console.log('Sample Apify item:', JSON.stringify(items[0]).substring(0, 500));
    }

    // Create a map of reddit_id to scraped data
    const scrapedDataMap = new Map();
    
    // Helper to extract clean reddit_id from URL
    const extractRedditIdFromUrl = (url: string): string | null => {
      const match = url.match(/\/comments\/([a-z0-9]+)/i);
      return match ? match[1] : null;
    };
    
    for (const item of items) {
      // Use parsedId first (clean ID without t3_ prefix), then try other fields
      let redditId = item.parsedId || item.postId;
      
      // If id has t3_ prefix, strip it
      if (!redditId && item.id) {
        redditId = item.id.replace(/^t3_/, '');
      }
      
      // Extract from URL as fallback
      if (!redditId && item.url) {
        redditId = extractRedditIdFromUrl(item.url);
      }
      
      if (redditId) {
        console.log(`Mapped reddit_id: ${redditId}`);
        scrapedDataMap.set(redditId, item);
      }
    }
    
    console.log(`ScrapedDataMap size: ${scrapedDataMap.size}`);
    // Update posts with scraped data
    let updatedCount = 0;
    let errorCount = 0;

    for (const post of postsNeedingRefresh) {
      try {
        const scrapedData = scrapedDataMap.get(post.reddit_id);
        
        if (!scrapedData) {
          console.warn(`No scraped data found for post ${post.id} (reddit_id: ${post.reddit_id})`);
          errorCount++;
          continue;
        }

        let pubDate = null;
        if (scrapedData.createdAt) {
          pubDate = new Date(scrapedData.createdAt).toISOString();
        } else if (scrapedData.created_utc) {
          pubDate = new Date(scrapedData.created_utc * 1000).toISOString();
        } else if (scrapedData.created) {
          pubDate = new Date(scrapedData.created * 1000).toISOString();
        } else if (scrapedData.date) {
          pubDate = new Date(scrapedData.date).toISOString();
        }

        const { error: updateError } = await supabase
          .from('reddit_posts')
          .update({
            author: scrapedData.username || scrapedData.author || scrapedData.authorName || null,
            pub_date: pubDate,
            iso_date: pubDate,
            upvotes: scrapedData.upVotes || scrapedData.score || scrapedData.ups || scrapedData.upvotes || 0,
            comment_count: scrapedData.numberOfComments || scrapedData.numComments || scrapedData.num_comments || 0,
            content: scrapedData.body || scrapedData.selftext || scrapedData.text || null,
            content_snippet: (scrapedData.body || scrapedData.selftext || scrapedData.text || '').substring(0, 500) || null,
          })
          .eq('id', post.id);

        if (updateError) {
          console.error(`Error updating post ${post.id}:`, updateError);
          errorCount++;
        } else {
          console.log(`Updated post: ${post.title.substring(0, 50)}...`);
          updatedCount++;
        }
      } catch (err) {
        console.error(`Error processing post ${post.id}:`, err);
        errorCount++;
      }
    }

    console.log(`Refresh complete. Updated: ${updatedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Refreshed ${updatedCount} posts`,
        updated: updatedCount,
        errors: errorCount,
        total: postsNeedingRefresh.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in refresh-keyword-post-data:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
