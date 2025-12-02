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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting refresh of keyword posts with incomplete data...');

    // Find keyword posts with null pub_date or author
    const { data: postsNeedingRefresh, error: fetchError } = await supabase
      .from('reddit_posts')
      .select('id, reddit_id, link, keyword_id, title')
      .not('keyword_id', 'is', null)
      .or('pub_date.is.null,author.is.null')
      .limit(100);

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

    let updatedCount = 0;
    let errorCount = 0;

    for (const post of postsNeedingRefresh) {
      try {
        // Extract subreddit and reddit_id from link
        const match = post.link.match(REDDIT_POST_REGEX);
        if (!match) {
          console.warn(`Could not parse link for post ${post.id}: ${post.link}`);
          errorCount++;
          continue;
        }

        const [, subredditName, redditId] = match;
        console.log(`Fetching data for post in r/${subredditName}: ${post.title.substring(0, 50)}...`);

        // Fetch from Reddit JSON API
        const response = await fetch(
          `https://www.reddit.com/r/${subredditName}/comments/${redditId}.json`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; SentraBot/1.0)',
            },
          }
        );

        if (!response.ok) {
          console.error(`Reddit API returned ${response.status} for post ${post.id}`);
          errorCount++;
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        const data = await response.json();
        const postData = data[0]?.data?.children?.[0]?.data;

        if (!postData) {
          console.error(`No post data found for ${post.id}`);
          errorCount++;
          continue;
        }

        // Update the post with correct data
        const { error: updateError } = await supabase
          .from('reddit_posts')
          .update({
            author: postData.author || null,
            pub_date: postData.created_utc 
              ? new Date(postData.created_utc * 1000).toISOString() 
              : null,
            iso_date: postData.created_utc 
              ? new Date(postData.created_utc * 1000).toISOString() 
              : null,
            upvotes: postData.score || 0,
            comment_count: postData.num_comments || 0,
            content: postData.selftext || null,
            content_snippet: postData.selftext 
              ? postData.selftext.substring(0, 500) 
              : null,
          })
          .eq('id', post.id);

        if (updateError) {
          console.error(`Error updating post ${post.id}:`, updateError);
          errorCount++;
        } else {
          console.log(`Updated post: ${post.title.substring(0, 50)}...`);
          updatedCount++;
        }

        // Rate limit: wait between requests
        await new Promise(resolve => setTimeout(resolve, 1500));

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
