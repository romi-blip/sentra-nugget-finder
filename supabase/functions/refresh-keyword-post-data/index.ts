import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REDDIT_POST_REGEX = /reddit\.com\/r\/([^\/]+)\/comments\/([^\/]+)/;

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
      .limit(50); // Limit batch size for Apify

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

    // Build list of URLs to scrape
    const urlsToScrape = postsNeedingRefresh.map(post => ({ url: post.link }));
    console.log(`Scraping ${urlsToScrape.length} Reddit URLs via Apify...`);

    // Start Apify actor run
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/crawlerbros~reddit-scraper/runs?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: urlsToScrape,
          maxItems: urlsToScrape.length,
          proxy: {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL']
          }
        })
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Failed to start Apify run:', errorText);
      throw new Error(`Failed to start Apify run: ${runResponse.status}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`Apify run started: ${runId}`);

    // Poll for completion (max 3 minutes)
    let runStatus = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 36; // 36 * 5 seconds = 3 minutes

    while (runStatus === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
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

    // Create a map of reddit_id to scraped data
    const scrapedDataMap = new Map();
    for (const item of items) {
      // Extract reddit_id from the item's URL or id field
      const redditId = item.id || item.postId;
      if (redditId) {
        scrapedDataMap.set(redditId, item);
      }
    }

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

        // Parse the date - Apify returns various date formats
        let pubDate = null;
        if (scrapedData.createdAt) {
          pubDate = new Date(scrapedData.createdAt).toISOString();
        } else if (scrapedData.created_utc) {
          pubDate = new Date(scrapedData.created_utc * 1000).toISOString();
        } else if (scrapedData.date) {
          pubDate = new Date(scrapedData.date).toISOString();
        }

        const { error: updateError } = await supabase
          .from('reddit_posts')
          .update({
            author: scrapedData.author || scrapedData.authorName || null,
            pub_date: pubDate,
            iso_date: pubDate,
            upvotes: scrapedData.score || scrapedData.upvotes || 0,
            comment_count: scrapedData.numberOfComments || scrapedData.numComments || scrapedData.num_comments || 0,
            content: scrapedData.body || scrapedData.selftext || null,
            content_snippet: (scrapedData.body || scrapedData.selftext || '').substring(0, 500) || null,
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
