import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface ContentItem {
  id: string;
  title: string;
  strategic_purpose: string;
  target_keywords: string | null;
  outline: string | null;
}

interface DocumentMatch {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentItemId } = await req.json();

    if (!contentItemId) {
      throw new Error('contentItemId is required');
    }

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log(`Starting research for content item: ${contentItemId}`);

    // Create Supabase client with service role for DB access
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch the content item
    const { data: contentItem, error: fetchError } = await supabase
      .from('content_plan_items')
      .select('id, title, strategic_purpose, target_keywords, outline')
      .eq('id', contentItemId)
      .single();

    if (fetchError || !contentItem) {
      throw new Error(`Failed to fetch content item: ${fetchError?.message || 'Not found'}`);
    }

    console.log(`Researching topic: ${contentItem.title}`);

    // Step 1: Generate search queries
    const searchQueries = generateSearchQueries(contentItem);
    console.log('Generated search queries:', searchQueries);

    // Step 2: Perform web search using OpenAI
    const webResults = await performWebSearch(searchQueries, contentItem);
    console.log('Web search completed');

    // Step 3: Generate embedding for internal knowledge search
    const embedding = await generateEmbedding(
      `${contentItem.title} ${contentItem.strategic_purpose} ${contentItem.target_keywords || ''}`
    );
    console.log('Embedding generated');

    // Step 4: Search all 5 document tables
    const internalKnowledge = await searchInternalKnowledge(supabase, embedding);
    console.log('Internal knowledge search completed');

    // Step 5: Synthesize research document
    const researchDocument = await synthesizeResearch(contentItem, webResults, internalKnowledge);
    console.log('Research document synthesized');

    // Step 6: Update the content item with research notes
    const { error: updateError } = await supabase
      .from('content_plan_items')
      .update({
        research_notes: researchDocument,
        status: 'researched',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentItemId);

    if (updateError) {
      throw new Error(`Failed to update content item: ${updateError.message}`);
    }

    console.log('Research complete and saved');

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Research completed successfully',
      research_notes: researchDocument 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Research error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateSearchQueries(item: ContentItem): string[] {
  const queries: string[] = [];
  
  // Main topic query
  queries.push(`${item.title} best practices trends 2024 2025`);
  
  // Strategic purpose query
  queries.push(`${item.strategic_purpose} enterprise security`);
  
  // Keywords-based query
  if (item.target_keywords) {
    queries.push(`${item.target_keywords} data security cloud`);
  }
  
  // Industry-specific query
  queries.push(`${item.title} cybersecurity DSPM data protection`);
  
  return queries.slice(0, 4);
}

async function performWebSearch(queries: string[], item: ContentItem): Promise<string> {
  const combinedQuery = `
Research the following topic for creating marketing/educational content:

Topic: ${item.title}
Strategic Purpose: ${item.strategic_purpose}
Keywords: ${item.target_keywords || 'N/A'}

Search for:
1. Recent industry trends and statistics (2024-2025)
2. Best practices and expert insights
3. Competitive landscape and market analysis
4. Key challenges and solutions in this area

Provide comprehensive research with citations and sources.
`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      tools: [{ type: 'web_search' }],
      input: combinedQuery,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI web search error:', errorText);
    throw new Error(`OpenAI web search failed: ${response.status}`);
  }

  const data = await response.json();
  
  // Extract the output text from the response
  let webContent = '';
  if (data.output) {
    for (const item of data.output) {
      if (item.type === 'message' && item.content) {
        for (const contentItem of item.content) {
          if (contentItem.type === 'output_text') {
            webContent += contentItem.text + '\n\n';
          }
        }
      }
    }
  }

  return webContent || 'No web results found.';
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Embedding error:', errorText);
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function searchInternalKnowledge(
  supabase: ReturnType<typeof createClient>,
  embedding: number[]
): Promise<Record<string, DocumentMatch[]>> {
  const embeddingString = `[${embedding.join(',')}]`;

  // Search all 5 document tables in parallel
  const [sentra, competitors, industry, news, website] = await Promise.all([
    supabase.rpc('match_documents_sentra', { 
      query_embedding: embeddingString, 
      match_count: 8 
    }),
    supabase.rpc('match_documents_competitors', { 
      query_embedding: embeddingString, 
      match_count: 5 
    }),
    supabase.rpc('match_documents_industry', { 
      query_embedding: embeddingString, 
      match_count: 8 
    }),
    supabase.rpc('match_documents_news', { 
      query_embedding: embeddingString, 
      match_count: 8 
    }),
    supabase.rpc('match_documents_website', { 
      query_embedding: embeddingString, 
      match_count: 8 
    }),
  ]);

  return {
    sentra: sentra.data || [],
    competitors: competitors.data || [],
    industry: industry.data || [],
    news: news.data || [],
    website: website.data || [],
  };
}

async function synthesizeResearch(
  item: ContentItem,
  webResults: string,
  internalKnowledge: Record<string, DocumentMatch[]>
): Promise<string> {
  // Format internal knowledge for the prompt
  const formatDocs = (docs: DocumentMatch[], source: string) => {
    if (!docs.length) return `No relevant ${source} content found.`;
    return docs.map((d, i) => {
      const metadata = d.metadata ? JSON.stringify(d.metadata) : '';
      return `[${i + 1}] (similarity: ${(d.similarity * 100).toFixed(1)}%)\n${d.content?.substring(0, 500) || 'N/A'}...${metadata ? `\nMetadata: ${metadata}` : ''}`;
    }).join('\n\n');
  };

  const sentraContent = formatDocs(internalKnowledge.sentra, 'Sentra');
  const competitorContent = formatDocs(internalKnowledge.competitors, 'competitor');
  const industryContent = formatDocs(internalKnowledge.industry, 'industry');
  const newsContent = formatDocs(internalKnowledge.news, 'news');
  const websiteContent = formatDocs(internalKnowledge.website, 'website');

  const synthesisPrompt = `You are a content strategist for Sentra, a leading Data Security Posture Management (DSPM) and Data Detection & Response (DDR) platform. 

Create a comprehensive research document for the following content piece:

**Content Title:** ${item.title}
**Strategic Purpose:** ${item.strategic_purpose}
**Target Keywords:** ${item.target_keywords || 'N/A'}
**Outline:** ${item.outline || 'N/A'}

## Web Research Results:
${webResults}

## Sentra Internal Knowledge (Sales Enablement):
${sentraContent}

## Competitor Intelligence:
${competitorContent}

## Industry Analysis:
${industryContent}

## Recent News & Developments:
${newsContent}

## Sentra Website Content:
${websiteContent}

---

Create a structured research document in Markdown format with the following sections:

# Research: ${item.title}

## Executive Summary
(2-3 paragraphs summarizing key findings and content direction)

## Market & Industry Insights
### Current Trends
(Key trends from web research and industry analysis)

### Recent Developments
(Relevant news and updates)

### Statistics & Data Points
(Key statistics to cite in content)

## Competitive Landscape
(How competitors position themselves, gaps Sentra can fill)

## Sentra Positioning & Messaging
### Key Differentiators
(What makes Sentra unique for this topic)

### Recommended Messaging
(Specific talking points and value propositions)

### Existing Content to Reference
(Relevant Sentra materials)

## Content Recommendations
### Recommended Angle
(The unique perspective for this content)

### Key Points to Cover
(Must-include topics)

### Call-to-Action Suggestions
(Appropriate CTAs)

## Sources & Citations
### Web Sources
(List all web sources with URLs)

### Internal Sources
(Reference to internal documents used)

Be specific, actionable, and ensure all recommendations align with Sentra's positioning as the agentless DSPM + DDR solution for multi-cloud data visibility, compliance, and threat detection.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { role: 'system', content: 'You are an expert content strategist specializing in B2B cybersecurity marketing.' },
        { role: 'user', content: synthesisPrompt }
      ],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Synthesis error:', errorText);
    throw new Error(`Research synthesis failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
