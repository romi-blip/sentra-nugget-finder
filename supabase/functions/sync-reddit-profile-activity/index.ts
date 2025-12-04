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
    
    const isScheduled = token === supabaseAnonKey;
    const isServiceRole = token === supabaseServiceKey;
    
    let userId: string | null = null;
    
    if (!isScheduled && !isServiceRole) {
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
          console.log('APIFY_API_TOKEN not configured');
          results.push({ profile_id: profile.id, status: 'error', error: 'APIFY_API_TOKEN not configured' });
          continue;
        }

        // Step 1: Fetch accurate karma using practicaltools/apify-reddit-api
        console.log(`Fetching karma for: ${profile.reddit_username}`);
        const karmaData = await fetchUserKarma(profile.reddit_username, apifyToken);
        
        // Step 2: Fetch activities using existing actor
        const activities = await fetchUserActivities(profile, apifyToken);
        
        // Update profile with karma data
        const updateData: any = {
          last_synced_at: new Date().toISOString(),
        };
        
        if (karmaData) {
          updateData.link_karma = karmaData.postKarma || 0;
          updateData.comment_karma = karmaData.commentKarma || 0;
          updateData.total_karma = (karmaData.postKarma || 0) + (karmaData.commentKarma || 0);
          if (karmaData.avatar) updateData.avatar_url = karmaData.avatar.split('?')[0];
          if (karmaData.isPremium !== undefined) updateData.is_premium = karmaData.isPremium;
          if (karmaData.createdAt) updateData.account_created_at = karmaData.createdAt;
          if (karmaData.description) updateData.description = karmaData.description;
        } else {
          // Fallback: calculate karma from activities
          let linkKarma = 0;
          let commentKarma = 0;
          for (const item of activities) {
            const score = item.score || item.ups || item.upvotes || 0;
            const isComment = item.dataType === 'comment' || item.type === 'comment';
            if (isComment) {
              commentKarma += score;
            } else {
              linkKarma += score;
            }
          }
          updateData.link_karma = linkKarma;
          updateData.comment_karma = commentKarma;
          updateData.total_karma = linkKarma + commentKarma;
        }
        
        console.log(`Updating profile with karma - link: ${updateData.link_karma}, comment: ${updateData.comment_karma}, total: ${updateData.total_karma}`);
        
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
        results.push({ profile_id: profile.id, status: 'success', activities: savedCount, karma: updateData });
        
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

// Fetch accurate karma data using practicaltools/apify-reddit-api
async function fetchUserKarma(username: string, apifyToken: string): Promise<any> {
  try {
    const actorId = 'practicaltools~apify-reddit-api';
    const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`;
    
    console.log(`Starting karma fetch with practicaltools/apify-reddit-api for: ${username}`);
    
    const runResponse = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: `https://www.reddit.com/user/${username}` }],
        maxItems: 1,
        skipComments: true,
        skipUserPosts: true,
        skipCommunity: true,
      }),
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Failed to start karma fetch actor:', errorText);
      return null;
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`Karma fetch run started: ${runId}`);

    // Poll for completion (shorter timeout since we only want profile data)
    let attempts = 0;
    while (attempts < 12) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
      );
      const statusData = await statusResponse.json();
      
      console.log(`Karma fetch status: ${statusData.data.status}`);
      
      if (statusData.data.status === 'SUCCEEDED') break;
      if (statusData.data.status === 'FAILED' || statusData.data.status === 'ABORTED') {
        console.error(`Karma fetch run ${statusData.data.status}`);
        return null;
      }
      
      attempts++;
    }

    const resultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}`
    );
    const results = await resultsResponse.json();
    
    console.log(`Karma fetch got ${results.length} items`);
    
    if (results.length > 0) {
      const item = results[0];
      console.log('Karma data keys:', Object.keys(item));
      console.log('Karma data sample:', JSON.stringify(item).substring(0, 800));
      
      // Extract karma data from the response
      // The actor returns user profile data with postKarma and commentKarma
      return {
        postKarma: item.postKarma ?? item.link_karma ?? item.linkKarma ?? null,
        commentKarma: item.commentKarma ?? item.comment_karma ?? null,
        avatar: item.userIcon ?? item.icon_img ?? item.avatar ?? item.avatar_url ?? null,
        isPremium: item.isPremium ?? item.is_premium ?? item.isGold ?? item.is_gold ?? null,
        createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : 
                   item.created_utc ? new Date(item.created_utc * 1000).toISOString() : null,
        description: item.description ?? item.publicDescription ?? item.subreddit?.public_description ?? null,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching karma:', error);
    return null;
  }
}

// Fetch user activities using louisdeconinck/reddit-user-profile-posts-scraper
async function fetchUserActivities(profile: any, apifyToken: string): Promise<any[]> {
  console.log(`Fetching activities for: ${profile.reddit_username}`);
  
  const actorId = 'louisdeconinck~reddit-user-profile-posts-scraper';
  const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`;
  
  const runResponse = await fetch(runUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startUrls: [{ url: `https://www.reddit.com/user/${profile.reddit_username}` }],
      maxItems: 100,
      sort: 'new',
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
    }),
  });

  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    console.error('Failed to start activity actor:', errorText);
    throw new Error('Failed to start Apify activity actor');
  }

  const runData = await runResponse.json();
  const runId = runData.data.id;
  console.log(`Activity fetch run started: ${runId}`);

  // Poll for completion
  let attempts = 0;
  while (attempts < 24) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
    );
    const statusData = await statusResponse.json();
    
    console.log(`Activity fetch status: ${statusData.data.status}`);
    
    if (statusData.data.status === 'SUCCEEDED') break;
    if (statusData.data.status === 'FAILED' || statusData.data.status === 'ABORTED') {
      throw new Error(`Activity fetch run ${statusData.data.status}`);
    }
    
    attempts++;
  }

  const resultsResponse = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}`
  );
  const results = await resultsResponse.json();
  
  console.log(`Got ${results.length} activities from Apify`);
  
  return results;
}
