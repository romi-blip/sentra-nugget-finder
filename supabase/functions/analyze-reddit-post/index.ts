import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

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

    const { post_id, post } = await req.json();
    console.log('Analyzing post:', post_id);

    if (!post_id || !post) {
      throw new Error('post_id and post data are required');
    }

    // Get subreddit info
    const { data: subreddit } = await supabase
      .from('tracked_subreddits')
      .select('subreddit_name')
      .eq('id', post.subreddit_id)
      .single();

    const subredditName = subreddit?.subreddit_name || 'unknown';

    // Prepare AI prompt
    const systemPrompt = `You are an AI assistant that evaluates Reddit posts for engagement opportunities related to data security, DSPM (Data Security Posture Management), and cybersecurity topics.

Analyze the post and provide scores based on:
- problem_fit_score (0-100): How relevant is this to data security/DSPM?
- audience_quality_score (0-100): Quality of the subreddit community
- engagement_potential_score (0-100): Likelihood of meaningful conversation
- timing_score (0-100): How timely/relevant is this topic?
- strategic_value_score (0-100): Alignment with business goals

Calculate relevance_score as the average of all scores.

Provide a recommendation:
- "high_priority" if relevance_score >= 70
- "medium_priority" if relevance_score >= 40
- "low_priority" if relevance_score < 40

Include:
- reasoning: Brief explanation of the assessment
- key_themes: Pipe-separated themes (e.g., "cyberattack | data breach | incident response")
- sentra_angles: Relevant DSPM/security angles (e.g., "data posture management | threat detection")
- engagement_approach: How to engage (e.g., "educational_with_experience", "solution_oriented", "question_response")
- suggested_tone: Tone to use (e.g., "helpful expert", "conversational peer", "cautious advisor")
- risk_flags: Any concerns (e.g., "promotional_skepticism", "none")
- estimated_effort: "low", "medium", or "high"
- subreddit_context: Brief context about the subreddit and post type`;

    const userPrompt = `Subreddit: r/${subredditName}
Title: ${post.title}
Author: ${post.author || 'unknown'}
Content: ${post.content || post.content_snippet || 'No content'}`;

    // Define tool for structured output
    const tools = [
      {
        type: "function",
        function: {
          name: "create_post_review",
          description: "Create a structured review of a Reddit post for engagement opportunities",
          parameters: {
            type: "object",
            properties: {
              relevance_score: { type: "integer", minimum: 0, maximum: 100 },
              recommendation: { type: "string", enum: ["high_priority", "medium_priority", "low_priority"] },
              reasoning: { type: "string" },
              problem_fit_score: { type: "integer", minimum: 0, maximum: 100 },
              audience_quality_score: { type: "integer", minimum: 0, maximum: 100 },
              engagement_potential_score: { type: "integer", minimum: 0, maximum: 100 },
              timing_score: { type: "integer", minimum: 0, maximum: 100 },
              strategic_value_score: { type: "integer", minimum: 0, maximum: 100 },
              key_themes: { type: "string" },
              sentra_angles: { type: "string" },
              engagement_approach: { type: "string" },
              suggested_tone: { type: "string" },
              risk_flags: { type: "string" },
              estimated_effort: { type: "string", enum: ["low", "medium", "high"] },
              subreddit_context: { type: "string" }
            },
            required: [
              "relevance_score", "recommendation", "reasoning",
              "problem_fit_score", "audience_quality_score", "engagement_potential_score",
              "timing_score", "strategic_value_score", "key_themes", "sentra_angles",
              "engagement_approach", "suggested_tone", "risk_flags",
              "estimated_effort", "subreddit_context"
            ],
            additionalProperties: false
          }
        }
      }
    ];

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
        tools,
        tool_choice: { type: "function", function: { name: "create_post_review" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI request failed: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const review = JSON.parse(toolCall.function.arguments);
    console.log('AI Review generated:', review);

    // Insert review into database
    const { data: insertedReview, error: insertError } = await supabase
      .from('post_reviews')
      .insert({
        post_id,
        ...review
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Trigger reply generation for high/medium priority posts
    if (review.recommendation === 'high_priority' || review.recommendation === 'medium_priority') {
      try {
        await supabase.functions.invoke('generate-reddit-reply', {
          body: { 
            post_id, 
            review_id: insertedReview.id,
            post,
            review: insertedReview
          },
        });
      } catch (err) {
        console.error('Error triggering reply generation:', err);
      }
    }

    return new Response(JSON.stringify({ success: true, review: insertedReview }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-reddit-post:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
