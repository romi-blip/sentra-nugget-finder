import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const apifyToken = Deno.env.get('APIFY_API_TOKEN')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

        console.log(`Starting Apify actor for post: ${post.link}`);

        // Call Apify Reddit Posts Scraper actor (returns post metadata + comments)
        const actorId = 'vulnv~reddit-posts-scraper';
        const runUrl = new URL(`https://api.apify.com/v2/acts/${actorId}/runs`);
        runUrl.searchParams.set('token', apifyToken);
        runUrl.searchParams.set('waitForFinish', '120'); // wait up to 120s

        const actorInput = {
          postUrls: [post.link],
        };

        // Add delay to respect rate limits
        if (results.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const runResponse = await fetch(runUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(actorInput),
        });

        if (!runResponse.ok) {
          const errorText = await runResponse.text();
          console.error(`Apify run failed: ${runResponse.status}`, errorText);
          results.push({ 
            post_id: post.id, 
            status: 'error', 
            error: `Apify HTTP ${runResponse.status}` 
          });
          continue;
        }

        const runData = await runResponse.json();
        console.log('Apify run status:', runData.data?.status);

        if (runData.data?.status !== 'SUCCEEDED') {
          console.error('Apify run did not succeed:', runData.data?.status);
          results.push({ 
            post_id: post.id, 
            status: 'error', 
            error: `Apify run ${runData.data?.status || 'failed'}` 
          });
          continue;
        }

        // Fetch scraped comments from dataset
        const datasetId = runData.data.defaultDatasetId;
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

        const scrapedData = await itemsResponse.json();
        console.log(`Fetched ${scrapedData.length} result(s) from Apify`);

        // Extract post data and comments from the first result
        const postData = scrapedData[0] || {};
        const postUpvotes = postData.score || null;
        const rawComments = postData.comments || [];
        
        console.log(`Post upvotes: ${postUpvotes}, Comments: ${rawComments.length}`);

        // Map Apify comments to our schema
        type TopComment = {
          author: string;
          body: string;
          score: number;
          created_utc: number | string;
        };

        const normalizedComments: TopComment[] = rawComments
          .filter((c: any) => c.body && c.body.trim()) // Filter out empty comments
          .map((c: any) => ({
            author: c.author || 'unknown',
            body: String(c.body || '').substring(0, 500),
            score: Number(c.score || 0),
            created_utc: c.created_utc || Date.now() / 1000,
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
