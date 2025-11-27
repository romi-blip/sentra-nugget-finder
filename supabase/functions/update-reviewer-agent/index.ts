import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Tool for extracting feedback patterns
const feedbackPatternTool = {
  type: "function",
  function: {
    name: "create_feedback_pattern",
    description: "Create a new feedback pattern for the content reviewer to learn",
    parameters: {
      type: "object",
      properties: {
        feedback_type: {
          type: "string",
          enum: ["style", "accuracy", "tone", "structure", "messaging", "general"],
          description: "Category of the feedback"
        },
        feedback_pattern: {
          type: "string",
          description: "What to look for in future content (brief, actionable)"
        },
        feedback_instruction: {
          type: "string",
          description: "How to address or evaluate this pattern"
        },
        priority: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Priority level based on importance"
        }
      },
      required: ["feedback_type", "feedback_pattern", "feedback_instruction", "priority"]
    }
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const { reviewId, humanFeedback } = await req.json();

    if (!reviewId || !humanFeedback) {
      throw new Error('Review ID and human feedback are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    // Fetch the review with content item
    const { data: review, error: reviewError } = await supabase
      .from('content_reviews')
      .select(`
        *,
        content_plan_items (
          title,
          content,
          strategic_purpose
        )
      `)
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      throw new Error(`Review not found: ${reviewError?.message}`);
    }

    // Use AI to analyze the human feedback and extract patterns
    const systemPrompt = `You are a learning system that extracts actionable feedback patterns from human reviewer comments.

Your job is to analyze human feedback about an AI content review and create specific, reusable patterns that will improve future reviews.

Guidelines for creating patterns:
1. Be specific and actionable
2. Focus on the underlying principle, not the specific instance
3. Patterns should be applicable to future content
4. Avoid patterns that are too generic or obvious
5. Priority should reflect how important this feedback is`;

    const userPrompt = `A human reviewer provided this feedback about an AI content review:

**Original Content Title:** ${review.content_plan_items?.title}
**AI Review Score:** ${review.overall_score}/100
**AI Recommendation:** ${review.review_result?.recommendation}

**Human Feedback:**
${humanFeedback}

Based on this feedback, extract a pattern that will help the AI reviewer do better in the future. Create exactly one specific, actionable feedback pattern.`;

    console.log('Analyzing human feedback...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [feedbackPatternTool],
        tool_choice: { type: "function", function: { name: "create_feedback_pattern" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== 'create_feedback_pattern') {
      throw new Error('Failed to extract feedback pattern');
    }

    const pattern = JSON.parse(toolCall.function.arguments);

    // Check for similar existing patterns
    const { data: existingPatterns } = await supabase
      .from('content_reviewer_feedback')
      .select('*')
      .eq('feedback_type', pattern.feedback_type)
      .eq('is_active', true);

    // Simple similarity check - could be improved with embeddings
    const isDuplicate = existingPatterns?.some(ep => 
      ep.feedback_pattern.toLowerCase().includes(pattern.feedback_pattern.toLowerCase().split(' ')[0]) ||
      pattern.feedback_pattern.toLowerCase().includes(ep.feedback_pattern.toLowerCase().split(' ')[0])
    );

    if (isDuplicate) {
      console.log('Similar pattern already exists, skipping creation');
      
      // Still save the human feedback to the review
      await supabase
        .from('content_reviews')
        .update({
          human_feedback: humanFeedback,
          feedback_applied: true,
        })
        .eq('id', reviewId);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Feedback recorded, similar pattern already exists',
        pattern: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create the new feedback pattern
    const { data: newPattern, error: patternError } = await supabase
      .from('content_reviewer_feedback')
      .insert({
        feedback_type: pattern.feedback_type,
        feedback_pattern: pattern.feedback_pattern,
        feedback_instruction: pattern.feedback_instruction,
        priority: pattern.priority,
        created_by: user.id,
      })
      .select()
      .single();

    if (patternError) {
      throw new Error(`Failed to save pattern: ${patternError.message}`);
    }

    // Update the review to mark feedback as applied
    await supabase
      .from('content_reviews')
      .update({
        human_feedback: humanFeedback,
        feedback_applied: true,
      })
      .eq('id', reviewId);

    console.log('Reviewer agent updated with new pattern');

    return new Response(JSON.stringify({ 
      success: true, 
      pattern: newPattern,
      message: 'Feedback pattern added to reviewer agent'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-reviewer-agent:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
