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
        if (!apifyToken) {
          console.log('APIFY_API_TOKEN not configured, skipping sync');
          results.push({ profile_id: profile.id, status: 'error', error: 'APIFY_API_TOKEN not configured' });
          continue;
        }

        // Use Apify to fetch both profile info and activity
        const { profileData, activities } = await syncWithApify(profile, apifyToken);
        
        // Update profile with karma data from Apify
        const updateData: any = {
          last_synced_at: new Date().toISOString(),
        };
        
        if (profileData) {
          if (profileData.linkKarma !== undefined) updateData.link_karma = profileData.linkKarma;
          if (profileData.commentKarma !== undefined) updateData.comment_karma = profileData.commentKarma;
          if (profileData.totalKarma !== undefined) {
            updateData.total_karma = profileData.totalKarma;
          } else if (profileData.linkKarma !== undefined && profileData.commentKarma !== undefined) {
            updateData.total_karma = profileData.linkKarma + profileData.commentKarma;
          }
          if (profileData.avatar) updateData.avatar_url = profileData.avatar.split('?')[0];
          if (profileData.isPremium !== undefined) updateData.is_premium = profileData.isPremium;
          if (profileData.createdAt) updateData.account_created_at = new Date(profileData.createdAt).toISOString();
          if (profileData.description) updateData.description = profileData.description;
        }
        
        console.log(`Updating profile with data:`, updateData);
        
        await supabase
          .from('reddit_profiles')
          .update(updateData)
          .eq('id', profile.id);

        // Save activities
        let savedCount = 0;
        for (const item of activities) {
          const activityType = item.dataType === 'comment' || item.type === 'comment' ? 'comment' : 'post';
          const redditId = item.id || item.name || item.reddit_id;
          
          if (!redditId) continue;
          
          let postedAt = null;
          if (item.createdAt) postedAt = new Date(item.createdAt).toISOString();
          else if (item.created_utc) postedAt = new Date(item.created_utc * 1000).toISOString();
          else if (item.publishedAt) postedAt = new Date(item.publishedAt).toISOString();
          
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
          
          if (!upsertError) savedCount++;
        }

        console.log(`Saved ${savedCount} activities for ${profile.reddit_username}`);
        results.push({ profile_id: profile.id, status: 'success', activities: savedCount });
        
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

async function syncWithApify(profile: any, apifyToken: string): Promise<{ profileData: any, activities: any[] }> {
  console.log(`Syncing with Apify for: ${profile.reddit_username}`);
  
  const actorId = 'louisdeconinck~reddit-user-profile-posts-scraper';
  const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`;
  
  const runResponse = await fetch(runUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startUrls: [{ url: `https://www.reddit.com/user/${profile.reddit_username}` }],
      maxItems: 50,
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

  // Poll for completion (max 120 seconds)
  let attempts = 0;
  while (attempts < 24) {
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

  // Fetch results
  const resultsResponse = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}`
  );
  const results = await resultsResponse.json();
  
  console.log(`Got ${results.length} items from Apify`);
  
  // Extract profile data from results (first item often contains profile info)
  let profileData = null;
  const activities: any[] = [];
  
  for (const item of results) {
    // Check if this item contains profile metadata
    if (item.linkKarma !== undefined || item.commentKarma !== undefined || item.totalKarma !== undefined) {
      profileData = item;
      console.log('Found profile data in results:', {
        linkKarma: item.linkKarma,
        commentKarma: item.commentKarma,
        totalKarma: item.totalKarma,
      });
    }
    
    // Add as activity if it has content
    if (item.id || item.name || item.reddit_id) {
      activities.push(item);
    }
  }
  
  // If no profile data found in results, try to fetch it separately
  if (!profileData) {
    console.log('No profile data in activity results, trying dedicated profile scraper...');
    profileData = await fetchProfileDataFromApify(profile.reddit_username, apifyToken);
  }
  
  return { profileData, activities };
}

async function fetchProfileDataFromApify(username: string, apifyToken: string): Promise<any> {
  try {
    // Try the crawlerbros reddit-scraper which can fetch user profiles
    const actorId = 'crawlerbros~reddit-scraper';
    const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`;
    
    const runResponse = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: `https://www.reddit.com/user/${username}` }],
        maxItems: 1,
        proxyConfiguration: {
          useApifyProxy: true,
        },
      }),
    });

    if (!runResponse.ok) {
      console.log('Profile scraper not available');
      return null;
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;

    // Wait for completion (shorter timeout)
    let attempts = 0;
    while (attempts < 12) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
      );
      const statusData = await statusResponse.json();
      
      if (statusData.data.status === 'SUCCEEDED') break;
      if (statusData.data.status === 'FAILED' || statusData.data.status === 'ABORTED') {
        return null;
      }
      
      attempts++;
    }

    const resultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}`
    );
    const results = await resultsResponse.json();
    
    if (results.length > 0) {
      const item = results[0];
      return {
        linkKarma: item.link_karma || item.linkKarma,
        commentKarma: item.comment_karma || item.commentKarma,
        totalKarma: item.total_karma || item.totalKarma,
        avatar: item.icon_img || item.avatar || item.avatar_url,
        isPremium: item.is_gold || item.is_premium || item.isPremium,
        createdAt: item.created_utc ? new Date(item.created_utc * 1000).toISOString() : item.createdAt,
        description: item.subreddit?.public_description || item.description,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching profile data:', error);
    return null;
  }
}
