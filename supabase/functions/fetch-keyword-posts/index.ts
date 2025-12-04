import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateAuth, unauthorizedResponse, corsHeaders } from '../_shared/auth.ts';

const REDDIT_POST_REGEX = /(?:https?:\/\/)?(?:www\.)?reddit\.com\/r\/([^\/]+)\/comments\/([a-zA-Z0-9]+)(?:\/([^\/\?]+))?/;
const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;

function isPostTooOld(pubDate: string | null): boolean {
  if (!pubDate) return false; // Allow posts without dates to be filtered in UI
  const postTime = new Date(pubDate).getTime();
  const cutoffTime = Date.now() - THREE_MONTHS_MS;
  return postTime < cutoffTime;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication (user JWT or service role for internal calls)
    const auth = await validateAuth(req);
    if (!auth.valid) {
      return unauthorizedResponse();
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apifyToken = Deno.env.get('APIFY_API_TOKEN');

    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from auth result (for user-specific queries)
    const userId = auth.userId;
    if (!userId && !auth.isServiceRole) {
      return unauthorizedResponse();
    }

    // Fetch active keywords for this user (or all if service role)
    let keywordQuery = supabase
      .from('tracked_keywords')
      .select('*')
      .eq('is_active', true);
    
    if (userId) {
      keywordQuery = keywordQuery.eq('user_id', userId);
    }
    
    const { data: keywords, error: keywordsError } = await keywordQuery;

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

        // Build search query with negative keywords
        const negativeKeywords = keyword.negative_keywords || [];
        let searchQuery = `site:reddit.com "${keyword.keyword}"`;
        
        // Add negative keywords to exclude from search
        if (negativeKeywords.length > 0) {
          const excludeTerms = negativeKeywords.map(nk => `-"${nk}"`).join(' ');
          searchQuery = `${searchQuery} ${excludeTerms}`;
        }
        
        console.log(`Search query: ${searchQuery}`);
        
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
        
        // Process each search result and fetch post data directly from Reddit JSON API
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

            // Fetch post directly from Reddit JSON API
            try {
              const jsonUrl = `https://www.reddit.com/r/${subredditName}/comments/${redditId}.json`;
              console.log(`Fetching post data from: ${jsonUrl}`);
              
              const response = await fetch(jsonUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; DataSecurityBot/1.0)'
                }
              });

              if (response.ok) {
                const data = await response.json();
                // Reddit returns [postData, commentsData]
                const postData = data[0]?.data?.children?.[0]?.data;

                if (postData) {
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

                  const pubDate = postData.created_utc ? new Date(postData.created_utc * 1000).toISOString() : null;

                  // Skip posts older than 3 months
                  if (isPostTooOld(pubDate)) {
                    console.log(`Skipping old post ${redditId} from ${pubDate}`);
                    continue;
                  }

                  // Insert with full Reddit data
                  const { data: insertedPost, error: insertError } = await supabase
                    .from('reddit_posts')
                    .insert({
                      reddit_id: redditId,
                      subreddit_id: subredditId,
                      keyword_id: keyword.id,
                      link: url,
                      title: postData.title || result.title || 'No title',
                      author: postData.author || null,
                      pub_date: pubDate,
                      iso_date: pubDate,
                      upvotes: postData.score || 0,
                      comment_count: postData.num_comments || 0,
                      content: postData.selftext || result.description || null,
                      content_snippet: (postData.selftext || result.description || '').substring(0, 500),
                    })
                    .select()
                    .single();

                  if (!insertError && insertedPost) {
                    newPostsToAnalyze.push({ postId: insertedPost.id, post: insertedPost });
                    keywordNewPosts++;
                    totalNewPosts++;
                    console.log(`✓ Inserted post with full data: ${insertedPost.title}`);
                  } else if (insertError) {
                    console.error('Error inserting post:', insertError);
                  }
                } else {
                  console.log(`No post data found in Reddit API response for ${redditId}`);
                }
              } else {
                console.log(`Reddit API returned ${response.status} for ${redditId}, using Google data fallback`);
                // Fallback to Google data if Reddit API fails
                const { data: insertedPost, error: insertError } = await supabase
                  .from('reddit_posts')
                  .insert({
                    reddit_id: redditId,
                    keyword_id: keyword.id,
                    link: url,
                    title: result.title || 'No title',
                    author: null,
                    pub_date: null,
                    upvotes: 0,
                    comment_count: 0,
                    content: result.description || null,
                    content_snippet: result.description ? result.description.substring(0, 500) : null,
                  })
                  .select()
                  .single();

                if (!insertError && insertedPost) {
                  newPostsToAnalyze.push({ postId: insertedPost.id, post: insertedPost });
                  keywordNewPosts++;
                  totalNewPosts++;
                }
              }

              // Add delay between requests to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 1500));

            } catch (fetchError) {
              console.error(`Error fetching post ${redditId}:`, fetchError);
              // Fallback to Google data on error
              const { data: insertedPost, error: insertError } = await supabase
                .from('reddit_posts')
                .insert({
                  reddit_id: redditId,
                  keyword_id: keyword.id,
                  link: url,
                  title: result.title || 'No title',
                  author: null,
                  pub_date: null,
                  upvotes: 0,
                  comment_count: 0,
                  content: result.description || null,
                  content_snippet: result.description ? result.description.substring(0, 500) : null,
                })
                .select()
                .single();

              if (!insertError && insertedPost) {
                newPostsToAnalyze.push({ postId: insertedPost.id, post: insertedPost });
                keywordNewPosts++;
                totalNewPosts++;
              }
            }
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

    // Also find existing unreviewed keyword posts to analyze
    const keywordIds = keywords.map(k => k.id);
    const { data: existingUnreviewedPosts } = await supabase
      .from('reddit_posts')
      .select(`
        id, reddit_id, title, content, content_snippet, author, 
        pub_date, upvotes, comment_count, subreddit_id, keyword_id,
        post_reviews!left(id)
      `)
      .in('keyword_id', keywordIds)
      .order('created_at', { ascending: false })
      .limit(50);

    // Filter to posts without reviews
    const postsNeedingAnalysis = (existingUnreviewedPosts || []).filter(
      post => !post.post_reviews || post.post_reviews.length === 0
    );

    // Combine new posts and existing unreviewed posts
    const allPostsToAnalyze = [
      ...newPostsToAnalyze,
      ...postsNeedingAnalysis
        .filter(p => !newPostsToAnalyze.some(np => np.postId === p.id))
        .map(p => ({ postId: p.id, post: p }))
    ];

    // Start automatic analysis in the background
    if (allPostsToAnalyze.length > 0) {
      console.log(`Starting automatic analysis for ${allPostsToAnalyze.length} keyword posts (${newPostsToAnalyze.length} new, ${postsNeedingAnalysis.length} existing unreviewed)...`);
      
      EdgeRuntime.waitUntil(
        (async () => {
          for (const { postId, post } of allPostsToAnalyze) {
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
              
              await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (err) {
              console.error(`Error auto-analyzing post ${postId}:`, err);
            }
          }
          console.log('Completed automatic analysis of all keyword posts');
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
