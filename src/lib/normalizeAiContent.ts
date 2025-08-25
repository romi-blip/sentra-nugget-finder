/**
 * Robust AI content normalization utility
 * Handles various n8n response formats including HTML, code fences, and malformed wrappers
 */

export const normalizeAiContent = (content: string): string => {
  let cleanedContent = content;

  // Step 1: Extract and decode iframe srcdoc content (if present)
  if (cleanedContent.includes('<iframe') && cleanedContent.includes('srcdoc=')) {
    try {
      const doc = new DOMParser().parseFromString(cleanedContent, 'text/html');
      const iframe = doc.querySelector('iframe');
      
      if (iframe) {
        let srcdoc = iframe.getAttribute('srcdoc');
        if (srcdoc) {
          // Decode HTML entities
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = srcdoc;
          cleanedContent = tempDiv.textContent || tempDiv.innerText || cleanedContent;
        }
      }
    } catch (e) {
      console.warn("Failed to parse iframe content:", e);
    }
  }

  // Step 2: Strip any remaining iframe/style/script tags
  cleanedContent = cleanedContent
    .replace(/<iframe[^>]*>/gi, '')
    .replace(/<\/iframe>/gi, '')
    .replace(/srcdoc="[^"]*"/gi, '')
    .replace(/sandbox="[^"]*"/gi, '')
    .replace(/style="[^"]*"/gi, '')
    .replace(/allowtransparency="[^"]*"/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Step 3: Unwrap <pre><code>…</code></pre> HTML wrappers
  cleanedContent = cleanedContent.replace(
    /<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (match, code) => {
      // Decode HTML entities in the code block
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = code;
      return tempDiv.textContent || tempDiv.innerText || code;
    }
  );

  // Step 4: Strip markdown-labeled code fences anywhere in the content
  // This handles cases where AI responses include ```markdown blocks that should be unwrapped
  cleanedContent = cleanedContent.replace(
    /```(?:markdown|md|text|plain)?\s*\n?([\s\S]*?)\n?```/gi,
    (match, content) => content
  );

  // Also handle ~~~ fences with markdown labels
  cleanedContent = cleanedContent.replace(
    /~~~(?:markdown|md|text|plain)?\s*\n?([\s\S]*?)\n?~~~/gi,
    (match, content) => content
  );

  // Step 5: Aggressively remove code fences only when they wrap the entire content
  // Handle extra whitespace, language labels, and ~~~ fences
  const fencePattern = /^[\s\u200B\uFEFF]*(?:```|~~~)([^\n]*)\n?([\s\S]*?)\n?(?:```|~~~)[\s\u200B\uFEFF]*$/;
  const fenceMatch = cleanedContent.match(fencePattern);
  
  if (fenceMatch) {
    const [, language, fenceContent] = fenceMatch;
    // Only unwrap if it's markdown or no language specified, or if language suggests it's wrapper content
    if (!language || language.toLowerCase().includes('markdown') || language.toLowerCase().includes('text')) {
      cleanedContent = fenceContent;
    }
  }

  // Step 6: Dedent 4-space/tab-indented blocks if they cover most lines
  const lines = cleanedContent.split('\n');
  const nonEmptyLines = lines.filter(line => line.trim().length > 0);
  
  if (nonEmptyLines.length > 0) {
    // Find minimum leading whitespace
    const leadingSpaces = nonEmptyLines.map(line => {
      const match = line.match(/^(\s*)/);
      return match ? match[1].length : 0;
    });
    
    const minIndent = Math.min(...leadingSpaces);
    
    // If most lines are indented by 4+ spaces or tabs, dedent uniformly
    if (minIndent >= 4 || cleanedContent.includes('\t')) {
      cleanedContent = lines.map(line => {
        if (line.trim().length === 0) return line;
        return line.slice(minIndent);
      }).join('\n');
    }
  }

  // Step 7: Convert simple HTML to markdown-ish text
  cleanedContent = cleanedContent
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ''); // Remove any remaining HTML tags

  // Step 8: Decode HTML entities
  cleanedContent = cleanedContent
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—');

  // Step 9: Normalize bullets like • or – to "- "
  cleanedContent = cleanedContent
    .replace(/^[\s]*[•–]/gm, '- ')
    .replace(/\n[\s]*[•–]/g, '\n- ');

  // Step 10: Remove zero-width characters and normalize whitespace
  cleanedContent = cleanedContent
    .replace(/[\u200B\uFEFF]/g, '') // Remove zero-width spaces
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple blank lines to maximum 2
    .trim();

  return cleanedContent;
};

/**
 * Extract content from various response formats
 */
export const extractResponseContent = (data: any): string => {
  if (typeof data === 'string') {
    return data;
  }
  
  if (data && typeof data === 'object') {
    // Try multiple possible response fields
    return data.content || 
           data.output || 
           data.message || 
           data.response ||
           data.text ||
           JSON.stringify(data, null, 2);
  }
  
  if (Array.isArray(data)) {
    // Handle array responses - join or take first element
    if (data.length === 0) return "Empty response received.";
    if (data.length === 1) return extractResponseContent(data[0]);
    return data.map(item => extractResponseContent(item)).join('\n');
  }
  
  return "Unable to extract content from response.";
};