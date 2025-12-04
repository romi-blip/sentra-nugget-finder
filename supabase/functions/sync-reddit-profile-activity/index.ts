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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // Check for scheduled job (anon key) or service role
    const isScheduled = token === supabaseAnonKey;
    const isServiceRole = token === supabaseServiceKey;
    
    let userId: string | null = null;
    
    if (!isScheduled && !isServiceRole) {
      // Validate user JWT
      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader! } },
      });
      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = user.id;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body = await req.json().catch(() => ({}));
    const { profile_id } = body;

    // Build query for profiles to sync
    let query = supabase
      .from('reddit_profiles')
      .select('*')
      .eq('is_active', true);

    if (profile_id) {
      query = query.eq('id', profile_id);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }
    // If scheduled, sync all active profiles

    const { data: profiles, error: profilesError } = await query;

    if (profilesError) {
      return new Response(JSON.stringify({ error: profilesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Syncing ${profiles?.length || 0} profiles`);

    const results = [];
    
    for (const profile of profiles || []) {
      try {
        // Update karma from Reddit API
        const redditResponse = await fetch(
          `https://www.reddit.com/user/${profile.reddit_username}/about.json`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; SentraBot/1.0)',
            },
          }
        );

        if (redditResponse.ok) {
          const redditData = await redditResponse.json();
          const profileData = redditData.data;
          
          await supabase
            .from('reddit_profiles')
            .update({
              link_karma: profileData.link_karma || 0,
              comment_karma: profileData.comment_karma || 0,
              total_karma: profileData.total_karma || 0,
              avatar_url: profileData.icon_img?.split('?')[0] || profile.avatar_url,
              is_premium: profileData.is_gold || false,
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', profile.id);
        }

        // Sync activity via Apify
        if (apifyToken) {
          await syncActivity(profile, supabase, apifyToken);
        }

        results.push({ profile_id: profile.id, status: 'success' });
        
        // Rate limit between profiles
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Error syncing profile ${profile.id}:`, error);
        results.push({ profile_id: profile.id, status: 'error', error: error.message });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      synced: results.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in sync-reddit-profile-activity:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function syncActivity(profile: any, supabase: any, apifyToken: string) {
  console.log(`Syncing activity for: ${profile.reddit_username}`);
  
  const actorId = 'louisdeconinck~reddit-user-profile-posts-scraper';
  const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`;
  
  const runResponse = await fetch(runUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usernames: [profile.reddit_username],
      maxItems: 30,
      sort: 'new',
      includeComments: true,
    }),
  });

  if (!runResponse.ok) {
    throw new Error('Failed to start Apify actor');
  }

  const runData = await runResponse.json();
  const runId = runData.data.id;

  // Poll for completion (max 90 seconds)
  let attempts = 0;
  while (attempts < 18) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
    );
    const statusData = await statusResponse.json();
    
    if (statusData.data.status === 'SUCCEEDED') break;
    if (statusData.data.status === 'FAILED' || statusData.data.status === 'ABORTED') {
      throw new Error(`Apify run ${statusData.data.status}`);
    }
    
    attempts++;
  }

  // Fetch and save results
  const resultsResponse = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}`
  );
  const results = await resultsResponse.json();

  for (const item of results) {
    const activityRecord = {
      profile_id: profile.id,
      activity_type: item.type === 'comment' ? 'comment' : 'post',
      reddit_id: item.id || item.name,
      subreddit: item.subreddit || item.subredditName,
      title: item.title || null,
      content: item.body || item.selftext || null,
      permalink: item.permalink ? `https://www.reddit.com${item.permalink}` : null,
      score: item.score || item.ups || 0,
      num_comments: item.numComments || item.num_comments || 0,
      posted_at: item.createdAt ? new Date(item.createdAt).toISOString() : 
                 item.created_utc ? new Date(item.created_utc * 1000).toISOString() : null,
    };

    await supabase
      .from('reddit_profile_activity')
      .upsert(activityRecord, { onConflict: 'profile_id,reddit_id' });
  }

  console.log(`Synced ${results.length} activities for ${profile.reddit_username}`);
}
