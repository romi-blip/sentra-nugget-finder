import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as mammoth from "https://esm.sh/mammoth@1.8.0";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedComment {
  author: string;
  date: string;
  commentText: string;
  anchorText: string;
}

interface ProcessedComment {
  original: ExtractedComment;
  category: string;
  severity: string;
  issue: string;
  instruction: string;
}

interface FeedbackPattern {
  feedback_type: string;
  feedback_pattern: string;
  feedback_instruction: string;
  priority: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { contentItemId, filename, fileData } = await req.json();

    if (!contentItemId || !fileData) {
      return new Response(JSON.stringify({ error: 'Missing contentItemId or fileData' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the content item
    const { data: contentItem, error: fetchError } = await supabase
      .from('content_plan_items')
      .select('*')
      .eq('id', contentItemId)
      .single();

    if (fetchError || !contentItem) {
      return new Response(JSON.stringify({ error: 'Content item not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!contentItem.content) {
      return new Response(JSON.stringify({ error: 'Content item has no content to review' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing DOCX review for content item: ${contentItemId}`);

    // Decode base64 file data
    const binaryString = atob(fileData.split(',').pop() || fileData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Extract comments from DOCX using JSZip
    const comments = await extractDocxComments(bytes);
    console.log(`Extracted ${comments.length} comments from DOCX`);

    if (comments.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No comments found in the uploaded document',
        message: 'Please ensure the Word document contains reviewer comments (not just track changes)'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Analyze comments with GPT
    const processedComments = await analyzeComments(openaiApiKey, comments, contentItem.content);
    console.log(`Analyzed ${processedComments.length} comments`);

    // Revise content based on comments
    const revisedContent = await reviseContent(openaiApiKey, contentItem.content, processedComments);
    console.log('Content revised based on feedback');

    // Extract patterns for reviewer agent
    const patterns = await extractPatterns(openaiApiKey, processedComments);
    console.log(`Extracted ${patterns.length} patterns for reviewer agent`);

    // Save patterns to database (checking for duplicates)
    let patternsCreated = 0;
    for (const pattern of patterns) {
      const isDuplicate = await checkDuplicatePattern(supabase, pattern);
      if (!isDuplicate) {
        const { error: insertError } = await supabase
          .from('content_reviewer_feedback')
          .insert({
            ...pattern,
            created_by: user.id,
          });
        
        if (!insertError) {
          patternsCreated++;
        }
      }
    }
    console.log(`Created ${patternsCreated} new patterns`);

    // Update content item with revised content
    const { error: updateError } = await supabase
      .from('content_plan_items')
      .update({ 
        content: revisedContent,
        updated_at: new Date().toISOString()
      })
      .eq('id', contentItemId);

    if (updateError) {
      console.error('Error updating content:', updateError);
    }

    // Create a review record to track this DOCX review
    await supabase
      .from('content_reviews')
      .insert({
        content_item_id: contentItemId,
        status: 'completed',
        overall_score: null,
        review_summary: `DOCX review processed: ${comments.length} comments, ${patternsCreated} patterns added`,
        human_feedback: comments.map(c => c.commentText).join('\n\n'),
        feedback_applied: true,
      });

    return new Response(JSON.stringify({
      success: true,
      commentsProcessed: comments.length,
      patternsCreated,
      revisionsApplied: true,
      summary: {
        comments: processedComments.map(c => ({
          category: c.category,
          severity: c.severity,
          issue: c.issue,
          instruction: c.instruction,
        })),
        patternsAdded: patterns.slice(0, patternsCreated).map(p => ({
          type: p.feedback_type,
          pattern: p.feedback_pattern,
        })),
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing DOCX review:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to process DOCX review'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function extractDocxComments(fileBytes: Uint8Array): Promise<ExtractedComment[]> {
  const comments: ExtractedComment[] = [];
  
  try {
    const zip = await JSZip.loadAsync(fileBytes);
    
    // Get comments.xml from the DOCX archive
    const commentsXml = await zip.file('word/comments.xml')?.async('string');
    
    if (!commentsXml) {
      console.log('No comments.xml found in DOCX');
      return comments;
    }

    // Parse comments using regex (simple XML parsing)
    const commentRegex = /<w:comment[^>]*w:author="([^"]*)"[^>]*w:date="([^"]*)"[^>]*>([\s\S]*?)<\/w:comment>/g;
    const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    
    let match;
    while ((match = commentRegex.exec(commentsXml)) !== null) {
      const author = match[1];
      const date = match[2];
      const content = match[3];
      
      // Extract text from comment content
      let commentText = '';
      let textMatch;
      while ((textMatch = textRegex.exec(content)) !== null) {
        commentText += textMatch[1];
      }
      
      if (commentText.trim()) {
        comments.push({
          author,
          date,
          commentText: commentText.trim(),
          anchorText: '', // We'd need document.xml to get the anchor text
        });
      }
    }

    // Try to get anchor text from document.xml
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (documentXml && comments.length > 0) {
      // Extract text near comment references
      const rangeStartRegex = /<w:commentRangeStart[^>]*w:id="(\d+)"[^>]*\/>/g;
      const rangeEndRegex = /<w:commentRangeEnd[^>]*w:id="(\d+)"[^>]*\/>/g;
      
      // Simple approach: extract surrounding text for each comment
      // This is a simplified extraction
    }

  } catch (error) {
    console.error('Error extracting comments:', error);
  }

  return comments;
}

async function analyzeComments(
  apiKey: string, 
  comments: ExtractedComment[], 
  content: string
): Promise<ProcessedComment[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        {
          role: 'system',
          content: `You are an expert content reviewer. Analyze the following comments from a human reviewer and categorize each one.

For each comment, determine:
1. Category: One of "style", "accuracy", "tone", "structure", "messaging", or "general"
2. Severity: One of "critical", "major", "minor", or "suggestion"
3. The specific issue being pointed out
4. A clear instruction for how to fix it

Return a JSON array of analyzed comments.`
        },
        {
          role: 'user',
          content: `Content being reviewed:
---
${content.slice(0, 4000)}
---

Comments from human reviewer:
${comments.map((c, i) => `${i + 1}. "${c.commentText}" (by ${c.author})`).join('\n')}`
        }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'categorize_comments',
          description: 'Categorize and analyze reviewer comments',
          parameters: {
            type: 'object',
            properties: {
              analyzed_comments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    index: { type: 'number', description: 'Comment index (1-based)' },
                    category: { type: 'string', enum: ['style', 'accuracy', 'tone', 'structure', 'messaging', 'general'] },
                    severity: { type: 'string', enum: ['critical', 'major', 'minor', 'suggestion'] },
                    issue: { type: 'string', description: 'The specific issue identified' },
                    instruction: { type: 'string', description: 'How to fix this issue' },
                  },
                  required: ['index', 'category', 'severity', 'issue', 'instruction'],
                },
              },
            },
            required: ['analyzed_comments'],
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'categorize_comments' } },
    }),
  });

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall) {
    console.error('No tool call in response');
    return [];
  }

  const args = JSON.parse(toolCall.function.arguments);
  
  return args.analyzed_comments.map((ac: any) => ({
    original: comments[ac.index - 1],
    category: ac.category,
    severity: ac.severity,
    issue: ac.issue,
    instruction: ac.instruction,
  }));
}

async function reviseContent(
  apiKey: string,
  content: string,
  processedComments: ProcessedComment[]
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        {
          role: 'system',
          content: `You are an expert content editor. Revise the following content based on human reviewer feedback.

Apply each piece of feedback carefully while:
- Maintaining the original voice and structure
- Preserving any embedded links and formatting
- Making targeted changes rather than rewriting everything
- Keeping the word count similar (800-1200 words)

Return only the revised content in markdown format.`
        },
        {
          role: 'user',
          content: `Original content:
---
${content}
---

Reviewer feedback to apply:
${processedComments.map((c, i) => `${i + 1}. [${c.severity.toUpperCase()}] ${c.category}: ${c.issue}
   Fix: ${c.instruction}`).join('\n\n')}`
        }
      ],
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || content;
}

async function extractPatterns(
  apiKey: string,
  processedComments: ProcessedComment[]
): Promise<FeedbackPattern[]> {
  // Only extract patterns from major or critical issues
  const significantComments = processedComments.filter(
    c => c.severity === 'critical' || c.severity === 'major'
  );

  if (significantComments.length === 0) {
    return [];
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting reusable feedback patterns from specific reviewer comments.

For each significant comment, extract a general pattern that can be applied to future content reviews.
Focus on principles that apply broadly, not specific instances.

The pattern should help an AI reviewer catch similar issues in the future.`
        },
        {
          role: 'user',
          content: `Significant reviewer comments:
${significantComments.map((c, i) => `${i + 1}. [${c.category}] Issue: ${c.issue}
   Instruction: ${c.instruction}`).join('\n\n')}`
        }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'extract_patterns',
          description: 'Extract reusable feedback patterns',
          parameters: {
            type: 'object',
            properties: {
              patterns: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    feedback_type: { type: 'string', enum: ['style', 'accuracy', 'tone', 'structure', 'messaging', 'general'] },
                    feedback_pattern: { type: 'string', description: 'What pattern to look for (under 100 chars)' },
                    feedback_instruction: { type: 'string', description: 'What to do when found (under 200 chars)' },
                    priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                  },
                  required: ['feedback_type', 'feedback_pattern', 'feedback_instruction', 'priority'],
                },
              },
            },
            required: ['patterns'],
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'extract_patterns' } },
    }),
  });

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall) {
    return [];
  }

  const args = JSON.parse(toolCall.function.arguments);
  return args.patterns || [];
}

async function checkDuplicatePattern(supabase: any, pattern: FeedbackPattern): Promise<boolean> {
  const { data: existing } = await supabase
    .from('content_reviewer_feedback')
    .select('feedback_pattern')
    .eq('feedback_type', pattern.feedback_type)
    .eq('is_active', true);

  if (!existing || existing.length === 0) {
    return false;
  }

  // Simple similarity check - if pattern text is very similar
  const newPatternLower = pattern.feedback_pattern.toLowerCase();
  for (const ex of existing) {
    const existingLower = ex.feedback_pattern.toLowerCase();
    // Check if patterns are similar (share >60% words)
    const newWords = new Set(newPatternLower.split(/\s+/));
    const existingWords = new Set(existingLower.split(/\s+/));
    const intersection = [...newWords].filter(w => existingWords.has(w));
    const similarity = intersection.length / Math.max(newWords.size, existingWords.size);
    
    if (similarity > 0.6) {
      return true;
    }
  }

  return false;
}
