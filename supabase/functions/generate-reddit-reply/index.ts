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

    // Prepare AI prompt
    const systemPrompt = `You are a helpful cybersecurity expert writing Reddit replies about data security and DSPM topics.

Generate a reply that:
- Uses the tone: ${review.suggested_tone}
- Addresses these themes: ${review.key_themes}
- Highlights these angles: ${review.sentra_angles}
- Uses engagement approach: ${review.engagement_approach}
- Avoids: ${review.risk_flags}

Keep replies:
- Conversational and authentic (not corporate)
- 3-5 paragraphs max
- Helpful and educational
- Naturally mentions relevant concepts without being promotional
- Matches Reddit culture (casual but professional)
- Addresses the specific question or situation in the post

Return ONLY the reply text, no JSON wrapper or metadata.`;

    const userPrompt = `Write a reply for this Reddit post:

Subreddit: r/${subredditName}
Title: ${post.title}
Content: ${post.content || post.content_snippet || 'No content'}

Context: ${review.subreddit_context}
Reasoning: ${review.reasoning}`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI request failed: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const suggestedReply = aiData.choices?.[0]?.message?.content;
    
    if (!suggestedReply) {
      throw new Error('No content in AI response');
    }

    console.log('Reply generated, length:', suggestedReply.length);

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
