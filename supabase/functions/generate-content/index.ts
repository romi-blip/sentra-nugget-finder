import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Type for the structured blog post output
interface BlogPostStructure {
  title: string;
  introduction: string;
  sections: Array<{
    heading: string;
    content: string;
  }>;
  conclusion: string;
  sources?: Array<{
    title: string;
    url?: string;
  }>;
}

// Convert structured data to properly formatted markdown
function formatBlogPost(data: BlogPostStructure): string {
  const lines: string[] = [];
  
  // Title (H1)
  lines.push(`# ${data.title}`);
  lines.push('');
  
  // Introduction - handle multiple paragraphs
  const introParagraphs = data.introduction.split(/\n\n+/).filter(p => p.trim());
  for (const para of introParagraphs) {
    lines.push(para.trim());
    lines.push('');
  }
  
  // Sections
  for (let i = 0; i < data.sections.length; i++) {
    const section = data.sections[i];
    
    // Section heading (H2)
    lines.push(`## ${section.heading}`);
    lines.push('');
    
    // Section content - handle paragraphs, lists, etc.
    const contentParts = section.content.split(/\n\n+/).filter(p => p.trim());
    for (const part of contentParts) {
      // Check if this is a list (starts with - or number.)
      const trimmedPart = part.trim();
      if (trimmedPart.match(/^[-*]\s/) || trimmedPart.match(/^\d+\.\s/)) {
        // It's a list - preserve line breaks within it
        lines.push(trimmedPart);
      } else {
        lines.push(trimmedPart);
      }
      lines.push('');
    }
  }
  
  // Conclusion (H2)
  lines.push('## Conclusion');
  lines.push('');
  
  const conclusionParagraphs = data.conclusion.split(/\n\n+/).filter(p => p.trim());
  for (const para of conclusionParagraphs) {
    lines.push(para.trim());
    lines.push('');
  }
  
  // Sources/References (if provided)
  if (data.sources && data.sources.length > 0) {
    lines.push('## References');
    lines.push('');
    for (const source of data.sources) {
      if (source.url) {
        lines.push(`- [${source.title}](${source.url})`);
      } else {
        lines.push(`- ${source.title}`);
      }
    }
    lines.push('');
  }
  
  // Join and clean up
  return lines.join('\n').trim();
}

// Tool definition for structured blog post output
const blogPostTool = {
  type: "function",
  function: {
    name: "create_blog_post",
    description: "Create a structured blog post with proper sections",
    parameters: {
      type: "object",
      properties: {
        title: { 
          type: "string", 
          description: "The main title of the blog post. Just the title text, no # symbols or formatting." 
        },
        introduction: { 
          type: "string", 
          description: "1-2 opening paragraphs that hook the reader and introduce the topic. Separate paragraphs with double newlines." 
        },
        sections: {
          type: "array",
          description: "3-5 main content sections",
          items: {
            type: "object",
            properties: {
              heading: { 
                type: "string", 
                description: "Section heading text. No ## symbols, no numbers. Just the heading text." 
              },
              content: { 
                type: "string", 
                description: "Section content with paragraphs separated by double newlines. Can include bullet lists (use - for bullets) or numbered lists." 
              }
            },
            required: ["heading", "content"]
          }
        },
        conclusion: { 
          type: "string", 
          description: "1-2 closing paragraphs summarizing key takeaways. Separate paragraphs with double newlines." 
        },
        sources: {
          type: "array",
          description: "List of sources and references cited in the content. Include any sources from the research notes.",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Source title or description" },
              url: { type: "string", description: "Source URL if available" }
            },
            required: ["title"]
          }
        }
      },
      required: ["title", "introduction", "sections", "conclusion"]
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

    // Step 1: Generate structured blog post using tool calling
    const systemPrompt = `You are an expert B2B content writer for Sentra, a leading Data Security Posture Management (DSPM) and Data Detection & Response (DDR) platform.

You write compelling, valuable content for security leaders and practitioners. Your writing is:
- Professional but approachable
- Focused on practical insights and actionable takeaways
- Well-structured with clear logical flow
- 800-1200 words total

IMPORTANT: You MUST use the create_blog_post function to structure your response. Do not write free-form text.`;

    const userPrompt = `Write a blog post based on the following:

**Title:** ${contentItem.title}
**Strategic Purpose:** ${contentItem.strategic_purpose}
${contentItem.target_keywords ? `**Target Keywords to naturally incorporate:** ${contentItem.target_keywords}` : ''}
${contentItem.outline ? `**Outline to follow:** ${contentItem.outline}` : ''}
${contentItem.research_notes ? `**Research Notes for reference:**\n${contentItem.research_notes}` : ''}

Create a compelling blog post with:
- An engaging introduction that hooks the reader
- 3-5 well-developed sections with clear headings
- A strong conclusion with key takeaways
- Natural incorporation of target keywords where relevant
- Include relevant sources from the research notes in the sources array (extract URLs and titles from the Sources & Citations section)

Use the create_blog_post function to structure your response.`;

    console.log('Calling OpenAI with structured output (tool calling)...');

    const generationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
        tools: [blogPostTool],
        tool_choice: { type: "function", function: { name: "create_blog_post" } },
        max_tokens: 4000,
      }),
    });

    if (!generationResponse.ok) {
      const errorText = await generationResponse.text();
      console.error('OpenAI generation error:', errorText);
      throw new Error(`Failed to generate content: ${errorText}`);
    }

    const generationData = await generationResponse.json();
    
    // Extract the structured data from the tool call
    const toolCall = generationData.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'create_blog_post') {
      console.error('Unexpected response structure:', JSON.stringify(generationData, null, 2));
      throw new Error('Failed to get structured blog post from GPT');
    }

    const blogPostData: BlogPostStructure = JSON.parse(toolCall.function.arguments);
    console.log('Received structured blog post data:', JSON.stringify(blogPostData, null, 2).substring(0, 500) + '...');

    // Format the structured data into proper markdown
    const formattedContent = formatBlogPost(blogPostData);
    console.log('Formatted markdown content, applying humanization...');

    // Step 2: Humanize the content (simple text editing, structure is already correct)
    const humanizationPrompt = `You are an expert editor. Humanize this blog post by removing AI writing patterns while preserving the exact structure and formatting.

**Patterns to fix:**
1. Replace em dashes (—) with commas, periods, or parentheses
2. Remove overused AI phrases: "dive into", "delve", "landscape", "leverage", "robust", "seamless", "cutting-edge", "revolutionize", "game-changer", "navigate", "realm", "paradigm", "holistic", "ever-evolving"
3. Rewrite formulaic starters: "In today's...", "It's worth noting...", "When it comes to...", "In an era..."
4. Remove hedging: "It's important to note", "It should be mentioned"
5. Vary parallel structures in lists
6. Replace overused transitions: "Furthermore", "Moreover", "Additionally"
7. Remove filler: "In order to" → "to", "Due to the fact" → "because"
8. Make language more direct and natural

**CRITICAL:** 
- Keep ALL blank lines exactly as they are
- Keep all # and ## heading markers exactly as they are
- Output ONLY the revised content, nothing else
- Do NOT add any commentary, notes, or explanations

**Content to humanize:**
${formattedContent}`;

    const humanizationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: 'You are an expert editor. You humanize AI content while preserving exact markdown structure. Output only the edited content with no commentary.' },
          { role: 'user', content: humanizationPrompt }
        ],
        max_tokens: 4000,
      }),
    });

    if (!humanizationResponse.ok) {
      const errorText = await humanizationResponse.text();
      console.error('OpenAI humanization error:', errorText);
      // If humanization fails, use the formatted content directly
      console.log('Humanization failed, using formatted content directly');
    }

    let finalContent = formattedContent;
    
    if (humanizationResponse.ok) {
      const humanizationData = await humanizationResponse.json();
      finalContent = humanizationData.choices[0].message.content;
      
      // Minimal cleanup - just em dashes and normalize blank lines
      finalContent = finalContent
        .replace(/\s—\s/g, ', ')
        .replace(/—/g, ' - ')
        .replace(/–/g, '-')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim();
    }

    console.log('Content finalized, saving to database...');

    // Save the content and update status
    const { error: updateError } = await supabase
      .from('content_plan_items')
      .update({
        content: finalContent,
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
      content: finalContent 
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
