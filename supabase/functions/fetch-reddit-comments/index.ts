import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';
import { validateAuth, unauthorizedResponse, corsHeaders } from '../_shared/auth.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const apifyToken = Deno.env.get('APIFY_API_TOKEN')!;

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { post_id, subreddit_id } = await req.json();

    console.log('Fetching comments for:', { post_id, subreddit_id });

    // Build query to get posts
    let query = supabase
      .from('reddit_posts')
      .select('id, link, reddit_id, comment_count, comments_fetched_at');

    if (post_id) {
      query = query.eq('id', post_id);
    } else if (subreddit_id) {
      query = query.eq('subreddit_id', subreddit_id);
    } else {
      throw new Error('Either post_id or subreddit_id must be provided');
    }

    const { data: posts, error: fetchError } = await query;

    if (fetchError) throw fetchError;
    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No posts found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    
    for (const post of posts) {
      try {
        // Skip if fetched recently (within 1 hour)
        if (post.comments_fetched_at) {
          const lastFetch = new Date(post.comments_fetched_at).getTime();
          const now = Date.now();
          if (now - lastFetch < 3600000) {
            console.log(`Skipping post ${post.id} - fetched recently`);
            results.push({ post_id: post.id, status: 'skipped', reason: 'recently_fetched' });
            continue;
          }
        }

        console.log(`Starting Apify actors for post: ${post.link}`);

        // Step 1: Fetch post metadata (including upvotes) using reddit-scraper
        const scraperActorId = 'crawlerbros~reddit-scraper';
        const scraperRunUrl = new URL(`https://api.apify.com/v2/acts/${scraperActorId}/runs`);
        scraperRunUrl.searchParams.set('token', apifyToken);
        scraperRunUrl.searchParams.set('waitForFinish', '120');

        // Extract subreddit name from post link (e.g. https://www.reddit.com/r/sysadmin/...)
        const subredditMatch = post.link?.match(/reddit\.com\/r\/([^/]+)/i);
        const subredditName = subredditMatch?.[1];

        let postUpvotes = null;

        if (!subredditName) {
          console.warn(`Could not extract subreddit name from link: ${post.link}`);
        } else {
          const scraperInput = {
            subreddits: [subredditName],
            maxPosts: 200,
            sort: 'hot', // Use 'hot' to capture engaging posts that may be older
          };

          // Add delay to respect rate limits between Apify actor runs
          if (results.length > 0) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }

          // Fetch post metadata for upvotes
          const scraperResponse = await fetch(scraperRunUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scraperInput),
          });

          if (!scraperResponse.ok) {
            const errorText = await scraperResponse.text();
            console.error(`Apify reddit-scraper run failed: ${scraperResponse.status}`, errorText);
          } else {
            const scraperRunData = await scraperResponse.json();
            console.log('Apify reddit-scraper status:', scraperRunData.data?.status);

            if (scraperRunData.data?.status === 'SUCCEEDED') {
              const scraperDatasetId = scraperRunData.data.defaultDatasetId;
              if (scraperDatasetId) {
                const scraperItemsUrl = new URL(`https://api.apify.com/v2/datasets/${scraperDatasetId}/items`);
                scraperItemsUrl.searchParams.set('token', apifyToken);
                scraperItemsUrl.searchParams.set('clean', 'true');
                scraperItemsUrl.searchParams.set('format', 'json');

                const scraperItemsResponse = await fetch(scraperItemsUrl.toString());
                if (!scraperItemsResponse.ok) {
                  console.error(`Failed to fetch reddit-scraper dataset: ${scraperItemsResponse.status}`);
                } else {
                  const scraperData = await scraperItemsResponse.json();
                  console.log(
                    `reddit-scraper returned ${Array.isArray(scraperData) ? scraperData.length : 0} items for r/${subredditName}`
                  );

                  if (Array.isArray(scraperData) && scraperData.length > 0) {
                    // Extract the bare ID (without t3_ prefix) for matching
                    const bareRedditId = post.reddit_id.replace(/^t3_/, '');
                    
                    const matchingPost = scraperData.find((item: any) => {
                      const postId = item.post_id || item.postId || item.id;
                      const postName = item.post_name || item.postName || item.name;
                      const permalink: string | undefined = item.permalink;
                      const url: string | undefined = item.url;
                      
                      return (
                        postId === bareRedditId ||
                        postId === post.reddit_id ||
                        postName === post.reddit_id ||
                        postName === `t3_${bareRedditId}` ||
                        permalink?.includes(bareRedditId) ||
                        url?.includes(bareRedditId)
                      );
                    });

                    if (matchingPost) {
                      postUpvotes = matchingPost.score ?? matchingPost.upvotes ?? null;
                      console.log(
                        `Extracted upvotes for post ${post.id} (reddit_id: ${post.reddit_id}) from r/${subredditName}: ${postUpvotes}`
                      );
                    } else {
                      console.log(
                        `No matching post found in reddit-scraper dataset for reddit_id ${post.reddit_id} in r/${subredditName}`
                      );
                    }
                  }
                }
              }
            }
          }
        }

        // Step 2: Fetch comments using reddit-comment-scraper
        const commentActorId = 'crawlerbros~reddit-comment-scraper';
        const commentRunUrl = new URL(`https://api.apify.com/v2/acts/${commentActorId}/runs`);
        commentRunUrl.searchParams.set('token', apifyToken);
        commentRunUrl.searchParams.set('waitForFinish', '120');

        const commentInput = {
          postUrls: [post.link],
        };

        const commentResponse = await fetch(commentRunUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(commentInput),
        });

        if (!commentResponse.ok) {
          const errorText = await commentResponse.text();
          console.error(`Apify comment run failed: ${commentResponse.status}`, errorText);
          results.push({ 
            post_id: post.id, 
            status: 'error', 
            error: `Apify HTTP ${commentResponse.status}` 
          });
          continue;
        }

        const commentRunData = await commentResponse.json();
        console.log('Apify comment run status:', commentRunData.data?.status);

        if (commentRunData.data?.status !== 'SUCCEEDED') {
          console.error('Apify comment run did not succeed:', commentRunData.data?.status);
          results.push({ 
            post_id: post.id, 
            status: 'error', 
            error: `Apify run ${commentRunData.data?.status || 'failed'}` 
          });
          continue;
        }

        // Fetch comments from dataset
        const datasetId = commentRunData.data.defaultDatasetId;
        if (!datasetId) {
          console.error('No dataset ID returned from Apify');
          results.push({ 
            post_id: post.id, 
            status: 'error', 
            error: 'No dataset ID' 
          });
          continue;
        }

        const itemsUrl = new URL(`https://api.apify.com/v2/datasets/${datasetId}/items`);
        itemsUrl.searchParams.set('token', apifyToken);
        itemsUrl.searchParams.set('clean', 'true');
        itemsUrl.searchParams.set('format', 'json');

        const itemsResponse = await fetch(itemsUrl.toString());
        if (!itemsResponse.ok) {
          console.error(`Failed to fetch dataset: ${itemsResponse.status}`);
          results.push({ 
            post_id: post.id, 
            status: 'error', 
            error: `Dataset fetch HTTP ${itemsResponse.status}` 
          });
          continue;
        }

        const comments = await itemsResponse.json();
        console.log(`Fetched ${comments.length} comments from Apify`);

        // Map Apify comments to our schema
        type TopComment = {
          author: string;
          body: string;
          score: number;
          created_utc: number | string;
        };

        const normalizedComments: TopComment[] = comments
          .filter((c: any) => c.comment || c.text) // Filter out empty comments
          .map((c: any) => ({
            author: c.author || 'unknown',
            body: String(c.comment || c.text || '').substring(0, 500),
            score: Number(c.score || c.upvotes || 0),
            created_utc: c.created_utc || c.created || Date.now() / 1000,
          }));

        // Sort by score descending and take top 10
        normalizedComments.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const topComments = normalizedComments.slice(0, 10);
        const commentCount = normalizedComments.length;

        console.log(`Processed ${commentCount} comments, top 10 selected, post upvotes: ${postUpvotes}`);

        // Update database with comments and upvotes
        const updateData: any = {
          comment_count: commentCount,
          top_comments: topComments,
          comments_fetched_at: new Date().toISOString()
        };
        
        if (postUpvotes !== null) {
          updateData.upvotes = postUpvotes;
        }

        const { error: updateError } = await supabase
          .from('reddit_posts')
          .update(updateData)
          .eq('id', post.id);

        if (updateError) {
          console.error(`Error updating post ${post.id}:`, updateError);
          results.push({ 
            post_id: post.id, 
            status: 'error', 
            error: updateError.message 
          });
        } else {
          console.log(`Updated post ${post.id} with ${commentCount} comments`);
          results.push({ 
            post_id: post.id, 
            status: 'success', 
            comment_count: commentCount,
            top_comments_count: topComments.length
          });
        }

      } catch (error: any) {
        console.error(`Error processing post ${post.id}:`, error);
        results.push({ 
          post_id: post.id, 
          status: 'error', 
          error: error.message 
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: results.length,
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in fetch-reddit-comments:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
