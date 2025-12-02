import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const REDDIT_POST_REGEX = /(?:https?:\/\/)?(?:www\.)?reddit\.com\/r\/([^\/]+)\/comments\/([a-zA-Z0-9]+)(?:\/([^\/\?]+))?/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apifyToken = Deno.env.get('APIFY_API_TOKEN');

    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch active keywords for this user
    const { data: keywords, error: keywordsError } = await supabase
      .from('tracked_keywords')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (keywordsError) {
      console.error('Error fetching keywords:', keywordsError);
      throw keywordsError;
    }

    if (!keywords || keywords.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No active keywords to fetch',
        results: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];
    const newPostsToAnalyze: Array<{ postId: string; post: any }> = [];
    let totalNewPosts = 0;

    for (const keyword of keywords) {
      try {
        console.log(`Fetching posts for keyword: "${keyword.keyword}"`);

        // Use Apify's Google Search Scraper
        const searchQuery = `site:reddit.com "${keyword.keyword}"`;
        
        const runResponse = await fetch(
          `https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${apifyToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              queries: searchQuery,
              maxPagesPerQuery: 2,
              resultsPerPage: 20,
              mobileResults: false,
              countryCode: 'us',
              languageCode: 'en',
              tbs: 'qdr:m3' // Past 3 months filter
            })
          }
        );

        if (!runResponse.ok) {
          console.error(`Apify run failed for keyword "${keyword.keyword}":`, runResponse.statusText);
          results.push({ keyword: keyword.keyword, status: 'error', message: 'Search failed' });
          continue;
        }

        const runData = await runResponse.json();
        const runId = runData.data.id;

        // Wait for run to complete (poll status)
        let attempts = 0;
        let runStatus = 'RUNNING';
        let datasetId: string | null = null;
        while (runStatus === 'RUNNING' && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const statusResponse = await fetch(
            `https://api.apify.com/v2/acts/apify~google-search-scraper/runs/${runId}?token=${apifyToken}`
          );
          const statusData = await statusResponse.json();
          runStatus = statusData.data.status;
          if (!datasetId && statusData.data.defaultDatasetId) {
            datasetId = statusData.data.defaultDatasetId;
          }
          attempts++;
        }

        if (runStatus !== 'SUCCEEDED') {
          console.error(`Apify run did not succeed for keyword "${keyword.keyword}": ${runStatus}`);
          results.push({ keyword: keyword.keyword, status: 'error', message: `Run status: ${runStatus}` });
          continue;
        }

        if (!datasetId) {
          console.error(`No dataset ID returned for keyword "${keyword.keyword}"`);
          results.push({ keyword: keyword.keyword, status: 'error', message: 'No dataset ID from Apify run' });
          continue;
        }

        // Get results from dataset
        const itemsUrl = new URL(`https://api.apify.com/v2/datasets/${datasetId}/items`);
        itemsUrl.searchParams.set('token', apifyToken);
        itemsUrl.searchParams.set('clean', 'true');
        itemsUrl.searchParams.set('format', 'json');

        const datasetResponse = await fetch(itemsUrl.toString());
        
        if (!datasetResponse.ok) {
          console.error(`Failed to fetch dataset for keyword "${keyword.keyword}": ${datasetResponse.status}`);
          results.push({ keyword: keyword.keyword, status: 'error', message: 'Dataset fetch failed' });
          continue;
        }

        const searchResults = await datasetResponse.json();
        let keywordNewPosts = 0;
        
        console.log(`Processing ${searchResults.length} search pages for keyword "${keyword.keyword}"`);
        
        // Step 1: Collect all Reddit URLs from Google search results
        const urlsBySubreddit = new Map<string, Array<{ url: string; redditId: string; googleTitle: string; googleDescription: string }>>();
        
        for (const searchPage of searchResults) {
          const organicResults = searchPage.organicResults || [];
          console.log(`Found ${organicResults.length} organic results in search page`);
          
          for (const result of organicResults) {
            const url = result.url;
            if (!url) continue;

            const match = url.match(REDDIT_POST_REGEX);
            if (!match) {
              console.log(`URL did not match Reddit pattern: ${url}`);
              continue;
            }

            const [, subredditName, redditId] = match;

            // Check if post already exists
            const { data: existing } = await supabase
              .from('reddit_posts')
              .select('id')
              .eq('reddit_id', redditId)
              .single();

            if (existing) {
              console.log(`Post ${redditId} already exists, skipping`);
              continue;
            }

            // Group by subreddit for batch fetching
            if (!urlsBySubreddit.has(subredditName)) {
              urlsBySubreddit.set(subredditName, []);
            }
            
            urlsBySubreddit.get(subredditName)!.push({
              url,
              redditId,
              googleTitle: result.title || '',
              googleDescription: result.description || ''
            });
          }
        }

        console.log(`Found ${urlsBySubreddit.size} subreddits with new posts to fetch`);

        // Step 2: For each subreddit, fetch actual Reddit post data
        for (const [subredditName, posts] of urlsBySubreddit.entries()) {
          try {
            console.log(`Fetching ${posts.length} posts from r/${subredditName}`);

            // Call Apify reddit-scraper
            const scraperRunResponse = await fetch(
              `https://api.apify.com/v2/acts/crawlerbros~reddit-scraper/runs?token=${apifyToken}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  subreddits: [subredditName],
                  maxPosts: 100,
                  sort: 'new'
                })
              }
            );

            if (!scraperRunResponse.ok) {
              console.error(`Apify scraper run failed for r/${subredditName}`);
              continue;
            }

            const scraperRunData = await scraperRunResponse.json();
            const scraperRunId = scraperRunData.data.id;

            // Wait for scraper to complete
            let scraperAttempts = 0;
            let scraperStatus = 'RUNNING';
            let scraperDatasetId: string | null = null;
            
            while (scraperStatus === 'RUNNING' && scraperAttempts < 40) {
              await new Promise(resolve => setTimeout(resolve, 3000));
              const scraperStatusResponse = await fetch(
                `https://api.apify.com/v2/acts/crawlerbros~reddit-scraper/runs/${scraperRunId}?token=${apifyToken}`
              );
              const scraperStatusData = await scraperStatusResponse.json();
              scraperStatus = scraperStatusData.data.status;
              if (!scraperDatasetId && scraperStatusData.data.defaultDatasetId) {
                scraperDatasetId = scraperStatusData.data.defaultDatasetId;
              }
              scraperAttempts++;
            }

            if (scraperStatus !== 'SUCCEEDED' || !scraperDatasetId) {
              console.error(`Scraper did not succeed for r/${subredditName}: ${scraperStatus}`);
              continue;
            }

            // Get Reddit post data from dataset
            const scraperItemsUrl = new URL(`https://api.apify.com/v2/datasets/${scraperDatasetId}/items`);
            scraperItemsUrl.searchParams.set('token', apifyToken);
            scraperItemsUrl.searchParams.set('clean', 'true');
            scraperItemsUrl.searchParams.set('format', 'json');

            const scraperDataResponse = await fetch(scraperItemsUrl.toString());
            if (!scraperDataResponse.ok) {
              console.error(`Failed to fetch scraper dataset for r/${subredditName}`);
              continue;
            }

            const scraperData = await scraperDataResponse.json();
            console.log(`Fetched ${scraperData.length} posts from r/${subredditName} scraper`);

            // Get or create subreddit entry
            let subredditId = null;
            const { data: subredditData } = await supabase
              .from('tracked_subreddits')
              .select('id')
              .eq('subreddit_name', subredditName)
              .eq('user_id', user.id)
              .single();

            if (subredditData) {
              subredditId = subredditData.id;
            }

            // Step 3: Match Google URLs to actual Reddit posts and insert
            for (const { url, redditId, googleTitle, googleDescription } of posts) {
              // Find matching post in scraper data
              const actualPost = scraperData.find((item: any) => 
                item.id === redditId || item.name === `t3_${redditId}`
              );

              if (!actualPost) {
                console.log(`Could not find Reddit data for post ${redditId}, using Google data`);
                // Fallback to Google data if Reddit scraper didn't return this post
                const { data: insertedPost, error: insertError } = await supabase
                  .from('reddit_posts')
                  .insert({
                    reddit_id: redditId,
                    subreddit_id: subredditId,
                    keyword_id: keyword.id,
                    link: url,
                    title: googleTitle || 'No title',
                    author: null,
                    pub_date: null,
                    upvotes: 0,
                    comment_count: 0,
                    content: googleDescription || null,
                    content_snippet: googleDescription ? googleDescription.substring(0, 500) : null,
                  })
                  .select()
                  .single();

                if (!insertError && insertedPost) {
                  newPostsToAnalyze.push({ postId: insertedPost.id, post: insertedPost });
                  keywordNewPosts++;
                  totalNewPosts++;
                }
                continue;
              }

              // Insert with full Reddit data
              const pubDate = actualPost.created_utc ? new Date(actualPost.created_utc * 1000).toISOString() : null;
              
              const { data: insertedPost, error: insertError } = await supabase
                .from('reddit_posts')
                .insert({
                  reddit_id: redditId,
                  subreddit_id: subredditId,
                  keyword_id: keyword.id,
                  link: url,
                  title: actualPost.title || googleTitle || 'No title',
                  author: actualPost.author || null,
                  pub_date: pubDate,
                  iso_date: pubDate,
                  upvotes: actualPost.score || 0,
                  comment_count: actualPost.num_comments || 0,
                  content: actualPost.selftext || googleDescription || null,
                  content_snippet: actualPost.selftext ? actualPost.selftext.substring(0, 500) : (googleDescription ? googleDescription.substring(0, 500) : null),
                })
                .select()
                .single();

              if (insertError) {
                console.error('Error inserting post:', insertError);
                continue;
              }

              if (insertedPost) {
                newPostsToAnalyze.push({
                  postId: insertedPost.id,
                  post: insertedPost
                });
                keywordNewPosts++;
                totalNewPosts++;
                console.log(`Inserted new post with full data: ${insertedPost.title}`);
              }
            }

          } catch (subredditError) {
            console.error(`Error processing subreddit ${subredditName}:`, subredditError);
          }
        }

        // Update last_fetched_at for keyword
        await supabase
          .from('tracked_keywords')
          .update({ last_fetched_at: new Date().toISOString() })
          .eq('id', keyword.id);

        results.push({ 
          keyword: keyword.keyword, 
          status: 'success', 
          newPosts: keywordNewPosts 
        });

        console.log(`Fetched ${keywordNewPosts} new posts for keyword "${keyword.keyword}"`);

      } catch (error) {
        console.error(`Error processing keyword "${keyword.keyword}":`, error);
        results.push({ keyword: keyword.keyword, status: 'error', message: error.message });
      }
    }

    // Start automatic analysis of new posts in the background
    if (newPostsToAnalyze.length > 0) {
      console.log(`Starting automatic analysis for ${newPostsToAnalyze.length} new keyword posts...`);
      
      EdgeRuntime.waitUntil(
        (async () => {
          for (const { postId, post } of newPostsToAnalyze) {
            try {
              console.log(`Auto-analyzing keyword post: ${post.title}`);
              
              const { error: analyzeError } = await supabase.functions.invoke('analyze-reddit-post', {
                body: { post_id: postId, post }
              });
              
              if (analyzeError) {
                console.error(`Failed to analyze post ${postId}:`, analyzeError);
              } else {
                console.log(`Successfully analyzed keyword post: ${post.title}`);
              }
              
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err) {
              console.error(`Error auto-analyzing post ${postId}:`, err);
            }
          }
          console.log('Completed automatic analysis of all new keyword posts');
        })()
      );
    }

    return new Response(JSON.stringify({ 
      results,
      totalNewPosts,
      newPostsAnalyzing: newPostsToAnalyze.length,
      message: `Fetched ${totalNewPosts} new posts from ${keywords.length} keywords. ${newPostsToAnalyze.length} posts queued for automatic analysis.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-keyword-posts:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});