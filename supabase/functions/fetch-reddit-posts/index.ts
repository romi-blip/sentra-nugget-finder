import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { subreddit_id, scheduled } = await req.json().catch(() => ({}));
    console.log('Fetching Reddit posts...', { subreddit_id, scheduled });

    // Query active subreddits
    let query = supabase
      .from('tracked_subreddits')
      .select('*')
      .eq('is_active', true);
    
    if (subreddit_id) {
      query = query.eq('id', subreddit_id);
    }

    const { data: subreddits, error: subredditError } = await query;
    
    if (subredditError) throw subredditError;
    if (!subreddits || subreddits.length === 0) {
      return new Response(JSON.stringify({ message: 'No active subreddits found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    for (const subreddit of subreddits) {
      try {
        console.log(`Fetching RSS for r/${subreddit.subreddit_name}...`);
        
        // Fetch RSS feed
        const rssResponse = await fetch(subreddit.rss_url);
        if (!rssResponse.ok) {
          throw new Error(`RSS fetch failed: ${rssResponse.status}`);
        }

        const rssText = await rssResponse.text();
        
        // Parse RSS XML (simple regex approach for Reddit RSS)
        const entryRegex = /<entry>(.*?)<\/entry>/gs;
        const entries = [...rssText.matchAll(entryRegex)];
        
        let newPostsCount = 0;
        const postsToAnalyze = [];

        for (const entryMatch of entries) {
          const entry = entryMatch[1];
          
          // Extract fields
          const idMatch = entry.match(/<id>(.*?)<\/id>/);
          const titleMatch = entry.match(/<title>(.*?)<\/title>/);
          const linkMatch = entry.match(/<link href="(.*?)"/);
          const authorMatch = entry.match(/<name>(.*?)<\/name>/);
          const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
          const contentMatch = entry.match(/<content[^>]*>(.*?)<\/content>/s);
          
          if (!idMatch || !titleMatch || !linkMatch) continue;
          
          const redditId = idMatch[1].split('/comments/')[1]?.split('/')[0] || idMatch[1];
          const title = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
          const link = linkMatch[1];
          const author = authorMatch ? authorMatch[1] : null;
          const pubDate = publishedMatch ? publishedMatch[1] : null;
          
          // Extract plain text from content HTML
          let content = contentMatch ? contentMatch[1] : null;
          if (content) {
            content = content
              .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&[^;]+;/g, ' ')
              .trim()
              .substring(0, 5000);
          }

          // Check if post already exists
          const { data: existing } = await supabase
            .from('reddit_posts')
            .select('id')
            .eq('reddit_id', redditId)
            .single();

          if (existing) continue;

          // Insert new post
          const { data: newPost, error: insertError } = await supabase
            .from('reddit_posts')
            .insert({
              reddit_id: redditId,
              subreddit_id: subreddit.id,
              title,
              link,
              author,
              pub_date: pubDate,
              iso_date: pubDate,
              content,
              content_snippet: content ? content.substring(0, 500) : null,
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error inserting post:', insertError);
            continue;
          }

          newPostsCount++;
          postsToAnalyze.push(newPost);
        }

        // Update last_fetched_at
        await supabase
          .from('tracked_subreddits')
          .update({ last_fetched_at: new Date().toISOString() })
          .eq('id', subreddit.id);

        results.push({
          subreddit: subreddit.subreddit_name,
          newPosts: newPostsCount,
        });

        // Trigger analysis for new posts
        for (const post of postsToAnalyze) {
          try {
            await supabase.functions.invoke('analyze-reddit-post', {
              body: { post_id: post.id, post },
            });
          } catch (err) {
            console.error('Error triggering analysis:', err);
          }
        }

        console.log(`Processed r/${subreddit.subreddit_name}: ${newPostsCount} new posts`);

      } catch (err) {
        console.error(`Error processing r/${subreddit.subreddit_name}:`, err);
        results.push({
          subreddit: subreddit.subreddit_name,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-reddit-posts:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
