import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface StructureRequest {
  content: string;
  documentTitle?: string;
}

interface StructuredSection {
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet-list' | 'feature-grid' | 'page-break';
  content: string;
  items?: string[];
  features?: Array<{
    title: string;
    description: string;
  }>;
}

interface StructuredDocument {
  title: string;
  subtitle?: string;
  sections: StructuredSection[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, documentTitle }: StructureRequest = await req.json();

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[structure-content] Processing content for structuring');

    const systemPrompt = `You are a document structure specialist. Your job is to take raw content and structure it properly for a professional whitepaper/datasheet PDF.

RULES:
1. DO NOT change the actual content or wording - only reorganize and format it
2. Identify and properly tag headings (h1 for main sections, h2 for subsections, h3 for sub-subsections)
3. Convert lists into proper bullet-list sections
4. Group related feature descriptions into feature-grid sections (2-column layout)
5. Add page-break markers before major new sections (h1 headings)
6. Ensure proper paragraph breaks

OUTPUT FORMAT (JSON):
{
  "title": "Main document title",
  "subtitle": "Optional subtitle",
  "sections": [
    { "type": "page-break" },
    { "type": "h1", "content": "Section Title" },
    { "type": "h2", "content": "Subsection Title" },
    { "type": "paragraph", "content": "Regular paragraph text..." },
    { "type": "bullet-list", "items": ["Item 1", "Item 2", "Item 3"] },
    { 
      "type": "feature-grid", 
      "features": [
        { "title": "Feature Name", "description": "Feature description text" },
        { "title": "Feature Name 2", "description": "Feature description text" }
      ]
    }
  ]
}

GUIDELINES:
- Use feature-grid for capability/benefit lists (pairs of title + description)
- Use bullet-list for simple lists without elaborate descriptions
- Add page-break before each h1 section (except the first one)
- Keep paragraphs at a reasonable length (split very long ones)
- Preserve all original content - only structure it better`;

    const userPrompt = `Please structure the following content for a professional PDF document${documentTitle ? ` titled "${documentTitle}"` : ''}:

---
${content}
---

Return ONLY valid JSON matching the specified format.`;

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
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[structure-content] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const structuredContent = data.choices[0].message.content;

    console.log('[structure-content] Content structured successfully');

    let parsed: StructuredDocument;
    try {
      parsed = JSON.parse(structuredContent);
    } catch (parseError) {
      console.error('[structure-content] Failed to parse JSON:', parseError);
      // Return a basic structure if parsing fails
      parsed = {
        title: documentTitle || 'Document',
        sections: [{ type: 'paragraph', content }]
      };
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        structured: parsed 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[structure-content] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
