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
  action_type: 'modify' | 'remove' | 'add' | 'conditional' | 'clarify';
  target_content: string;
  decision_needed?: string;
  conservative_action?: string;
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

    // Store original content for comparison
    const originalContent = contentItem.content;

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
      originalContent,
      revisedContent,
      summary: {
        comments: processedComments.map(c => ({
          category: c.category,
          severity: c.severity,
          issue: c.issue,
          instruction: c.instruction,
          action_type: c.action_type,
          target_content: c.target_content,
          decision_needed: c.decision_needed,
          conservative_action: c.conservative_action,
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
    // Match comment with id attribute for anchor text lookup
    const commentRegex = /<w:comment[^>]*w:id="(\d+)"[^>]*w:author="([^"]*)"[^>]*w:date="([^"]*)"[^>]*>([\s\S]*?)<\/w:comment>/g;
    const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    
    // Build a map of comment IDs to anchor text from document.xml
    const anchorTextMap: Record<string, string> = {};
    const documentXml = await zip.file('word/document.xml')?.async('string');
    
    if (documentXml) {
      // Extract text between commentRangeStart and commentRangeEnd for each comment ID
      // Pattern: find all text between <w:commentRangeStart w:id="X"/> and <w:commentRangeEnd w:id="X"/>
      const idRegex = /<w:commentRangeStart[^>]*w:id="(\d+)"[^>]*\/>/g;
      let idMatch;
      
      while ((idMatch = idRegex.exec(documentXml)) !== null) {
        const commentId = idMatch[1];
        const startPos = idMatch.index + idMatch[0].length;
        
        // Find the corresponding end tag
        const endPattern = new RegExp(`<w:commentRangeEnd[^>]*w:id="${commentId}"[^>]*/>`);
        const endMatch = endPattern.exec(documentXml.slice(startPos));
        
        if (endMatch) {
          const anchorXml = documentXml.slice(startPos, startPos + endMatch.index);
          
          // Extract text from anchor region
          let anchorText = '';
          let textMatch;
          const localTextRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
          while ((textMatch = localTextRegex.exec(anchorXml)) !== null) {
            anchorText += textMatch[1];
          }
          
          if (anchorText.trim()) {
            anchorTextMap[commentId] = anchorText.trim();
          }
        }
      }
      
      console.log(`Extracted anchor text for ${Object.keys(anchorTextMap).length} comments`);
    }
    
    let match;
    while ((match = commentRegex.exec(commentsXml)) !== null) {
      const commentId = match[1];
      const author = match[2];
      const date = match[3];
      const content = match[4];
      
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
          anchorText: anchorTextMap[commentId] || '',
        });
      }
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
          content: `You are an expert content reviewer. Analyze the following comments from a human reviewer.

For each comment, determine:
1. Category: One of "style", "accuracy", "tone", "structure", "messaging", or "general"
2. Severity: One of "critical", "major", "minor", or "suggestion"
3. The specific issue being pointed out
4. Action Type - this is CRITICAL:
   - "modify" - Change existing content (rephrasing, rewording)
   - "remove" - Delete content ENTIRELY (when reviewer says it's unnecessary, obvious, redundant, or asks "why include this?")
   - "add" - Add new content
   - "conditional" - Requires a decision/approval before action (e.g., "get approval", "if approved", "check with...")
   - "clarify" - Needs more context before applying
5. Target Content: The EXACT text/section from the original content that this comment applies to. Quote the specific sentences or paragraph.
6. A clear, specific instruction for how to fix it
7. If action_type is "conditional", note what decision is needed and what conservative action to take

CRITICAL DETECTION RULES FOR "REMOVE" ACTION:
- "Why should we say that?" → action_type: "remove"
- "Why is this here?" → action_type: "remove"
- "This is obvious" → action_type: "remove"
- "The obvious" → action_type: "remove"
- "Unnecessary" or "redundant" → action_type: "remove"
- "People already know this" → action_type: "remove"
- "Readers understand this" → action_type: "remove"
- "We are already there" → action_type: "remove" (implies content states the obvious)
- "Looking ahead" or "Next steps" sections that describe what the product already does → action_type: "remove"
- If reviewer implies the product ALREADY HAS what the content describes as PLANNED → action_type: "remove"

CRITICAL DETECTION RULES FOR "CONDITIONAL" ACTION:
- Asks for "approval" or mentions needing to "check" → action_type: "conditional"
- Wants to add a name, customer, or detail pending approval → action_type: "conditional"
- For conditional comments, conservative_action should usually be to REMOVE the uncertain content

Return a JSON array of analyzed comments.`
        },
        {
          role: 'user',
          content: `Content being reviewed:
---
${content.slice(0, 6000)}
---

Comments from human reviewer:
${comments.map((c, i) => `${i + 1}. Comment: "${c.commentText}" (by ${c.author})
   Attached to text: "${c.anchorText || 'Not specified - identify from context'}"`).join('\n\n')}`
        }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'categorize_comments',
          description: 'Categorize and analyze reviewer comments with action types',
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
                    action_type: { 
                      type: 'string', 
                      enum: ['modify', 'remove', 'add', 'conditional', 'clarify'],
                      description: 'The type of action needed: modify (change), remove (delete entirely), add (insert new), conditional (needs approval), clarify (needs context)'
                    },
                    target_content: { 
                      type: 'string', 
                      description: 'The EXACT text/section from the content that this comment applies to. Quote the specific sentences or entire paragraph that should be modified/removed.'
                    },
                    instruction: { type: 'string', description: 'How to fix this issue' },
                    decision_needed: { type: 'string', description: 'For conditional comments: what decision/approval is needed' },
                    conservative_action: { type: 'string', description: 'For conditional comments: what to do if approval cannot be obtained (usually remove)' },
                  },
                  required: ['index', 'category', 'severity', 'issue', 'action_type', 'target_content', 'instruction'],
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
    action_type: ac.action_type || 'modify',
    target_content: ac.target_content || '',
    decision_needed: ac.decision_needed,
    conservative_action: ac.conservative_action,
  }));
}

async function reviseContent(
  apiKey: string,
  content: string,
  processedComments: ProcessedComment[]
): Promise<string> {
  // Format comments with action types and target content for precise revision
  const formattedFeedback = processedComments.map((c, i) => {
    let feedbackLine = `${i + 1}. [${c.severity.toUpperCase()}] [ACTION: ${c.action_type.toUpperCase()}] ${c.category}
   Target content: "${c.target_content}"
   Issue: ${c.issue}
   Instruction: ${c.instruction}`;
    
    if (c.action_type === 'conditional' && c.conservative_action) {
      feedbackLine += `\n   Conservative action (since approval not possible): ${c.conservative_action}`;
    }
    
    if (c.action_type === 'remove') {
      feedbackLine += `\n   >>> DELETE THE ABOVE TARGET CONTENT ENTIRELY <<<`;
    }
    
    return feedbackLine;
  }).join('\n\n');

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

CRITICAL RULES FOR EACH ACTION TYPE:

1. For "REMOVE" actions: 
   - Find the EXACT "Target content" quoted in the feedback
   - DELETE that content ENTIRELY from the document
   - Do NOT rephrase, soften, or keep parts of it
   - If the target is a paragraph or section, remove the ENTIRE paragraph/section
   - If removing creates awkward flow, adjust surrounding transitions minimally

2. For "MODIFY" actions: Make targeted changes to the specified target content while preserving structure.

3. For "ADD" actions: Insert new content at the appropriate location.

4. For "CONDITIONAL" actions: Take the CONSERVATIVE action provided. Since we cannot get approval in this automated process, if the conservative action says to remove, then REMOVE the content entirely.

5. For "CLARIFY" actions: Make your best judgment based on context.

SECTION REMOVAL RULES:
- When target content is a "Looking ahead" or "Next Steps" paragraph → DELETE THE ENTIRE SECTION
- When target content describes future plans that already exist as features → DELETE ENTIRELY  
- When a heading has no content remaining after removal → DELETE the heading too
- After removing sections, ensure remaining content flows logically

INTERPRETATION GUIDE - THESE ALL MEAN "REMOVE":
- "Why should we say that?" = REMOVE that content
- "This is obvious" = REMOVE that content
- "The obvious" = REMOVE that content
- "Readers already know this" = REMOVE that content
- "Unnecessary" = REMOVE that content
- "We are already there" = REMOVE that content (product already has this capability)
- "Get quote approval" without approval = REMOVE the quote
- "Add customer name if approved" without approval = REMOVE the reference

BE DECISIVE. When feedback says to remove, remove completely. Don't soften or rephrase - DELETE.

Preserve:
- Overall voice and tone (for content that stays)
- Embedded links and formatting
- Logical flow (adjust transitions after removals)

Word count WILL decrease when sections are removed - this is expected and correct.

IMPORTANT: Return ONLY the revised markdown content. No delimiters, no code blocks, no explanations. Start directly with the content.`
        },
        {
          role: 'user',
          content: `Original content:

${content}

Reviewer feedback to apply:

${formattedFeedback}`
        }
      ],
    }),
  });

  const data = await response.json();
  let revisedContent = data.choices?.[0]?.message?.content || content;
  
  // Strip any leading --- or code block markers GPT might add
  revisedContent = revisedContent.replace(/^[\s]*---[\s]*\n/, '');
  revisedContent = revisedContent.replace(/^[\s]*```(?:markdown|md)?\s*\n/, '');
  revisedContent = revisedContent.replace(/\n```[\s]*$/, '');
  
  return revisedContent;
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
