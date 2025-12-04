import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Try multiple endpoints for Reddit profile data
async function fetchRedditProfileData(username: string): Promise<any> {
  const endpoints = [
    `https://old.reddit.com/user/${username}/about.json`,
    `https://www.reddit.com/user/${username}/about.json`,
    `https://api.reddit.com/user/${username}/about`,
  ];
  
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  ];
  
  for (const endpoint of endpoints) {
    for (const userAgent of userAgents) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        
        const response = await fetch(endpoint, {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data?.data) {
            console.log('Successfully fetched profile data');
            return data.data;
          }
        } else {
          console.log(`Endpoint ${endpoint} returned status: ${response.status}`);
        }
      } catch (err) {
        console.log(`Endpoint ${endpoint} failed:`, err.message);
      }
      
      // Small delay between attempts
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  return null;
}

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
        // Update karma from Reddit API using multi-endpoint approach
        const profileData = await fetchRedditProfileData(profile.reddit_username);
        
        if (profileData) {
          console.log(`Updating karma for ${profile.reddit_username}`);
          await supabase
            .from('reddit_profiles')
            .update({
              link_karma: profileData.link_karma || 0,
              comment_karma: profileData.comment_karma || 0,
              total_karma: profileData.total_karma || (profileData.link_karma || 0) + (profileData.comment_karma || 0),
              avatar_url: profileData.icon_img?.split('?')[0] || profile.avatar_url,
              is_premium: profileData.is_gold || false,
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', profile.id);
        } else {
          console.log(`Could not fetch Reddit data for ${profile.reddit_username}, updating sync time only`);
          await supabase
            .from('reddit_profiles')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', profile.id);
        }

        // Sync activity via Apify
        if (apifyToken) {
          await syncActivity(profile, supabase, apifyToken);
        } else {
          console.log('APIFY_API_TOKEN not configured, skipping activity sync');
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
      startUrls: [{ url: `https://www.reddit.com/user/${profile.reddit_username}` }],
      maxItems: 30,
      sort: 'new',
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
    }),
  });

  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    console.error('Failed to start Apify actor:', errorText);
    throw new Error('Failed to start Apify actor');
  }

  const runData = await runResponse.json();
  const runId = runData.data.id;
  console.log(`Apify run started: ${runId}`);

  // Poll for completion (max 90 seconds)
  let attempts = 0;
  while (attempts < 18) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
    );
    const statusData = await statusResponse.json();
    
    console.log(`Run status: ${statusData.data.status}`);
    
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
  
  console.log(`Got ${results.length} activity items from Apify`);

  let savedCount = 0;
  for (const item of results) {
    // Parse activity type - the actor returns posts and comments
    const activityType = item.dataType === 'comment' || item.type === 'comment' ? 'comment' : 'post';
    
    // Extract reddit_id from various possible fields
    const redditId = item.id || item.name || item.reddit_id;
    
    if (!redditId) {
      console.log('Skipping item without reddit_id:', item);
      continue;
    }
    
    // Parse posted_at from various date formats
    let postedAt = null;
    if (item.createdAt) {
      postedAt = new Date(item.createdAt).toISOString();
    } else if (item.created_utc) {
      postedAt = new Date(item.created_utc * 1000).toISOString();
    } else if (item.publishedAt) {
      postedAt = new Date(item.publishedAt).toISOString();
    }
    
    const activityRecord = {
      profile_id: profile.id,
      activity_type: activityType,
      reddit_id: redditId,
      subreddit: item.subreddit || item.subredditName || item.communityName,
      title: item.title || null,
      content: item.body || item.selftext || item.text || null,
      permalink: item.permalink ? 
        (item.permalink.startsWith('http') ? item.permalink : `https://www.reddit.com${item.permalink}`) : 
        item.url || null,
      score: item.score || item.ups || item.upvotes || 0,
      num_comments: item.numComments || item.num_comments || item.numberOfComments || 0,
      posted_at: postedAt,
    };

    const { error: upsertError } = await supabase
      .from('reddit_profile_activity')
      .upsert(activityRecord, { onConflict: 'profile_id,reddit_id' });
    
    if (upsertError) {
      console.error('Error upserting activity:', upsertError);
    } else {
      savedCount++;
    }
  }

  console.log(`Saved ${savedCount} activities for ${profile.reddit_username}`);
}
