import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateAuth, unauthorizedResponse, corsHeaders } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await validateAuth(req);
    if (!auth.valid) {
      return unauthorizedResponse();
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { post_id, review_id, post, review, profile_id } = await req.json();
    console.log('Generating reply for post:', post_id, 'with profile_id:', profile_id);

    if (!post_id || !review_id || !post || !review) {
      throw new Error('post_id, review_id, post, and review data are required');
    }

    // Get subreddit info
    const { data: subreddit } = await supabase
      .from('tracked_subreddits')
      .select('subreddit_name')
      .eq('id', post.subreddit_id)
      .single();

    const subredditName = subreddit?.subreddit_name || 'unknown';

    // Get managed profile with persona (either specified or auto-select best match)
    let selectedProfile = null;
    
    if (profile_id) {
      // Use specified profile
      const { data: profile } = await supabase
        .from('reddit_profiles')
        .select('*')
        .eq('id', profile_id)
        .single();
      selectedProfile = profile;
    } else {
      // Auto-select best matching managed profile with persona
      const { data: managedProfiles } = await supabase
        .from('reddit_profiles')
        .select('*')
        .eq('profile_type', 'managed')
        .eq('is_active', true)
        .not('persona_summary', 'is', null);

      if (managedProfiles && managedProfiles.length > 0) {
        // Use AI to select best profile based on post content
        const profileSelectionPrompt = `Given the following Reddit post and available user personas, select the BEST profile to respond.

POST DETAILS:
Title: ${post.title}
Subreddit: r/${subredditName}
Content: ${post.content || post.content_snippet || 'No content'}
Key Themes: ${review.key_themes}

AVAILABLE PROFILES:
${managedProfiles.map((p: any, i: number) => `
${i + 1}. u/${p.reddit_username}
   Expertise: ${p.expertise_areas?.join(', ') || 'General'}
   Writing Style: ${p.writing_style || 'Unknown'}
   Tone: ${p.typical_tone || 'Unknown'}
   Summary: ${p.persona_summary || 'No summary'}
`).join('\n')}

Select the profile number that would be MOST credible and effective for this post based on:
1. Expertise match with post topics
2. Appropriate tone for the subreddit/situation
3. Writing style fit

Return ONLY the profile number (1, 2, 3, etc).`;

        const selectionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'user', content: profileSelectionPrompt }
            ],
          }),
        });

        if (selectionResponse.ok) {
          const selectionData = await selectionResponse.json();
          const selectionText = selectionData.choices?.[0]?.message?.content?.trim();
          const profileIndex = parseInt(selectionText) - 1;
          
          if (!isNaN(profileIndex) && profileIndex >= 0 && profileIndex < managedProfiles.length) {
            selectedProfile = managedProfiles[profileIndex];
            console.log('Auto-selected profile:', selectedProfile.reddit_username);
          } else {
            // Default to first profile if parsing fails
            selectedProfile = managedProfiles[0];
            console.log('Defaulting to first profile:', selectedProfile.reddit_username);
          }
        } else {
          // Default to first profile if AI call fails
          selectedProfile = managedProfiles[0];
          console.log('AI selection failed, defaulting to first profile');
        }
      }
    }

    // Build persona-aware prompt
    let personaContext = '';
    if (selectedProfile && selectedProfile.persona_summary) {
      personaContext = `
YOU ARE REPLYING AS: u/${selectedProfile.reddit_username}

YOUR PERSONA:
- Writing Style: ${selectedProfile.writing_style || 'casual, authentic'}
- Typical Tone: ${selectedProfile.typical_tone || 'helpful but direct'}
- Expertise Areas: ${selectedProfile.expertise_areas?.join(', ') || 'security, technology'}
- Background: ${selectedProfile.persona_summary}

CRITICAL: Sound EXACTLY like this person based on their writing style and tone. Match their vocabulary, sentence structure, and personality.
`;
    }

    // Stage 1: Generate initial reply with strict brevity
    const replyCreationPrompt = `You are a tired security practitioner on Reddit during lunch break.
${personaContext}
ABSOLUTE RULES:
1. MAXIMUM 1-4 SENTENCES. If you write 5+ sentences, you FAILED.
2. Sound like a real person, not a consultant or vendor
3. Be snarky/sarcastic when the situation calls for it
4. Use casual language: "honestly", "tbh", "in my experience"
5. Get straight to the point - no fluff

CONTEXT:
- You work in data security (DSPM, cloud security, data protection)
- Tone to use: ${review.suggested_tone}
- Key themes: ${review.key_themes}
- Approach: ${review.engagement_approach}

SENTRA MENTION:
- ONLY mention if they ask for tool recommendations
- If you mention: "Full disclosure: I work with Sentra" + always include competitors (Cyera, Varonis)
- If Sentra doesn't solve their problem, DON'T mention it

Write 1-4 sentences max. Be helpful but snarky. Sound human, not corporate.`;

    const userPrompt = `Write a Reddit reply for:

Subreddit: r/${subredditName}
Title: ${post.title}
Content: ${post.content || post.content_snippet || 'No content'}

Context: ${review.subreddit_context}
Reasoning: ${review.reasoning}`;

    // Call Lovable AI for initial reply
    const replyResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: replyCreationPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!replyResponse.ok) {
      const errorText = await replyResponse.text();
      throw new Error(`AI reply generation failed: ${replyResponse.status} - ${errorText}`);
    }

    const replyData = await replyResponse.json();
    const initialReply = replyData.choices?.[0]?.message?.content;
    
    if (!initialReply) {
      throw new Error('No content in AI reply response');
    }

    console.log('Initial reply generated, length:', initialReply.length);

    // Stage 2: Enforce brevity and humanize
    const humanizationPrompt = `Make this Reddit comment sound more human and enforce strict brevity.
${selectedProfile ? `Match the writing style of u/${selectedProfile.reddit_username}: ${selectedProfile.writing_style || 'casual'}` : ''}

CRITICAL RULES:
1. MUST be 1-4 sentences max (cut anything longer)
2. Remove any AI-sounding phrases: "absolutely", "definitely", "great question"
3. Keep ALL facts, numbers, "Full disclosure" statements EXACTLY as written
4. Use contractions: "it's", "you're", "can't"
5. Add casual qualifiers: "honestly", "probably", "IMO"
6. Sound like a real security person, not a consultant

Make it shorter, snarkier, more casual. Output plain text only.`;

    const humanizePrompt = `Humanize this Reddit comment while preserving ALL facts:

${initialReply}`;

    // Call Lovable AI for humanization
    const humanizeResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: humanizationPrompt },
          { role: 'user', content: humanizePrompt }
        ],
      }),
    });

    if (!humanizeResponse.ok) {
      const errorText = await humanizeResponse.text();
      throw new Error(`AI humanization failed: ${humanizeResponse.status} - ${errorText}`);
    }

    const humanizeData = await humanizeResponse.json();
    const suggestedReply = humanizeData.choices?.[0]?.message?.content;
    
    if (!suggestedReply) {
      throw new Error('No content in humanization response');
    }

    console.log('Reply humanized, final length:', suggestedReply.length);

    // Check if reply already exists for this post
    const { data: existingReply } = await supabase
      .from('suggested_replies')
      .select('id')
      .eq('post_id', post_id)
      .single();

    let insertedReply;
    if (existingReply) {
      // Update existing reply
      const { data, error: updateError } = await supabase
        .from('suggested_replies')
        .update({
          suggested_reply: suggestedReply,
          review_id,
          status: 'pending',
          suggested_profile_id: selectedProfile?.id || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingReply.id)
        .select()
        .single();

      if (updateError) throw updateError;
      insertedReply = data;
    } else {
      // Insert new reply
      const { data, error: insertError } = await supabase
        .from('suggested_replies')
        .insert({
          post_id,
          review_id,
          suggested_reply: suggestedReply,
          status: 'pending',
          suggested_profile_id: selectedProfile?.id || null
        })
        .select()
        .single();

      if (insertError) throw insertError;
      insertedReply = data;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      reply: insertedReply,
      suggested_profile: selectedProfile ? {
        id: selectedProfile.id,
        username: selectedProfile.reddit_username,
        writing_style: selectedProfile.writing_style,
        typical_tone: selectedProfile.typical_tone
      } : null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-reddit-reply:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
