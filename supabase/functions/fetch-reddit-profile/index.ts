import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Try multiple endpoints for Reddit profile data
async function fetchRedditProfile(username: string): Promise<any> {
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
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return null;
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

    const { reddit_username, profile_type = 'tracked' } = await req.json();
    
    if (!reddit_username) {
      return new Response(JSON.stringify({ error: 'Missing reddit_username' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean username (remove u/ prefix if present)
    const cleanUsername = reddit_username.replace(/^u\//, '').trim();
    
    console.log(`Fetching Reddit profile for: ${cleanUsername}`);

    // Try to fetch profile data from Reddit
    const profileData = await fetchRedditProfile(cleanUsername);

    if (!profileData) {
      // If all Reddit API attempts fail, create a basic profile entry anyway
      // User can sync later when Reddit API is available
      console.log('Reddit API unavailable, creating basic profile');
      
      const basicProfile = {
        user_id: user.id,
        reddit_username: cleanUsername,
        display_name: cleanUsername,
        profile_url: `https://www.reddit.com/user/${cleanUsername}`,
        link_karma: 0,
        comment_karma: 0,
        total_karma: 0,
        profile_type: profile_type,
        last_synced_at: new Date().toISOString(),
      };

      const { data: profile, error: upsertError } = await supabase
        .from('reddit_profiles')
        .upsert(basicProfile, {
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

      return new Response(JSON.stringify({ 
        success: true, 
        profile,
        message: 'Profile added. Reddit API temporarily unavailable - karma data will sync later.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Reddit profile data received for:', profileData.name);

    // Build profile record
    const profileRecord = {
      user_id: user.id,
      reddit_username: profileData.name || cleanUsername,
      display_name: profileData.subreddit?.display_name_prefixed || profileData.name || cleanUsername,
      profile_url: `https://www.reddit.com/user/${profileData.name || cleanUsername}`,
      avatar_url: profileData.icon_img?.split('?')[0] || profileData.snoovatar_img || null,
      link_karma: profileData.link_karma || 0,
      comment_karma: profileData.comment_karma || 0,
      total_karma: profileData.total_karma || ((profileData.link_karma || 0) + (profileData.comment_karma || 0)),
      account_created_at: profileData.created_utc ? new Date(profileData.created_utc * 1000).toISOString() : null,
      is_verified: profileData.verified || false,
      is_premium: profileData.is_gold || false,
      description: profileData.subreddit?.public_description || null,
      profile_type: profile_type,
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

    return new Response(JSON.stringify({ 
      success: true, 
      profile,
      message: 'Profile fetched successfully'
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
