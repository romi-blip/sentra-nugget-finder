import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Normalize AI content to strip metadata and formatting artifacts
const normalizeRevisedContent = (content: string): string => {
  let cleanedContent = content;

  // Strip YAML frontmatter
  cleanedContent = cleanedContent.replace(
    /^[\s]*```(?:markdown|md)?\s*\n---\n(?:[a-zA-Z_-]+:\s*[^\n]*\n)+---\s*\n```[\s]*/m,
    ''
  );
  cleanedContent = cleanedContent.replace(
    /^---\n(?:[a-zA-Z_-]+:\s*[^\n]*\n)+---\n*/,
    ''
  );
  cleanedContent = cleanedContent.replace(/^[\s]*---[\s]*\n/, '');
  
  // Strip standalone metadata lines at the beginning (title:, meta_title:, meta_description:, etc.)
  cleanedContent = cleanedContent.replace(
    /^[\s]*(title|meta_title|meta_description|meta|keywords|description|slug|date|author|category|tags):\s*[^\n]+\n/gim,
    ''
  );
  
  // Strip any **Title:** or **Meta Title:** prefixed lines that GPT might add
  cleanedContent = cleanedContent.replace(
    /^\*\*(Title|Meta Title|Meta Description|Description|Keywords|Slug):\*\*\s*[^\n]+\n\n?/gim,
    ''
  );

  // Strip code fence wrappers ONLY if they wrap the entire content
  const fenceMatch = cleanedContent.trim().match(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/);
  if (fenceMatch) {
    cleanedContent = fenceMatch[1];
  }

  // Decode HTML entities
  cleanedContent = cleanedContent
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Normalize line endings and collapse excessive blank lines
  cleanedContent = cleanedContent
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  return cleanedContent;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentItemId, reviewId } = await req.json();

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

    // Fetch the review (use provided reviewId or latest)
    let review;
    if (reviewId) {
      const { data, error } = await supabase
        .from('content_reviews')
        .select('*')
        .eq('id', reviewId)
        .single();
      review = data;
      if (error) throw new Error(`Review not found: ${error.message}`);
    } else {
      const { data, error } = await supabase
        .from('content_reviews')
        .select('*')
        .eq('content_item_id', contentItemId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      review = data;
      if (error) throw new Error(`No review found for content item: ${error.message}`);
    }

    if (!review.review_result || !review.review_result.issues || review.review_result.issues.length === 0) {
      throw new Error('No issues found in review to address');
    }

    const issues = review.review_result.issues;
    const categories = review.review_result.categories;

    // Build revision instructions from the review
    const revisionInstructions = issues.map((issue: any, i: number) => 
      `${i + 1}. [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.description}
   Fix: ${issue.suggestion}${issue.location ? `\n   Location: ${issue.location}` : ''}`
    ).join('\n\n');

    const categoryFeedback = Object.entries(categories)
      .filter(([_, data]: [string, any]) => data.score < (data.score <= 15 ? 12 : data.score <= 20 ? 16 : 20))
      .map(([name, data]: [string, any]) => `- ${name}: ${data.notes}`)
      .join('\n');

    const systemPrompt = `You are an expert content editor. Your job is to revise content based on specific feedback while maintaining the original voice and structure as much as possible.

Guidelines:
1. Address each issue specifically
2. Maintain the original content's structure and flow
3. Don't over-edit - make minimal changes to fix the issues
4. Preserve any good elements mentioned in the review
5. Keep the same approximate length
6. Ensure all facts and claims remain accurate`;

    const userPrompt = `Please revise the following content based on the review feedback:

**Original Content:**
${contentItem.content}

**Review Score:** ${review.overall_score}/100

**Issues to Address:**
${revisionInstructions}

${categoryFeedback ? `**Category Feedback:**\n${categoryFeedback}` : ''}

**Strengths to Preserve:**
${review.review_result.strengths?.join('\n- ') || 'None specified'}

Please provide the revised content. Maintain markdown formatting and ensure all issues are addressed.`;

    console.log('Generating revised content...');

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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const rawRevisedContent = data.choices[0]?.message?.content;

    if (!rawRevisedContent) {
      throw new Error('Failed to generate revised content');
    }

    // Normalize revised content to strip metadata and artifacts
    const revisedContent = normalizeRevisedContent(rawRevisedContent);
    console.log('Normalized revised content (first 200 chars):', revisedContent.substring(0, 200));

    // Update content item with revised content
    await supabase
      .from('content_plan_items')
      .update({
        content: revisedContent,
        review_status: 'not_reviewed', // Reset review status after revision
        status: 'completed', // Keep as completed
      })
      .eq('id', contentItemId);

    // Mark the review as revised
    await supabase
      .from('content_reviews')
      .update({
        status: 'revised',
      })
      .eq('id', review.id);

    console.log('Content revised successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      revisedContent,
      issuesAddressed: issues.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in apply-review-feedback:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
