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

        const { activities, userInfo } = await syncWithApify(profile, apifyToken);
        
        // Calculate karma from activities
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
        
        // Use userInfo if available, otherwise use calculated values
        const updateData: any = {
          last_synced_at: new Date().toISOString(),
        };
        
        if (userInfo) {
          updateData.link_karma = userInfo.linkKarma ?? linkKarma;
          updateData.comment_karma = userInfo.commentKarma ?? commentKarma;
          updateData.total_karma = userInfo.totalKarma ?? (updateData.link_karma + updateData.comment_karma);
          if (userInfo.avatar) updateData.avatar_url = userInfo.avatar.split('?')[0];
          if (userInfo.isPremium !== undefined) updateData.is_premium = userInfo.isPremium;
          if (userInfo.createdAt) updateData.account_created_at = userInfo.createdAt;
          if (userInfo.description) updateData.description = userInfo.description;
        } else {
          // Use calculated karma from activities (this is approximate)
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
        results.push({ profile_id: profile.id, status: 'success', activities: savedCount });
        
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

async function syncWithApify(profile: any, apifyToken: string): Promise<{ activities: any[], userInfo: any }> {
  console.log(`Syncing with Apify for: ${profile.reddit_username}`);
  
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
    console.error('Failed to start Apify actor:', errorText);
    throw new Error('Failed to start Apify actor');
  }

  const runData = await runResponse.json();
  const runId = runData.data.id;
  console.log(`Apify run started: ${runId}`);

  // Poll for completion
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

  const resultsResponse = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}`
  );
  const results = await resultsResponse.json();
  
  console.log(`Got ${results.length} items from Apify`);
  
  // Log first item to see structure
  if (results.length > 0) {
    console.log('First item keys:', Object.keys(results[0]));
    console.log('First item sample:', JSON.stringify(results[0]).substring(0, 500));
  }
  
  // Check if any item contains user profile info
  let userInfo = null;
  for (const item of results) {
    if (item.user && typeof item.user === 'object') {
      userInfo = {
        linkKarma: item.user.link_karma || item.user.linkKarma,
        commentKarma: item.user.comment_karma || item.user.commentKarma,
        totalKarma: item.user.total_karma || item.user.totalKarma,
        avatar: item.user.icon_img || item.user.avatar,
        isPremium: item.user.is_gold || item.user.is_premium,
        createdAt: item.user.created_utc ? new Date(item.user.created_utc * 1000).toISOString() : null,
      };
      console.log('Found user info in item:', userInfo);
      break;
    }
  }
  
  return { activities: results, userInfo };
}
