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

    // Use Reddit's free public API
    const redditResponse = await fetch(
      `https://www.reddit.com/user/${cleanUsername}/about.json`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    );

    if (!redditResponse.ok) {
      console.error('Reddit API error:', redditResponse.status);
      
      if (redditResponse.status === 404) {
        return new Response(JSON.stringify({ error: 'Reddit user not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'Failed to fetch Reddit profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const redditData = await redditResponse.json();
    const profileData = redditData.data;

    if (!profileData) {
      return new Response(JSON.stringify({ error: 'Invalid Reddit response' }), {
        status: 500,
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
