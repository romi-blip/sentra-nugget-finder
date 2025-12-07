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
  isTrackedChange?: boolean;
  changeType?: 'insertion' | 'deletion';
}

interface ProcessedComment {
  original: ExtractedComment;
  category: string;
  severity: string;
  issue: string;
  instruction: string;
  action_type: 'modify' | 'remove' | 'add' | 'conditional' | 'clarify';
  target_content: string;
  replacement_term?: string;  // Exact term from reviewer to use
  replacement_link?: string;  // Replacement link for "find better link" comments
  decision_needed?: string;
  conservative_action?: string;
}

interface TrackedChange {
  type: 'insertion' | 'deletion';
  author: string;
  date: string;
  text: string;
  precedingText: string;    // Text immediately before the insertion/deletion point
  followingText: string;    // Text immediately after the insertion/deletion point
  originalPhrase: string;   // What the content currently says (without the change)
  newPhrase: string;        // What it should say (with the change applied)
}

interface FeedbackPattern {
  feedback_type: string;
  feedback_pattern: string;
  feedback_instruction: string;
  priority: string;
}

// Sentra link fallbacks for "find better link" comments
const SENTRA_LINK_FALLBACKS: Record<string, string> = {
  'genai': 'https://www.sentra.io/use-cases/secure-ai-agents',
  'ai': 'https://www.sentra.io/use-cases/secure-ai-agents',
  'governance': 'https://www.sentra.io/use-cases/secure-ai-agents',
  'dspm': 'https://www.sentra.io/platform/dspm',
  'data security': 'https://www.sentra.io/platform/dspm',
  'detection': 'https://www.sentra.io/platform/data-detection-and-response',
  'ddr': 'https://www.sentra.io/platform/data-detection-and-response',
  'response': 'https://www.sentra.io/platform/data-detection-and-response',
  'compliance': 'https://www.sentra.io/use-cases/regulatory-compliance',
  'regulatory': 'https://www.sentra.io/use-cases/regulatory-compliance',
  'classification': 'https://www.sentra.io/platform/data-discovery-and-classification',
  'discovery': 'https://www.sentra.io/platform/data-discovery-and-classification',
  'cloud': 'https://www.sentra.io/platform/cloud-native-data-security',
  'multi-cloud': 'https://www.sentra.io/platform/cloud-native-data-security',
  'jagger': 'https://www.sentra.io/use-cases/secure-ai-agents',
  'default': 'https://www.sentra.io',
};

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

    // Extract tracked changes (insertions/deletions) from DOCX
    const trackedChanges = await extractTrackedChanges(bytes);
    console.log(`Extracted ${trackedChanges.length} tracked changes from DOCX`);

    // Convert tracked changes to comment format with explicit FIND/REPLACE instructions
    const trackedChangeComments: ExtractedComment[] = trackedChanges.map(change => {
      if (change.type === 'insertion') {
        // For insertions: provide explicit before → after transformation
        return {
          author: change.author,
          date: change.date,
          commentText: `[TRACKED INSERTION] FIND: "${change.originalPhrase}" → REPLACE WITH: "${change.newPhrase}"`,
          anchorText: change.originalPhrase,
          isTrackedChange: true,
          changeType: change.type,
        };
      } else {
        // For deletions: explicit text to remove
        return {
          author: change.author,
          date: change.date,
          commentText: `[TRACKED DELETION] DELETE THIS TEXT: "${change.text}"`,
          anchorText: change.text,
          isTrackedChange: true,
          changeType: change.type,
        };
      }
    });

    // Combine comments and tracked changes
    const allFeedback = [...comments, ...trackedChangeComments];

    if (allFeedback.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No comments or tracked changes found in the uploaded document',
        message: 'Please ensure the Word document contains reviewer comments or tracked changes'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Total feedback items (comments + tracked changes): ${allFeedback.length}`);

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Analyze comments with GPT
    const processedComments = await analyzeComments(openaiApiKey, allFeedback, contentItem.content);
    console.log(`Analyzed ${processedComments.length} feedback items`);

    // Revise content based on comments
    let revisedContent = await reviseContent(openaiApiKey, contentItem.content, processedComments);
    console.log('Content revised based on feedback');

    // Humanize the revised content to remove AI patterns
    revisedContent = await humanizeContent(openaiApiKey, revisedContent);
    console.log('Content humanized');

    // Programmatic cleanup for patterns GPT might miss (like em dashes)
    revisedContent = removeEmDashes(revisedContent);
    console.log('Em dashes removed programmatically');

    // Extract patterns for reviewer agent (only from regular comments, not tracked changes)
    const regularComments = processedComments.filter(c => !c.original.isTrackedChange);
    const patterns = await extractPatterns(openaiApiKey, regularComments);
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
        review_summary: `DOCX review processed: ${comments.length} comments, ${trackedChanges.length} tracked changes, ${patternsCreated} patterns added`,
        human_feedback: allFeedback.map(c => c.commentText).join('\n\n'),
        feedback_applied: true,
      });

    return new Response(JSON.stringify({
      success: true,
      commentsProcessed: comments.length,
      trackedChangesProcessed: trackedChanges.length,
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
          replacement_term: c.replacement_term,
          replacement_link: c.replacement_link,
          decision_needed: c.decision_needed,
          conservative_action: c.conservative_action,
          isTrackedChange: c.original.isTrackedChange,
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

async function extractTrackedChanges(fileBytes: Uint8Array): Promise<TrackedChange[]> {
  const changes: TrackedChange[] = [];
  
  try {
    const zip = await JSZip.loadAsync(fileBytes);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    
    if (!documentXml) {
      console.log('No document.xml found in DOCX');
      return changes;
    }

    // Helper to extract text from XML fragment
    const extractText = (xml: string): string => {
      let text = '';
      const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let match;
      while ((match = textRegex.exec(xml)) !== null) {
        text += match[1];
      }
      return text;
    };

    // Helper to extract text from deletions
    const extractDeletedText = (xml: string): string => {
      let text = '';
      const delTextRegex = /<w:delText[^>]*>([^<]*)<\/w:delText>/g;
      let match;
      while ((match = delTextRegex.exec(xml)) !== null) {
        text += match[1];
      }
      // Also check regular w:t
      const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      while ((match = textRegex.exec(xml)) !== null) {
        text += match[1];
      }
      return text;
    };

    // Extract insertions with surrounding context for find-and-replace
    const insertionRegex = /<w:ins\s+([^>]*)>([\s\S]*?)<\/w:ins>/g;
    let match;
    
    while ((match = insertionRegex.exec(documentXml)) !== null) {
      const attributes = match[1];
      const content = match[2];
      
      const authorMatch = attributes.match(/w:author="([^"]*)"/);
      const dateMatch = attributes.match(/w:date="([^"]*)"/);
      
      const insertedText = extractText(content).trim();
      
      if (insertedText) {
        // Get preceding text (look back up to 150 chars of XML, extract text)
        const precedingXml = documentXml.slice(Math.max(0, match.index - 500), match.index);
        // Get text from preceding XML, take last ~50 chars
        let precedingTextAll = extractText(precedingXml);
        const precedingText = precedingTextAll.slice(-50).trim();
        
        // Get following text (look ahead up to 150 chars of XML, extract text)
        const followingXml = documentXml.slice(match.index + match[0].length, match.index + match[0].length + 500);
        let followingTextAll = extractText(followingXml);
        const followingText = followingTextAll.slice(0, 50).trim();
        
        // Build original phrase (what the doc currently says without the insertion)
        const originalPhrase = (precedingText + ' ' + followingText).trim();
        // Build new phrase (what it should say with the insertion)
        const newPhrase = (precedingText + insertedText + followingText).trim();
        
        changes.push({
          type: 'insertion',
          author: authorMatch ? authorMatch[1] : 'Unknown',
          date: dateMatch ? dateMatch[1] : '',
          text: insertedText,
          precedingText,
          followingText,
          originalPhrase,
          newPhrase,
        });
        
        console.log(`  Tracked insertion: "${insertedText}"`);
        console.log(`    Preceding: "${precedingText}"`);
        console.log(`    Following: "${followingText}"`);
        console.log(`    Original phrase: "${originalPhrase}"`);
        console.log(`    New phrase: "${newPhrase}"`);
      }
    }
    
    // Extract deletions
    const deletionRegex = /<w:del\s+([^>]*)>([\s\S]*?)<\/w:del>/g;
    
    while ((match = deletionRegex.exec(documentXml)) !== null) {
      const attributes = match[1];
      const content = match[2];
      
      const authorMatch = attributes.match(/w:author="([^"]*)"/);
      const dateMatch = attributes.match(/w:date="([^"]*)"/);
      
      const deletedText = extractDeletedText(content).trim();
      
      if (deletedText) {
        changes.push({
          type: 'deletion',
          author: authorMatch ? authorMatch[1] : 'Unknown',
          date: dateMatch ? dateMatch[1] : '',
          text: deletedText,
          precedingText: '',
          followingText: '',
          originalPhrase: deletedText,
          newPhrase: '',
        });
        
        console.log(`  Tracked deletion: "${deletedText}"`);
      }
    }

    console.log(`Successfully parsed ${changes.length} tracked changes from document.xml`);

  } catch (error) {
    console.error('Error extracting tracked changes:', error);
  }

  return changes;
}

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

    // Parse comments using regex - handle attribute order variations
    // Comments may have attributes in any order: w:id, w:author, w:date, w:initials
    const commentTagRegex = /<w:comment\s+([^>]*)>([\s\S]*?)<\/w:comment>/g;
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
    while ((match = commentTagRegex.exec(commentsXml)) !== null) {
      const attributes = match[1];
      const content = match[2];
      
      // Extract attributes individually (handles any order)
      const idMatch = attributes.match(/w:id="(\d+)"/);
      const authorMatch = attributes.match(/w:author="([^"]*)"/);
      const dateMatch = attributes.match(/w:date="([^"]*)"/);
      
      const commentId = idMatch ? idMatch[1] : '';
      const author = authorMatch ? authorMatch[1] : 'Unknown';
      const date = dateMatch ? dateMatch[1] : '';
      
      // Extract text from comment content
      let commentText = '';
      let textMatch;
      const localTextRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      while ((textMatch = localTextRegex.exec(content)) !== null) {
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

    console.log(`Successfully parsed ${comments.length} comments from comments.xml`);

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
          content: `You are an expert content reviewer. Analyze the following comments and tracked changes from a human reviewer.

For each item, determine:
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
6. Replacement Term: If the reviewer suggests a SPECIFIC replacement term, capture it EXACTLY
7. Replacement Link: If the comment is about finding a better link, suggest an appropriate Sentra link
8. A clear, specific instruction for how to fix it
9. If action_type is "conditional", note what decision is needed and what conservative action to take

=== TRACKED CHANGES AS FIND-REPLACE (MANDATORY) ===
When you see [TRACKED INSERTION] with "FIND: X → REPLACE WITH: Y":
- action_type: "modify" (NOT "add" - this is a text substitution)
- severity: "critical" - MUST be applied exactly as written
- target_content: The FIND phrase (X) - this is what to locate in the document
- replacement_term: The REPLACE WITH phrase (Y) - this is the complete replacement
- This is a LITERAL string replacement - find X and replace with Y exactly
- These edits take priority over regular comments

When you see [TRACKED DELETION] with "DELETE THIS TEXT: X":
- action_type: "remove", severity: "critical"
- target_content: The exact text X that must be removed
- These edits MUST be applied exactly as written

=== LINK REPLACEMENT RULES ===
When a reviewer asks to "find a better link" or says a link is wrong:
1. If about GenAI/AI/Jagger → replacement_link: "https://www.sentra.io/use-cases/secure-ai-agents"
2. If about DSPM/data security → replacement_link: "https://www.sentra.io/platform/dspm"
3. If about detection/DDR → replacement_link: "https://www.sentra.io/platform/data-detection-and-response"
4. If about compliance/regulatory → replacement_link: "https://www.sentra.io/use-cases/regulatory-compliance"
5. If about classification/discovery → replacement_link: "https://www.sentra.io/platform/data-discovery-and-classification"
6. If no clear category → replacement_link: "https://www.sentra.io" and flag for review
7. NEVER just remove a link without either replacing it or flagging for review

=== CONSERVATIVE EDITING RULES ===
- ONLY modify/remove content that has an EXPLICIT comment or tracked change attached
- Do NOT proactively remove content you think might be problematic
- If content lists third-party companies and there's no comment about them, KEEP them
- When in doubt, PRESERVE original content
- Only act on what the reviewer explicitly flagged

=== EXACT TERM EXTRACTION ===
When a reviewer suggests specific wording, CAPTURE their exact suggested term:
- "say X instead of Y" → replacement_term: "X" (use X exactly, not a synonym)
- "don't say live, say monitoring or continuously monitoring" → replacement_term: "continuous monitoring" (NOT "real-time" which means the same as "live")
- "add classification" or "include X" → replacement_term includes the exact term
- NEVER substitute synonyms for the reviewer's exact words

=== REMOVE ACTION TRIGGERS ===
- "Why should we say that?" → action_type: "remove"
- "This is obvious" → action_type: "remove"
- "Unnecessary" or "redundant" → action_type: "remove"
- "We are already there" → action_type: "remove"
- [TRACKED DELETION] → action_type: "remove" (MANDATORY)

Return a JSON array of analyzed comments.`
        },
        {
          role: 'user',
          content: `Content being reviewed:
---
${content.slice(0, 6000)}
---

Comments and tracked changes from human reviewer:
${comments.map((c, i) => `${i + 1}. ${c.isTrackedChange ? '[TRACKED CHANGE] ' : ''}Comment: "${c.commentText}" (by ${c.author})
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
                    replacement_term: {
                      type: 'string',
                      description: 'If reviewer suggests specific wording or tracked insertion, capture the EXACT term'
                    },
                    replacement_link: {
                      type: 'string',
                      description: 'For "find better link" comments, the appropriate Sentra URL to use'
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
    replacement_term: ac.replacement_term,
    replacement_link: ac.replacement_link,
    decision_needed: ac.decision_needed,
    conservative_action: ac.conservative_action,
  }));
}

async function reviseContent(
  apiKey: string,
  content: string,
  processedComments: ProcessedComment[]
): Promise<string> {
  // Format comments with action types, target content, and replacement terms for precise revision
  const formattedFeedback = processedComments.map((c, i) => {
    const isTrackedChange = c.original.isTrackedChange;
    let feedbackLine = `${i + 1}. [${c.severity.toUpperCase()}] [ACTION: ${c.action_type.toUpperCase()}]${isTrackedChange ? ' [TRACKED CHANGE - MANDATORY]' : ''} ${c.category}
   Target content: "${c.target_content}"
   Issue: ${c.issue}
   Instruction: ${c.instruction}`;
    
    // Include the exact replacement term if provided
    if (c.replacement_term) {
      feedbackLine += `\n   >>> USE EXACT TERM: "${c.replacement_term}" <<< (Do NOT use synonyms - use this term exactly as written)`;
    }
    
    // Include replacement link if provided
    if (c.replacement_link) {
      feedbackLine += `\n   >>> USE THIS LINK: ${c.replacement_link} <<<`;
    }
    
    if (c.action_type === 'conditional' && c.conservative_action) {
      feedbackLine += `\n   Conservative action (since approval not possible): ${c.conservative_action}`;
    }
    
    if (c.action_type === 'remove') {
      feedbackLine += `\n   >>> DELETE THE ABOVE TARGET CONTENT ENTIRELY <<<`;
    }
    
    if (c.action_type === 'add' && isTrackedChange) {
      feedbackLine += `\n   >>> INSERT THIS TEXT EXACTLY: "${c.replacement_term}" <<<`;
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

=== TRACKED CHANGES ARE MANDATORY STRING REPLACEMENTS ===
Items marked [TRACKED CHANGE - MANDATORY] are direct edits the reviewer made. Apply them as LITERAL string replacements:
- When feedback contains FIND/REPLACE format: Locate the exact FIND text and replace it with the exact REPLACE WITH text
- This is a direct string substitution - no interpretation needed
- Example: If feedback says FIND "cloud and SaaS" → REPLACE WITH "cloud, on-prem, and SaaS"
  You must find "cloud and SaaS" in the content and replace it with "cloud, on-prem, and SaaS"
- [ACTION: REMOVE] with [TRACKED CHANGE] → DELETE the exact text from the content
- These are NOT suggestions - they are edits the reviewer already made in Word

=== CRITICAL RULES FOR EACH ACTION TYPE ===

1. For "REMOVE" actions: 
   - Find the EXACT "Target content" quoted in the feedback
   - DELETE that content ENTIRELY from the document
   - Do NOT rephrase, soften, or keep parts of it
   - If the target is a paragraph or section, remove the ENTIRE paragraph/section
   - If removing creates awkward flow, adjust surrounding transitions minimally

2. For "MODIFY" actions: Make targeted changes to the specified target content while preserving structure.

3. For "ADD" actions: Insert new content at the appropriate location. For tracked insertions, use the EXACT text provided.

4. For "CONDITIONAL" actions: Take the CONSERVATIVE action provided. Since we cannot get approval in this automated process, if the conservative action says to remove, then REMOVE the content entirely.

5. For "CLARIFY" actions: Make your best judgment based on context.

=== LINK REPLACEMENT ===
When feedback includes ">>> USE THIS LINK: [url] <<<", replace the existing link with that URL.

=== CONSERVATIVE EDITING ===
- ONLY modify content that has explicit feedback attached
- Do NOT make additional changes beyond what's explicitly requested
- If content mentions third-party companies without a comment about them, KEEP those mentions
- Preserve content that wasn't flagged by the reviewer

=== SECTION REMOVAL RULES ===
- When target content is a "Looking ahead" or "Next Steps" paragraph → DELETE THE ENTIRE SECTION
- When target content describes future plans that already exist as features → DELETE ENTIRELY  
- When a heading has no content remaining after removal → DELETE the heading too
- After removing sections, ensure remaining content flows logically

BE DECISIVE. When feedback says to remove, remove completely. Don't soften or rephrase - DELETE.
When feedback provides exact replacement text, use it EXACTLY - no synonyms or rewording.

Preserve:
- Overall voice and tone (for content that stays)
- Embedded links and formatting (unless specifically flagged for replacement)
- Logical flow (adjust transitions after removals)

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

async function humanizeContent(apiKey: string, content: string): Promise<string> {
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
- PRESERVE ALL MARKDOWN LINKS [text](url) exactly as they are
- Do NOT make any content changes beyond humanization
- Do NOT remove or modify third-party company names
- Output ONLY the revised content, nothing else

**Content to humanize:**
${content}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: 'You are an expert editor. You humanize AI content while preserving exact markdown structure and all links. Do not make content changes beyond humanization. Output only the edited content with no commentary.' },
          { role: 'user', content: humanizationPrompt }
        ],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      console.warn('Humanization failed, returning content as-is');
      return content;
    }

    const data = await response.json();
    let humanized = data.choices?.[0]?.message?.content || content;
    
    // Strip any leading --- or code block markers
    humanized = humanized.replace(/^[\s]*---[\s]*\n/, '');
    humanized = humanized.replace(/^[\s]*```(?:markdown|md)?\s*\n/, '');
    humanized = humanized.replace(/\n```[\s]*$/, '');
    
    return humanized;
  } catch (error) {
    console.warn('Humanization error:', error);
    return content;
  }
}

// Programmatically remove em dashes that GPT might miss
function removeEmDashes(content: string): string {
  // Replace em dashes (—) with appropriate alternatives
  // Pattern: word — word → word, word (most common case)
  let cleaned = content;
  
  // Em dash surrounded by spaces → comma with single space
  cleaned = cleaned.replace(/ — /g, ', ');
  
  // Em dash at start of clause → comma
  cleaned = cleaned.replace(/— /g, ', ');
  
  // Em dash at end of word → comma
  cleaned = cleaned.replace(/ —/g, ',');
  
  // Any remaining standalone em dashes → comma
  cleaned = cleaned.replace(/—/g, ', ');
  
  // Also handle en dashes (–) which are sometimes used similarly
  cleaned = cleaned.replace(/ – /g, ', ');
  cleaned = cleaned.replace(/– /g, ', ');
  cleaned = cleaned.replace(/ –/g, ',');
  cleaned = cleaned.replace(/–/g, ', ');
  
  // Clean up double spaces
  cleaned = cleaned.replace(/  +/g, ' ');
  
  // Clean up ", ," patterns
  cleaned = cleaned.replace(/, ,/g, ',');
  
  // Clean up ",," patterns
  cleaned = cleaned.replace(/,,/g, ',');
  
  return cleaned;
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
