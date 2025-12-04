import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    
    if (!apifyToken) {
      return new Response(JSON.stringify({ error: 'APIFY_API_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Create client for user auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { reddit_username } = await req.json();
    
    if (!reddit_username) {
      return new Response(JSON.stringify({ error: 'Missing reddit_username' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean username (remove u/ prefix if present)
    const cleanUsername = reddit_username.replace(/^u\//, '').trim();
    
    console.log(`Fetching Reddit profile via Apify for: ${cleanUsername}`);

    // Use Apify Reddit User Profile Posts Scraper to get profile data
    const actorId = 'louisdeconinck~reddit-user-profile-posts-scraper';
    const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`;
    
    // Actor requires startUrls format with Reddit user profile URLs
    const profileUrl = `https://www.reddit.com/user/${cleanUsername}`;
    
    const runResponse = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: profileUrl }],
        maxItems: 10,
        sort: 'new',
      }),
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Failed to start Apify actor:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to start profile scraper' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`Apify run started: ${runId}`);

    // Poll for completion (max 90 seconds)
    let attempts = 0;
    const maxAttempts = 18;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
      );
      const statusData = await statusResponse.json();
      
      if (statusData.data.status === 'SUCCEEDED') {
        console.log('Apify run completed');
        break;
      } else if (statusData.data.status === 'FAILED' || statusData.data.status === 'ABORTED') {
        console.error('Apify run failed:', statusData.data.status);
        return new Response(JSON.stringify({ error: 'Profile scraper failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return new Response(JSON.stringify({ error: 'Profile scraper timed out' }), {
        status: 504,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch results
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}`
    );
    const results = await resultsResponse.json();
    
    console.log(`Got ${results.length} items from Apify`);

    if (!results || results.length === 0) {
      return new Response(JSON.stringify({ error: 'No profile data found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract profile data from results
    // The scraper returns posts/comments with author info
    const firstItem = results[0];
    const authorData = firstItem.author || {};
    
    // Calculate karma from items if available
    let totalPostKarma = 0;
    let totalCommentKarma = 0;
    
    for (const item of results) {
      if (item.type === 'post' || !item.type) {
        totalPostKarma += item.score || item.ups || 0;
      } else if (item.type === 'comment') {
        totalCommentKarma += item.score || item.ups || 0;
      }
    }

    // Build profile record
    const profileRecord = {
      user_id: user.id,
      reddit_username: cleanUsername,
      display_name: authorData.name || cleanUsername,
      profile_url: `https://www.reddit.com/user/${cleanUsername}`,
      avatar_url: authorData.avatar || authorData.iconUrl || null,
      link_karma: authorData.linkKarma || authorData.postKarma || totalPostKarma,
      comment_karma: authorData.commentKarma || totalCommentKarma,
      total_karma: (authorData.linkKarma || 0) + (authorData.commentKarma || 0) || 
                   (authorData.totalKarma) || 
                   totalPostKarma + totalCommentKarma,
      account_created_at: authorData.createdAt ? new Date(authorData.createdAt).toISOString() : null,
      is_verified: authorData.verified || false,
      is_premium: authorData.isPremium || authorData.isGold || false,
      description: authorData.description || authorData.publicDescription || null,
      last_synced_at: new Date().toISOString(),
    };

    console.log('Profile record:', JSON.stringify(profileRecord));

    // Upsert profile
    const { data: profile, error: upsertError } = await supabase
      .from('reddit_profiles')
      .upsert(profileRecord, {
        onConflict: 'user_id,reddit_username',
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Error upserting profile:', upsertError);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Profile saved: ${profile.id}`);

    // Save activity from results
    for (const item of results) {
      const activityRecord = {
        profile_id: profile.id,
        activity_type: item.type === 'comment' ? 'comment' : 'post',
        reddit_id: item.id || item.name || `${Date.now()}_${Math.random()}`,
        subreddit: item.subreddit || item.subredditName,
        title: item.title || null,
        content: item.body || item.selftext || null,
        permalink: item.permalink ? 
          (item.permalink.startsWith('http') ? item.permalink : `https://www.reddit.com${item.permalink}`) : 
          null,
        score: item.score || item.ups || 0,
        num_comments: item.numComments || item.num_comments || 0,
        posted_at: item.createdAt ? new Date(item.createdAt).toISOString() : 
                   item.created_utc ? new Date(item.created_utc * 1000).toISOString() : 
                   new Date().toISOString(),
      };

      const { error: activityError } = await supabase
        .from('reddit_profile_activity')
        .upsert(activityRecord, { onConflict: 'profile_id,reddit_id' });
      
      if (activityError) {
        console.error('Error inserting activity:', activityError);
      }
    }

    console.log(`Saved ${results.length} activity items`);

    return new Response(JSON.stringify({ 
      success: true, 
      profile,
      activityCount: results.length,
      message: 'Profile and activity fetched successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-reddit-profile:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
