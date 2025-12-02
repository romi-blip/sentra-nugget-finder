import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#32;': ' ',
  };
  
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replaceAll(entity, char);
  }
  
  // Handle numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  return decoded;
}

// Strip HTML tags and decode entities
function cleanHtmlContent(html: string): string {
  if (!html) return '';
  
  // Remove CDATA wrapper
  let clean = html.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
  
  // First decode HTML entities so tags/comments become real HTML
  clean = decodeHtmlEntities(clean);
  
  // Remove HTML comments like <!-- SC_OFF -->, <!-- SC_ON -->
  clean = clean.replace(/<!--.*?-->/gs, ' ');
  
  // Remove script and style tags with their content
  clean = clean.replace(/<(script|style)[^>]*>.*?<\/\1>/gis, ' ');
  
  // Remove all remaining HTML tags
  clean = clean.replace(/<[^>]+>/g, ' ');
  
  // Drop common Reddit footer starting with "submitted by"
  clean = clean.replace(/submitted by.*$/i, ' ');
  
  // Final whitespace normalization
  clean = clean.replace(/\s+/g, ' ').trim();
  
  return clean;
}

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
    const newPostsToAnalyze: Array<{ postId: string; post: any }> = [];

    for (const subreddit of subreddits) {
      try {
        console.log(`Fetching RSS for r/${subreddit.subreddit_name}...`);
        
        // Fetch RSS feed
        const rssResponse = await fetch(subreddit.rss_url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)'
          }
        });
        
        if (!rssResponse.ok) {
          throw new Error(`RSS fetch failed: ${rssResponse.status}`);
        }

        const rssText = await rssResponse.text();
        
        // Parse RSS XML - limit to first 10 entries for performance
        const entryRegex = /<entry>(.*?)<\/entry>/gs;
        const allEntries = [...rssText.matchAll(entryRegex)];
        const entries = allEntries.slice(0, 10); // Process only latest 10
        
        let newPostsCount = 0;

        for (const entryMatch of entries) {
          const entry = entryMatch[1];
          
          // Extract fields with safer regex
          const idMatch = entry.match(/<id>([^<]+)<\/id>/);
          const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
          const linkMatch = entry.match(/<link href="([^"]+)"/);
          const authorMatch = entry.match(/<name>([^<]+)<\/name>/);
          const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
          const contentMatch = entry.match(/<content[^>]*>(.*?)<\/content>/s);
          
          if (!idMatch || !titleMatch || !linkMatch) continue;
          
          const redditId = idMatch[1].split('/comments/')[1]?.split('/')[0] || idMatch[1];
          const title = decodeHtmlEntities(titleMatch[1]);
          const link = linkMatch[1];
          const author = authorMatch ? decodeHtmlEntities(authorMatch[1]) : null;
          const pubDate = publishedMatch ? publishedMatch[1] : null;
          
          // Clean content
          let content = contentMatch ? cleanHtmlContent(contentMatch[1]) : null;
          if (content && content.length > 5000) {
            content = content.substring(0, 5000);
          }

          // Check if post already exists
          const { data: existing } = await supabase
            .from('reddit_posts')
            .select('id')
            .eq('reddit_id', redditId)
            .maybeSingle();

          if (existing) continue;

          // Insert new post and get the inserted data
          const { data: insertedPost, error: insertError } = await supabase
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

          if (insertedPost) {
            // Queue this post for automatic analysis
            newPostsToAnalyze.push({
              postId: insertedPost.id,
              post: insertedPost
            });
          }

          newPostsCount++;
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

        console.log(`Processed r/${subreddit.subreddit_name}: ${newPostsCount} new posts`);

      } catch (err) {
        console.error(`Error processing r/${subreddit.subreddit_name}:`, err);
        results.push({
          subreddit: subreddit.subreddit_name,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Start automatic analysis of new posts in the background
    if (newPostsToAnalyze.length > 0) {
      console.log(`Starting automatic analysis for ${newPostsToAnalyze.length} new posts...`);
      
      // Use background task to analyze posts without blocking response
      EdgeRuntime.waitUntil(
        (async () => {
          for (const { postId, post } of newPostsToAnalyze) {
            try {
              console.log(`Auto-analyzing post: ${post.title}`);
              
              // Invoke analyze-reddit-post function
              const { error: analyzeError } = await supabase.functions.invoke('analyze-reddit-post', {
                body: { postId, post }
              });
              
              if (analyzeError) {
                console.error(`Failed to analyze post ${postId}:`, analyzeError);
              } else {
                console.log(`Successfully analyzed post: ${post.title}`);
              }
              
              // Small delay between analyses to avoid overwhelming the system
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err) {
              console.error(`Error auto-analyzing post ${postId}:`, err);
            }
          }
          console.log('Completed automatic analysis of all new posts');
        })()
      );
    }

    return new Response(JSON.stringify({ 
      results,
      newPostsAnalyzing: newPostsToAnalyze.length,
      message: `Posts fetched. ${newPostsToAnalyze.length} new posts queued for automatic analysis.`
    }), {
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
