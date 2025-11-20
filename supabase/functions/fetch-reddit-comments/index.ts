import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

        // Construct JSON API URL
        const jsonUrl = `${post.link}.json`;
        console.log(`Fetching comments from: ${jsonUrl}`);

        // Add delay to respect rate limits (1 request per second)
        if (results.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const response = await fetch(jsonUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; RedditEngagementBot/1.0)'
          }
        });

        if (!response.ok) {
          console.error(`Failed to fetch comments: ${response.status}`);
          results.push({ 
            post_id: post.id, 
            status: 'error', 
            error: `HTTP ${response.status}` 
          });
          continue;
        }

        const data = await response.json();
        
        // Reddit JSON API returns an array: [post_data, comments_data]
        if (!Array.isArray(data) || data.length < 2) {
          console.error('Unexpected Reddit API response structure');
          results.push({ 
            post_id: post.id, 
            status: 'error', 
            error: 'Invalid response structure' 
          });
          continue;
        }

        const commentsData = data[1]?.data?.children || [];
        
        // Extract comment count from post data
        const postData = data[0]?.data?.children?.[0]?.data;
        const commentCount = postData?.num_comments || 0;

        // Extract top comments
        const topComments = commentsData
          .filter((c: any) => c.kind === 't1' && c.data?.body) // Filter actual comments
          .slice(0, 10)
          .map((c: any) => ({
            author: c.data.author,
            body: c.data.body.substring(0, 500), // Limit to 500 chars
            score: c.data.score || 0,
            created_utc: c.data.created_utc
          }));

        // Update database
        const { error: updateError } = await supabase
          .from('reddit_posts')
          .update({
            comment_count: commentCount,
            top_comments: topComments,
            comments_fetched_at: new Date().toISOString()
          })
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
