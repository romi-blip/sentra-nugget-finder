import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RedditProfileData {
  name: string;
  icon_img?: string;
  link_karma: number;
  comment_karma: number;
  total_karma: number;
  created_utc: number;
  is_gold?: boolean;
  verified?: boolean;
  subreddit?: {
    public_description?: string;
    display_name_prefixed?: string;
  };
}

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
    
    console.log(`Fetching Reddit profile for: ${cleanUsername}`);

    // Fetch profile from Reddit's public JSON API
    const redditResponse = await fetch(
      `https://www.reddit.com/user/${cleanUsername}/about.json`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SentraBot/1.0)',
        },
      }
    );

    if (!redditResponse.ok) {
      console.error(`Reddit API error: ${redditResponse.status}`);
      return new Response(JSON.stringify({ 
        error: `Failed to fetch Reddit profile: ${redditResponse.status}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const redditData = await redditResponse.json();
    const profileData: RedditProfileData = redditData.data;

    if (!profileData || !profileData.name) {
      return new Response(JSON.stringify({ error: 'Invalid Reddit profile data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Got Reddit profile data for: ${profileData.name}`);

    // Prepare profile record
    const profileRecord = {
      user_id: user.id,
      reddit_username: profileData.name,
      display_name: profileData.subreddit?.display_name_prefixed || profileData.name,
      profile_url: `https://www.reddit.com/user/${profileData.name}`,
      avatar_url: profileData.icon_img?.split('?')[0] || null,
      link_karma: profileData.link_karma || 0,
      comment_karma: profileData.comment_karma || 0,
      total_karma: profileData.total_karma || (profileData.link_karma + profileData.comment_karma),
      account_created_at: new Date(profileData.created_utc * 1000).toISOString(),
      is_verified: profileData.verified || false,
      is_premium: profileData.is_gold || false,
      description: profileData.subreddit?.public_description || null,
      last_synced_at: new Date().toISOString(),
    };

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

    // Trigger activity sync in background
    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (apifyToken && profile) {
      EdgeRuntime.waitUntil(syncProfileActivity(profile.id, cleanUsername, supabase, apifyToken));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      profile,
      message: 'Profile fetched and activity sync started'
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

async function syncProfileActivity(
  profileId: string, 
  username: string, 
  supabase: any, 
  apifyToken: string
) {
  try {
    console.log(`Starting activity sync for profile: ${profileId}`);
    
    // Use Apify Reddit User Profile Posts Scraper
    const actorId = 'louisdeconinck~reddit-user-profile-posts-scraper';
    const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`;
    
    const runResponse = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames: [username],
        maxItems: 50,
        sort: 'new',
        includeComments: true,
      }),
    });

    if (!runResponse.ok) {
      console.error('Failed to start Apify actor:', await runResponse.text());
      return;
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`Apify run started: ${runId}`);

    // Poll for completion (max 2 minutes)
    let attempts = 0;
    const maxAttempts = 24;
    
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
        return;
      }
      
      attempts++;
    }

    // Fetch results
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}`
    );
    const results = await resultsResponse.json();
    
    console.log(`Got ${results.length} activity items`);

    // Process and insert activity
    for (const item of results) {
      const activityRecord = {
        profile_id: profileId,
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

      const { error } = await supabase
        .from('reddit_profile_activity')
        .upsert(activityRecord, { onConflict: 'profile_id,reddit_id' });
      
      if (error) {
        console.error('Error inserting activity:', error);
      }
    }

    console.log(`Activity sync complete for profile: ${profileId}`);

  } catch (error) {
    console.error('Error syncing profile activity:', error);
  }
}
