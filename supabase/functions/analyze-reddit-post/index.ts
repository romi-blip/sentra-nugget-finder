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
    const systemPrompt = `You are a Reddit post relevance analyzer for Sentra, a Data Security Posture Management (DSPM) platform. Your job is to evaluate Reddit posts and determine if they present valuable engagement opportunities for Sentra's security experts.

# ABOUT SENTRA

Sentra is a leading DSPM + Data Detection and Response (DDR) platform that helps organizations:
- Discover and classify sensitive data across multi-cloud environments (AWS, Azure, GCP, Snowflake, Databricks)
- Gain visibility into "shadow data" and data sprawl
- Reduce data security risks through continuous posture management
- Ensure compliance (GDPR, HIPAA, CCPA, PCI-DSS, SOX)
- Detect and respond to data-centric threats
- Provide agentless deployment with 98% Gartner recommendation rate (4.9/5 stars)

Key differentiators:
- Agentless architecture (fast deployment, no performance impact)
- AI-powered data classification with 99%+ accuracy
- Combined DSPM + DDR capabilities
- Full data lifecycle security across cloud environments
- #1 in Gartner Voice of Customer for DSPM

# EVALUATION CRITERIA

Score each post on a 0-100 scale based on:

1. PROBLEM-SOLUTION FIT (0-30 points): Does this discuss problems Sentra solves?
2. AUDIENCE QUALITY (0-25 points): Are security leaders/practitioners engaging?
3. ENGAGEMENT POTENTIAL (0-20 points): Is there opportunity to add value?
4. TIMING & FRESHNESS (0-15 points): How timely is this?
5. STRATEGIC VALUE (0-10 points): Strategic considerations

# RED FLAGS - AUTOMATIC DISQUALIFICATION

If ANY of these are present, set score to 0:
- Explicit "no vendors" language
- Personal attacks or hostile tone
- Meme/joke posts
- Homework questions
- Completely unrelated topics

# OUTPUT REQUIREMENTS

Provide analysis with:
- relevance_score: Sum of all dimension scores (0-100)
- recommendation: "high_priority" (70+), "medium_priority" (40-69), "low_priority" (<40), or "do_not_engage" (red flags)
- reasoning: Brief explanation
- problem_fit_score, audience_quality_score, engagement_potential_score, timing_score, strategic_value_score
- key_themes: Pipe-separated (e.g., "theme1 | theme2 | theme3")
- sentra_angles: Pipe-separated relevant angles
- engagement_approach: "educational_with_experience", "thought_leadership", "peer_conversation", "direct_answer", or "do_not_engage"
- suggested_tone: "helpful expert", "helpful peer", "educational", or "conversational"
- risk_flags: Pipe-separated concerns or "none"
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
              recommendation: { type: "string", enum: ["high_priority", "medium_priority", "low_priority", "do_not_engage"] },
              reasoning: { type: "string" },
              problem_fit_score: { type: "integer", minimum: 0, maximum: 100 },
              audience_quality_score: { type: "integer", minimum: 0, maximum: 100 },
              engagement_potential_score: { type: "integer", minimum: 0, maximum: 100 },
              timing_score: { type: "integer", minimum: 0, maximum: 100 },
              strategic_value_score: { type: "integer", minimum: 0, maximum: 100 },
              key_themes: { type: "string" },
              sentra_angles: { type: "string" },
              engagement_approach: { type: "string", enum: ["educational_with_experience", "thought_leadership", "peer_conversation", "direct_answer", "do_not_engage"] },
              suggested_tone: { type: "string", enum: ["helpful expert", "helpful peer", "educational", "conversational"] },
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

    // Skip creating review if recommendation is do_not_engage
    if (review.recommendation === 'do_not_engage') {
      console.log('Skipping review creation for do_not_engage post');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Post marked as do_not_engage, no review created',
        recommendation: 'do_not_engage'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert review into database (update if exists, insert if new)
    const { data: insertedReview, error: insertError } = await supabase
      .from('post_reviews')
      .upsert({
        post_id,
        ...review
      }, { onConflict: 'post_id' })
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

    // Auto-fetch comments for high priority posts
    if (review.recommendation === 'high_priority') {
      try {
        console.log('Auto-fetching comments for high priority post:', post_id);
        await supabase.functions.invoke('fetch-reddit-comments', {
          body: { post_id },
        });
      } catch (err) {
        console.error('Error auto-fetching comments:', err);
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
