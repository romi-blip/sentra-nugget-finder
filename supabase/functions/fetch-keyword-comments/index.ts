import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { validateAuth } from '../_shared/auth.ts';

const REDDIT_POST_URL_REGEX = /\/r\/([^/]+)\/comments\/([a-z0-9]+)/i;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication (allows both user JWT and service role key)
    const authResult = await validateAuth(req);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active keywords with comment search enabled
    const { data: keywords, error: keywordsError } = await supabase
      .from('tracked_keywords')
      .select('*')
      .eq('is_active', true)
      .eq('search_comments', true);

    if (keywordsError) {
      throw new Error(`Failed to fetch keywords: ${keywordsError.message}`);
    }

    if (!keywords || keywords.length === 0) {
      console.log('No keywords with comment search enabled found');
      return new Response(
        JSON.stringify({ message: 'No keywords with comment search enabled', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${keywords.length} keywords with comment search enabled`);

    let totalNewPosts = 0;
    const results: { keyword: string; newPosts: number; errors?: string }[] = [];

    for (const keyword of keywords) {
      try {
        console.log(`Processing keyword: ${keyword.keyword}`);
        
        // Build negative keywords filter
        const negativeKeywords: string[] = keyword.negative_keywords || [];
        
        // Call Pushshift API for comment search
        // Note: Pushshift API has been unreliable, fallback to Google search with site:reddit.com/comments
        const searchQuery = `${keyword.keyword} site:reddit.com/r/*/comments`;
        const negativeQuery = negativeKeywords.length > 0 
          ? ` -${negativeKeywords.join(' -')}` 
          : '';
        
        const apifyToken = Deno.env.get('APIFY_API_TOKEN');
        if (!apifyToken) {
          throw new Error('APIFY_API_TOKEN not configured');
        }

        // Use Google Search Scraper to find Reddit posts via comments
        const runResponse = await fetch(
          `https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${apifyToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              queries: `${searchQuery}${negativeQuery}`,
              maxPagesPerQuery: 2,
              resultsPerPage: 50,
              languageCode: 'en',
              countryCode: 'us',
              mobileResults: false,
              includeUnfilteredResults: false,
              saveHtml: false,
              saveHtmlToKeyValueStore: false,
            }),
          }
        );

        if (!runResponse.ok) {
          const errorText = await runResponse.text();
          console.error(`Apify run failed for keyword ${keyword.keyword}:`, errorText);
          results.push({ keyword: keyword.keyword, newPosts: 0, errors: `Apify run failed: ${errorText}` });
          continue;
        }

        const runData = await runResponse.json();
        const runId = runData.data.id;
        console.log(`Apify run started for ${keyword.keyword}: ${runId}`);

        // Wait for run to complete
        let runStatus = 'RUNNING';
        let attempts = 0;
        const maxAttempts = 60;

        while (runStatus === 'RUNNING' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const statusResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
          );
          
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            runStatus = statusData.data.status;
          }
          attempts++;
        }

        if (runStatus !== 'SUCCEEDED') {
          console.error(`Apify run did not succeed for keyword ${keyword.keyword}: ${runStatus}`);
          results.push({ keyword: keyword.keyword, newPosts: 0, errors: `Run status: ${runStatus}` });
          continue;
        }

        // Fetch results
        const datasetResponse = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}`
        );

        if (!datasetResponse.ok) {
          const errorText = await datasetResponse.text();
          console.error(`Failed to fetch dataset for keyword ${keyword.keyword}:`, errorText);
          results.push({ keyword: keyword.keyword, newPosts: 0, errors: `Dataset fetch failed` });
          continue;
        }

        const searchResults = await datasetResponse.json();
        console.log(`Got ${searchResults.length} search pages for keyword ${keyword.keyword}`);

        // Extract Reddit URLs from search results
        const redditUrls: { url: string; title: string; snippet: string }[] = [];
        
        for (const page of searchResults) {
          const organicResults = page.organicResults || [];
          for (const result of organicResults) {
            const url = result.url || result.link;
            if (url && url.includes('reddit.com') && REDDIT_POST_URL_REGEX.test(url)) {
              redditUrls.push({
                url: url,
                title: result.title || '',
                snippet: result.description || result.snippet || '',
              });
            }
          }
        }

        console.log(`Found ${redditUrls.length} Reddit URLs for keyword ${keyword.keyword}`);

        // Process each URL
        let keywordNewPosts = 0;
        
        for (const { url, title, snippet } of redditUrls) {
          const match = url.match(REDDIT_POST_URL_REGEX);
          if (!match) continue;

          const subredditName = match[1];
          const redditId = match[2];

          // Check if post already exists
          const { data: existingPost } = await supabase
            .from('reddit_posts')
            .select('id')
            .eq('reddit_id', redditId)
            .single();

          if (existingPost) {
            continue;
          }

          // Fetch full post data from Reddit
          try {
            const redditResponse = await fetch(
              `https://www.reddit.com/r/${subredditName}/comments/${redditId}.json`,
              { headers: { 'User-Agent': 'Sentra/1.0' } }
            );

            if (redditResponse.ok) {
              const redditData = await redditResponse.json();
              const postData = redditData[0]?.data?.children?.[0]?.data;

              if (postData) {
                const pubDate = postData.created_utc 
                  ? new Date(postData.created_utc * 1000).toISOString()
                  : null;

                const { error: insertError } = await supabase
                  .from('reddit_posts')
                  .insert({
                    reddit_id: redditId,
                    title: postData.title || title,
                    link: `https://www.reddit.com${postData.permalink || `/r/${subredditName}/comments/${redditId}`}`,
                    author: postData.author || null,
                    content: postData.selftext || null,
                    content_snippet: snippet || (postData.selftext?.substring(0, 300) || null),
                    upvotes: postData.ups || 0,
                    comment_count: postData.num_comments || 0,
                    pub_date: pubDate,
                    iso_date: pubDate,
                    keyword_id: keyword.id,
                    source_type: 'comment',
                  });

                if (insertError) {
                  console.error(`Failed to insert post ${redditId}:`, insertError.message);
                } else {
                  keywordNewPosts++;
                  console.log(`Inserted new comment-sourced post: ${redditId}`);
                }
              }
            }
          } catch (fetchError) {
            console.error(`Error fetching Reddit post ${redditId}:`, fetchError);
            // Fallback: insert with Google search data
            const { error: insertError } = await supabase
              .from('reddit_posts')
              .insert({
                reddit_id: redditId,
                title: title,
                link: url,
                content_snippet: snippet,
                keyword_id: keyword.id,
                source_type: 'comment',
              });

            if (!insertError) {
              keywordNewPosts++;
            }
          }

          // Add delay between Reddit API calls
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        totalNewPosts += keywordNewPosts;
        results.push({ keyword: keyword.keyword, newPosts: keywordNewPosts });

        // Update last_fetched_at
        await supabase
          .from('tracked_keywords')
          .update({ last_fetched_at: new Date().toISOString() })
          .eq('id', keyword.id);

      } catch (keywordError) {
        console.error(`Error processing keyword ${keyword.keyword}:`, keywordError);
        results.push({ 
          keyword: keyword.keyword, 
          newPosts: 0, 
          errors: keywordError instanceof Error ? keywordError.message : 'Unknown error' 
        });
      }
    }

    // Queue new posts for analysis
    if (totalNewPosts > 0) {
      const { data: newPosts } = await supabase
        .from('reddit_posts')
        .select('id')
        .eq('source_type', 'comment')
        .is('pub_date', null)
        .or('pub_date.is.null');

      // Actually get posts that don't have reviews yet
      const { data: unreviewedPosts } = await supabase
        .from('reddit_posts')
        .select('id, reddit_id')
        .eq('source_type', 'comment')
        .not('id', 'in', `(SELECT post_id FROM post_reviews)`)
        .limit(50);

      if (unreviewedPosts && unreviewedPosts.length > 0) {
        console.log(`Queuing ${unreviewedPosts.length} posts for analysis`);
        
        for (const post of unreviewedPosts) {
          EdgeRuntime.waitUntil(
            supabase.functions.invoke('analyze-reddit-post', {
              body: { post_id: post.id },
            }).catch(err => console.error(`Failed to analyze post ${post.id}:`, err))
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Keyword comment search completed',
        totalNewPosts,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-keyword-comments:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
