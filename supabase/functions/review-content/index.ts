import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Tool definition for structured review output
const reviewTool = {
  type: "function",
  function: {
    name: "submit_content_review",
    description: "Submit a structured content review with scores and feedback",
    parameters: {
      type: "object",
      properties: {
        overallScore: { 
          type: "number", 
          description: "Overall quality score from 0-100" 
        },
        recommendation: { 
          type: "string", 
          enum: ["pass", "minor_revisions", "major_revisions", "reject"],
          description: "Overall recommendation for the content"
        },
        categories: {
          type: "object",
          properties: {
            messaging: { 
              type: "object",
              properties: {
                score: { type: "number", description: "Score 0-25 for Sentra messaging alignment" },
                notes: { type: "string", description: "Feedback on messaging alignment" }
              },
              required: ["score", "notes"]
            },
            quality: {
              type: "object", 
              properties: {
                score: { type: "number", description: "Score 0-25 for content quality" },
                notes: { type: "string", description: "Feedback on clarity, structure, flow" }
              },
              required: ["score", "notes"]
            },
            accuracy: {
              type: "object",
              properties: {
                score: { type: "number", description: "Score 0-20 for accuracy and sources" },
                notes: { type: "string", description: "Feedback on factual accuracy" }
              },
              required: ["score", "notes"]
            },
            tone: {
              type: "object",
              properties: {
                score: { type: "number", description: "Score 0-15 for tone and voice" },
                notes: { type: "string", description: "Feedback on brand voice alignment" }
              },
              required: ["score", "notes"]
            },
            seo: {
              type: "object",
              properties: {
                score: { type: "number", description: "Score 0-15 for SEO and keywords" },
                notes: { type: "string", description: "Feedback on keyword usage and SEO" }
              },
              required: ["score", "notes"]
            }
          },
          required: ["messaging", "quality", "accuracy", "tone", "seo"]
        },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["critical", "major", "minor", "suggestion"] },
              category: { type: "string" },
              description: { type: "string" },
              location: { type: "string", description: "Where in the content the issue is found" },
              suggestion: { type: "string", description: "How to fix the issue" }
            },
            required: ["severity", "category", "description", "suggestion"]
          }
        },
        strengths: {
          type: "array",
          items: { type: "string" },
          description: "What the content does well"
        },
        summary: {
          type: "string",
          description: "Overall review summary in 2-3 sentences"
        }
      },
      required: ["overallScore", "recommendation", "categories", "issues", "strengths", "summary"]
    }
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentItemId } = await req.json();

    if (!contentItemId) {
      throw new Error('Content item ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch content item
    const { data: contentItem, error: contentError } = await supabase
      .from('content_plan_items')
      .select('*')
      .eq('id', contentItemId)
      .single();

    if (contentError || !contentItem) {
      throw new Error(`Content item not found: ${contentError?.message}`);
    }

    if (!contentItem.content) {
      throw new Error('Content item has no generated content to review');
    }

    // Fetch active reviewer feedback patterns
    const { data: feedbackPatterns, error: patternsError } = await supabase
      .from('content_reviewer_feedback')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (patternsError) {
      console.error('Error fetching feedback patterns:', patternsError);
    }

    // Build dynamic prompt from learned patterns
    let learnedPatternsSection = '';
    if (feedbackPatterns && feedbackPatterns.length > 0) {
      const patternsByType: Record<string, typeof feedbackPatterns> = {};
      feedbackPatterns.forEach(p => {
        if (!patternsByType[p.feedback_type]) {
          patternsByType[p.feedback_type] = [];
        }
        patternsByType[p.feedback_type].push(p);
      });

      learnedPatternsSection = `
## LEARNED REVIEWER PATTERNS (from human feedback)
Based on previous human reviewer feedback, pay special attention to:

${Object.entries(patternsByType).map(([type, patterns]) => `
### ${type.toUpperCase()} GUIDELINES
${patterns.map(p => `- [${p.priority.toUpperCase()}] ${p.feedback_pattern}: ${p.feedback_instruction}`).join('\n')}
`).join('\n')}
`;
    }

    // Count current reviewer version
    const reviewerVersion = (feedbackPatterns?.length || 0) + 1;

    const systemPrompt = `You are Sentra's content quality reviewer. Your job is to evaluate blog posts and marketing content for quality, accuracy, and brand alignment.

## SENTRA BRAND GUIDELINES
- Sentra is an agentless Data Security Posture Management (DSPM) and Data Detection & Response (DDR) platform
- Key differentiators: multi-cloud data visibility, automatic sensitive data discovery, compliance automation, threat detection
- Tone: Confident but not aggressive, educational without being condescending, professional yet approachable
- Avoid: Fear-mongering, overly technical jargon without explanation, generic marketing speak

## SCORING RUBRIC
- Messaging Alignment (0-25): How well does it communicate Sentra's value proposition?
- Content Quality (0-25): Clarity, structure, flow, readability
- Accuracy (0-20): Factual correctness, proper citations, up-to-date information
- Tone & Voice (0-15): Brand voice consistency, appropriate for target audience
- SEO (0-15): Keyword integration, heading structure, meta-friendly content

## RECOMMENDATION THRESHOLDS
- Pass (80+): Ready for publication with no changes
- Minor Revisions (60-79): Good quality, needs small adjustments
- Major Revisions (40-59): Significant issues need addressing
- Reject (<40): Needs complete rewrite

${learnedPatternsSection}

Evaluate the content thoroughly and provide specific, actionable feedback.`;

    const userPrompt = `Review the following content piece:

**Title:** ${contentItem.title}
**Strategic Purpose:** ${contentItem.strategic_purpose}
**Target Keywords:** ${contentItem.target_keywords || 'None specified'}

**Content:**
${contentItem.content}

${contentItem.research_notes ? `
**Research Notes (for fact-checking):**
${contentItem.research_notes}
` : ''}

Provide a comprehensive review with scores and specific feedback.`;

    console.log('Calling OpenAI for content review...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [reviewTool],
        tool_choice: { type: "function", function: { name: "submit_content_review" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== 'submit_content_review') {
      throw new Error('Failed to get structured review from AI');
    }

    const reviewResult = JSON.parse(toolCall.function.arguments);

    // Generate markdown summary
    const reviewSummary = `# Content Review: ${contentItem.title}

## Overall Score: ${reviewResult.overallScore}/100

**Recommendation:** ${reviewResult.recommendation.replace('_', ' ').toUpperCase()}

${reviewResult.summary}

## Category Scores

| Category | Score | Max |
|----------|-------|-----|
| Messaging Alignment | ${reviewResult.categories.messaging.score} | 25 |
| Content Quality | ${reviewResult.categories.quality.score} | 25 |
| Accuracy | ${reviewResult.categories.accuracy.score} | 20 |
| Tone & Voice | ${reviewResult.categories.tone.score} | 15 |
| SEO | ${reviewResult.categories.seo.score} | 15 |

## Detailed Feedback

### Messaging
${reviewResult.categories.messaging.notes}

### Quality
${reviewResult.categories.quality.notes}

### Accuracy
${reviewResult.categories.accuracy.notes}

### Tone
${reviewResult.categories.tone.notes}

### SEO
${reviewResult.categories.seo.notes}

## Strengths
${reviewResult.strengths.map((s: string) => `- ${s}`).join('\n')}

## Issues Found
${reviewResult.issues.map((i: any) => `
### [${i.severity.toUpperCase()}] ${i.category}
**Location:** ${i.location || 'General'}
**Issue:** ${i.description}
**Suggestion:** ${i.suggestion}
`).join('\n')}
`;

    // Determine review status
    const reviewStatus = reviewResult.recommendation === 'pass' ? 'passed' : 'needs_changes';

    // Create review record
    const { data: review, error: reviewError } = await supabase
      .from('content_reviews')
      .insert({
        content_item_id: contentItemId,
        reviewer_version: reviewerVersion,
        review_result: reviewResult,
        review_summary: reviewSummary,
        overall_score: reviewResult.overallScore,
        status: reviewStatus,
      })
      .select()
      .single();

    if (reviewError) {
      throw new Error(`Failed to save review: ${reviewError.message}`);
    }

    // Update content item with review status
    const contentReviewStatus = reviewResult.recommendation === 'pass' ? 'approved' : 
      (reviewResult.recommendation === 'reject' || reviewResult.recommendation === 'major_revisions') ? 'needs_revision' : 'reviewed';

    await supabase
      .from('content_plan_items')
      .update({
        review_status: contentReviewStatus,
        latest_review_id: review.id,
      })
      .eq('id', contentItemId);

    console.log('Content review completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      review,
      reviewResult 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in review-content:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
