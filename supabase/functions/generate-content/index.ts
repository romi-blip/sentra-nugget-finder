import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Competitor domains that must NEVER be linked to in content
const COMPETITOR_DOMAINS = [
  'cyera.io',
  'cyera.com',
  'varonis.com',
  'bigid.com',
  'securiti.ai',
  'securiti.com',
  'concentric.ai',
  'symmetrysystems.com',
  'symmetry-systems.com',
];

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

// Check if a URL belongs to a competitor
function isCompetitorUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return COMPETITOR_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

// Remove competitor URLs from markdown content
function removeCompetitorLinks(content: string): { content: string; removedCount: number } {
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
  let removedCount = 0;
  
  const filteredContent = content.replace(markdownLinkRegex, (match, linkText, url) => {
    if (isCompetitorUrl(url)) {
      console.log(`Removing competitor link: ${url}`);
      removedCount++;
      // Return just the link text without the URL
      return linkText;
    }
    return match;
  });
  
  return { content: filteredContent, removedCount };
}

// Filter competitor URLs from sources array
function filterCompetitorSources(sources: Array<{ title: string; url?: string }> | undefined): Array<{ title: string; url?: string }> {
  if (!sources) return [];
  return sources.filter(source => {
    if (source.url && isCompetitorUrl(source.url)) {
      console.log(`Filtering competitor source: ${source.url}`);
      return false;
    }
    return true;
  });
}

// Extract all URLs from research notes for validation
function extractUrlsFromResearch(researchNotes: string): Set<string> {
  const urlRegex = /https?:\/\/[^\s\)>\]]+/g;
  const matches = researchNotes.match(urlRegex) || [];
  // Clean URLs (remove trailing punctuation)
  const cleanedUrls = matches.map(url => url.replace(/[.,;:!?\)>\]]+$/, ''));
  return new Set(cleanedUrls);
}

// Extract URLs from generated content
function extractUrlsFromContent(content: string): string[] {
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
  const urls: string[] = [];
  let match;
  while ((match = markdownLinkRegex.exec(content)) !== null) {
    urls.push(match[2].replace(/[.,;:!?\)]+$/, ''));
  }
  return urls;
}

// Validate that content URLs exist in research notes
function validateContentUrls(content: string, researchUrls: Set<string>): { valid: string[], invalid: string[] } {
  const contentUrls = extractUrlsFromContent(content);
  const valid: string[] = [];
  const invalid: string[] = [];
  
  for (const url of contentUrls) {
    // Check if URL exists in research or is a close match (same domain)
    const urlDomain = new URL(url).hostname;
    const isValid = researchUrls.has(url) || 
      Array.from(researchUrls).some(researchUrl => {
        try {
          return new URL(researchUrl).hostname === urlDomain;
        } catch {
          return false;
        }
      });
    
    if (isValid) {
      valid.push(url);
    } else {
      invalid.push(url);
    }
  }
  
  return { valid, invalid };
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
  
  // Sources/References (if provided) - filter out competitor sources
  const filteredSources = filterCompetitorSources(data.sources);
  if (filteredSources && filteredSources.length > 0) {
    lines.push('## References');
    lines.push('');
    for (const source of filteredSources) {
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
    description: "Create a structured blog post with proper sections. IMPORTANT: Only use URLs that appear in the research notes. Each inline link must support the specific claim it's attached to. NEVER link to competitor websites.",
    parameters: {
      type: "object",
      properties: {
        title: { 
          type: "string", 
          description: "The main title of the blog post. Just the title text, no # symbols or formatting." 
        },
        introduction: { 
          type: "string", 
          description: "1-2 opening paragraphs that hook the reader and introduce the topic. Separate paragraphs with double newlines. Can include inline links if citing data." 
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
                description: "Section content with paragraphs separated by double newlines. CRITICAL: When citing statistics, data points, or external research, use inline markdown links [claim text](URL) where the URL comes DIRECTLY from the research notes. Do NOT invent URLs. Only link claims that have corresponding URLs in the research notes. NEVER link to competitor websites (Cyera, Varonis, BigID, Securiti, Concentric, Symmetry Systems)." 
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
          description: "List of sources actually cited in the content. Only include sources whose URLs appear in the research notes and were used in the content. Do NOT include competitor websites.",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Source title or description" },
              url: { type: "string", description: "Source URL - must be from research notes and NOT a competitor website" }
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

    // Extract available URLs from research notes for validation
    const researchUrls = contentItem.research_notes 
      ? extractUrlsFromResearch(contentItem.research_notes)
      : new Set<string>();
    console.log(`Found ${researchUrls.size} URLs in research notes`);

    // Step 1: Generate structured blog post using tool calling
    const systemPrompt = `You are an expert B2B content writer for Sentra, a leading Data Security Posture Management (DSPM) and Data Detection & Response (DDR) platform.

You write compelling, valuable content for security leaders and practitioners. Your writing is:
- Professional but approachable
- Focused on practical insights and actionable takeaways
- Well-structured with clear logical flow
- 800-1200 words total

CRITICAL LINKING RULES:
1. ONLY use URLs that appear in the research notes provided
2. When citing a statistic or claim, find the corresponding URL in the research notes and use it
3. Do NOT invent or hallucinate URLs
4. If a claim doesn't have a supporting URL in the research notes, do not add a link for it
5. Links should be contextually relevant - the link text should describe what the user will find

**COMPETITOR RESTRICTION - EXTREMELY IMPORTANT:**
You must NEVER include links to competitor websites in the content. The following companies are competitors and their domains must NOT be linked:
- Cyera (cyera.io, cyera.com)
- Varonis (varonis.com)
- BigID (bigid.com)
- Securiti AI (securiti.ai, securiti.com)
- Concentric AI (concentric.ai)
- Symmetry Systems (symmetrysystems.com)

You may reference competitor information for context (e.g., "competitors in the DSPM space"), but you must NEVER include actual links to their websites. If research notes contain competitor URLs, DO NOT use them in the content.

IMPORTANT: You MUST use the create_blog_post function to structure your response. Do not write free-form text.`;

    const userPrompt = `Write a blog post based on the following:

**Title:** ${contentItem.title}
**Strategic Purpose:** ${contentItem.strategic_purpose}
${contentItem.target_keywords ? `**Target Keywords to naturally incorporate:** ${contentItem.target_keywords}` : ''}
${contentItem.outline ? `**Outline to follow:** ${contentItem.outline}` : ''}
${contentItem.research_notes ? `**Research Notes (IMPORTANT - extract links from here):**\n${contentItem.research_notes}` : ''}

Create a compelling blog post with:
- An engaging introduction that hooks the reader
- 3-5 well-developed sections with clear headings
- A strong conclusion with key takeaways
- Natural incorporation of target keywords where relevant

**CRITICAL LINKING INSTRUCTIONS:**
- Include 3-4 inline links throughout the content using markdown format [descriptive text](URL)
- ONLY use URLs that you can find in the Research Notes above
- Each link must support a specific claim or data point
- Place links naturally within sentences, not as standalone references
- If you cannot find a URL in the research notes for a claim, do NOT add a link - just state the claim without linking
- The link text should describe what the source is about, not generic text like "click here"

**COMPETITOR LINK RESTRICTION:**
- NEVER link to: Cyera, Varonis, BigID, Securiti AI, Concentric AI, or Symmetry Systems websites
- If research notes contain competitor URLs, ignore them when creating links
- You may mention competitors by name for context, but NEVER link to their domains

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
    let formattedContent = formatBlogPost(blogPostData);
    
    // Post-generation filtering: Remove any competitor links that slipped through
    const { content: filteredContent, removedCount } = removeCompetitorLinks(formattedContent);
    if (removedCount > 0) {
      console.log(`Removed ${removedCount} competitor link(s) from generated content`);
      formattedContent = filteredContent;
    }
    
    // Validate URLs in generated content
    if (researchUrls.size > 0) {
      const { valid, invalid } = validateContentUrls(formattedContent, researchUrls);
      console.log(`URL validation: ${valid.length} valid, ${invalid.length} invalid`);
      if (invalid.length > 0) {
        console.warn('Invalid URLs found in content (not in research notes):', invalid);
      }
    }
    
    console.log('Formatted markdown content, applying humanization...');

    // Step 2: Humanize the content (simple text editing, structure is already correct)
    const humanizationPrompt = `You are an expert editor. Humanize this blog post by removing AI writing patterns while preserving the exact structure, formatting, and ALL LINKS.

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
- PRESERVE ALL MARKDOWN LINKS [text](url) exactly as they are - do not modify or remove any links
- Ensure NO competitor links (cyera.io, varonis.com, bigid.com, securiti.ai, concentric.ai, symmetrysystems.com) appear in the output
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
          { role: 'system', content: 'You are an expert editor. You humanize AI content while preserving exact markdown structure and all links. Output only the edited content with no commentary.' },
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
      
      // Final competitor link removal after humanization (belt and suspenders)
      const { content: finalFiltered, removedCount: finalRemovedCount } = removeCompetitorLinks(finalContent);
      if (finalRemovedCount > 0) {
        console.log(`Removed ${finalRemovedCount} competitor link(s) after humanization`);
        finalContent = finalFiltered;
      }
      
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
