import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentItemId } = await req.json();
    
    if (!contentItemId) {
      throw new Error('contentItemId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the content item
    const { data: contentItem, error: fetchError } = await supabase
      .from('content_plan_items')
      .select('*')
      .eq('id', contentItemId)
      .single();

    if (fetchError || !contentItem) {
      throw new Error(`Failed to fetch content item: ${fetchError?.message}`);
    }

    console.log(`Generating content for: ${contentItem.title}`);

    // Step 1: Generate the blog post with explicit formatting instructions
    const generationPrompt = `You are an expert B2B content writer for Sentra, a leading Data Security Posture Management (DSPM) and Data Detection & Response (DDR) platform.

Write a compelling blog post based on the following:

**Title:** ${contentItem.title}
**Strategic Purpose:** ${contentItem.strategic_purpose}
${contentItem.target_keywords ? `**Target Keywords:** ${contentItem.target_keywords}` : ''}
${contentItem.outline ? `**Outline:** ${contentItem.outline}` : ''}
${contentItem.research_notes ? `**Research Notes:**\n${contentItem.research_notes}` : ''}

**Content Requirements:**
- Length: 800-1200 words
- Write in a professional but approachable tone
- Include practical insights and actionable takeaways
- Naturally incorporate target keywords where relevant
- Structure with clear headings and subheadings
- Include a compelling introduction and strong conclusion
- Focus on providing value to security leaders and practitioners

**CRITICAL MARKDOWN FORMATTING RULES - YOU MUST FOLLOW THESE EXACTLY:**

1. Start directly with content - NO frontmatter, NO metadata fields, NO code fences

2. Every heading MUST have ONE blank line BEFORE it and ONE blank line AFTER it:
   CORRECT:
   
   ## Heading Title
   
   Paragraph text here.

   WRONG:
   ## Heading Title
   Paragraph text here.

3. Every paragraph MUST be separated by ONE blank line

4. NEVER put paragraph text on the same line as a heading

5. For numbered sections, use this exact format:
   
   ## 1. Section Title
   
   Paragraph explaining this section.
   
   ## 2. Next Section
   
   More explanation here.

6. For bullet lists, put a blank line before and after the list:
   
   Here is an introduction to the list.
   
   - First bullet point
   - Second bullet point
   - Third bullet point
   
   Here is the paragraph after the list.

7. Do NOT use **bold** inside headings combined with numbers like ## **1.** - just use ## 1.

Write the complete blog post now, following these formatting rules exactly.`;

    const generationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: 'You are an expert B2B content writer. You follow markdown formatting instructions precisely and never deviate from them.' },
          { role: 'user', content: generationPrompt }
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!generationResponse.ok) {
      const errorText = await generationResponse.text();
      console.error('OpenAI generation error:', errorText);
      throw new Error(`Failed to generate content: ${errorText}`);
    }

    const generationData = await generationResponse.json();
    const generatedContent = generationData.choices[0].message.content;

    console.log('Content generated, applying humanization...');

    // Step 2: Humanize the content
    const humanizationPrompt = `You are an expert editor. Your task is to humanize the following AI-generated blog post by removing identifiable AI writing patterns while preserving the message, quality, AND markdown formatting.

**Patterns to fix:**
1. Replace ALL em dashes (—) with appropriate alternatives (commas, periods, or parentheses)
2. Remove/replace overused AI phrases: "dive into", "delve", "landscape", "leverage", "robust", "seamless", "cutting-edge", "revolutionize", "game-changer", "navigate", "realm", "paradigm", "holistic"
3. Fix formulaic sentence starters: Rewrite sentences starting with "In today's...", "It's worth noting that...", "When it comes to...", "In the ever-evolving..."
4. Remove excessive hedging: "It's important to note", "It should be mentioned", "One might argue"
5. Vary parallel structures: If multiple list items or sentences start the same way, vary them
6. Replace overused transitions: "Furthermore", "Moreover", "Additionally" - use more natural connections
7. Remove filler phrases: "In order to" → "to", "Due to the fact that" → "because"
8. Make language more direct and conversational

**CRITICAL - PRESERVE MARKDOWN FORMATTING:**
- Keep all blank lines before and after headings
- Keep all blank lines between paragraphs
- Keep all blank lines before and after lists
- Do NOT combine headings with paragraph text on same line
- Do NOT add any frontmatter or metadata
- Do NOT wrap in code fences

**Important:**
- Maintain the same meaning and key points
- Keep the professional tone appropriate for B2B security content
- Preserve all technical accuracy
- Output ONLY the revised blog post, no commentary

**Original content:**
${generatedContent}`;

    const humanizationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: 'You are an expert editor who humanizes AI-generated content while preserving quality, meaning, and exact markdown formatting structure.' },
          { role: 'user', content: humanizationPrompt }
        ],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    });

    if (!humanizationResponse.ok) {
      const errorText = await humanizationResponse.text();
      console.error('OpenAI humanization error:', errorText);
      throw new Error(`Failed to humanize content: ${errorText}`);
    }

    const humanizationData = await humanizationResponse.json();
    let humanizedContent = humanizationData.choices[0].message.content;

    // Safe post-processing: only add newlines, never split content
    humanizedContent = humanizedContent
      // Replace em dashes
      .replace(/\s—\s/g, ', ')
      .replace(/—/g, ' - ')
      .replace(/–/g, '-')
      // Fix double commas/spaces from replacement
      .replace(/\s,\s,/g, ', ')
      .replace(/\s{2,}/g, ' ')
      // Ensure blank line before headings (safe: only adds, doesn't split)
      .replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2')
      // Ensure blank line after headings (safe: only adds, doesn't split)
      .replace(/(#{1,6}\s[^\n]+)\n([^#\n\s])/g, '$1\n\n$2')
      // Normalize multiple blank lines to max 2
      .replace(/\n{4,}/g, '\n\n\n')
      .trim();

    console.log('Content humanized and post-processed, saving to database...');

    // Save the content and update status
    const { error: updateError } = await supabase
      .from('content_plan_items')
      .update({
        content: humanizedContent,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentItemId);

    if (updateError) {
      throw new Error(`Failed to save content: ${updateError.message}`);
    }

    console.log('Content saved successfully');

    return new Response(JSON.stringify({ 
      success: true,
      content: humanizedContent 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-content:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
