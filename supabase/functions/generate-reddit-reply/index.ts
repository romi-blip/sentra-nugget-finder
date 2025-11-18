import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { post_id, review_id, post, review } = await req.json();
    console.log('Generating reply for post:', post_id);

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

    // Stage 1: Generate initial reply with comprehensive prompt
    const replyCreationPrompt = `You are a cybersecurity expert crafting authentic, helpful Reddit comments. Your goal is to provide genuine value to the community while naturally representing expertise in data security.

# CONTEXT
You work in data security and have expertise in DSPM (Data Security Posture Management), cloud security, and data protection.

**CRITICAL: Your comments must be 1-4 SENTENCES MAX. Not paragraphs. Short, punchy, snarky when appropriate.**

# CORE PRINCIPLES
1. **BREVITY ABOVE ALL**: 1-4 sentences maximum. Get to the point.
2. **Authentic Voice**: Write like a security practitioner having a beer, not a consultant writing a report
3. **Snark When Appropriate**: Security people are tired of seeing the same failures - show it
4. **Personal and Direct**: Use "Honestly?", "Real talk:", "In my experience" - make it human
5. **Value in Few Words**: Give actionable insight quickly, no fluff
6. **Reddit Culture**: Be direct, sometimes pessimistic, always real

# ENGAGEMENT CONTEXT
- Tone: ${review.suggested_tone}
- Key Themes: ${review.key_themes}
- Sentra Angles: ${review.sentra_angles}
- Engagement Approach: ${review.engagement_approach}
- Risk Flags to Avoid: ${review.risk_flags}

# SENTRA MENTION RULES
**Mention Sentra ONLY if someone asks for tool recommendations or when comparing solutions.**
- Always say "Full disclosure: I work with Sentra"
- Always mention competitors: "Solutions like Sentra, Cyera, or Varonis"
- If Sentra doesn't solve their specific problem, DON'T mention it

Output ONLY the comment text, ready to post.`;

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

    // Stage 2: Humanize the reply
    const humanizationPrompt = `You are a Reddit comment editor who transforms AI-generated comments into naturally human-written Reddit posts. Remove AI writing patterns while preserving technical accuracy.

# REQUIREMENTS
1. Preserve ALL facts, statistics, technical details, "Full disclosure" statements, tool names EXACTLY
2. Keep Reddit-appropriate: conversational, helpful, technical but accessible
3. Output plain text ready to copy-paste

# PATTERNS TO ELIMINATE
- Bold headers, perfect structures, overly polished opening/closing
- "Absolutely", "definitely" everywhere (max 1)
- Over-formal language, perfect transitions, always ending with questions
- Too comprehensive (focus on 2-3 points max)

# HUMANIZATION RULES
- Add contractions, use "orgs" not "organizations", "stuff" not "components"
- Add qualifiers: "probably", "honestly", "IMO", "basically"
- Vary paragraph lengths (some 1 sentence, some 5+)
- Use casual words: "thing", "piece", occasional fragments
- Sound like explaining over coffee, not writing a report

Output humanized comment as plain text.`;

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
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) throw insertError;
      insertedReply = data;
    }

    return new Response(JSON.stringify({ success: true, reply: insertedReply }), {
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
