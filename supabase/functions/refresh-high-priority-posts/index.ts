import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';
import { validateAuth, unauthorizedResponse, corsHeaders } from '../_shared/auth.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    
    console.log('Starting refresh of high priority posts...');

    // Get high priority posts that need comment/upvote refresh
    // Either never fetched or last fetched more than 24 hours ago
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: posts, error: fetchError } = await supabase
      .from('reddit_posts')
      .select(`
        id,
        title,
        link,
        comments_fetched_at,
        post_reviews!inner(recommendation)
      `)
      .eq('post_reviews.recommendation', 'high_priority')
      .or(`comments_fetched_at.is.null,comments_fetched_at.lt.${oneDayAgo}`)
      .order('pub_date', { ascending: false })
      .limit(20); // Process up to 20 posts per run to avoid timeouts

    if (fetchError) {
      console.error('Error fetching high priority posts:', fetchError);
      throw fetchError;
    }

    if (!posts || posts.length === 0) {
      console.log('No high priority posts need refresh');
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No posts need refresh',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${posts.length} high priority posts to refresh`);

    // Trigger comment fetching for each post (this will also fetch upvotes)
    const results = [];
    
    for (const post of posts) {
      try {
        console.log(`Triggering comment fetch for: ${post.title}`);
        
        // Invoke fetch-reddit-comments function
        const { data, error } = await supabase.functions.invoke('fetch-reddit-comments', {
          body: { post_id: post.id }
        });

        if (error) {
          console.error(`Error fetching comments for ${post.id}:`, error);
          results.push({ post_id: post.id, status: 'error', error: error.message });
        } else {
          console.log(`Successfully triggered fetch for ${post.id}`);
          results.push({ post_id: post.id, status: 'success', data });
        }

        // Add delay between requests to respect rate limits
        if (posts.indexOf(post) < posts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        }

      } catch (error: any) {
        console.error(`Error processing post ${post.id}:`, error);
        results.push({ post_id: post.id, status: 'error', error: error.message });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`Refresh complete: ${successCount} successful, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: posts.length,
        successful: successCount,
        errors: errorCount,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error in refresh-high-priority-posts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
