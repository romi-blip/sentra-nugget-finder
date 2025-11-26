/**
 * Simplified AI content normalization utility
 * Only performs safe transformations that cannot break valid markdown
 */

export const normalizeAiContent = (content: string): string => {
  let cleanedContent = content;

  // 1. Strip YAML frontmatter (--- blocks at beginning)
  cleanedContent = cleanedContent.replace(
    /^[\s]*```(?:markdown|md)?\s*\n---[\s\S]*?---\s*\n```[\s]*/m,
    ''
  );
  cleanedContent = cleanedContent.replace(
    /^[\s]*---[\s\S]*?---[\s]*/m,
    ''
  );
  
  // 2. Strip standalone metadata lines at the beginning
  cleanedContent = cleanedContent.replace(
    /^[\s]*(title|meta_description|meta|keywords|description):\s*[^\n]+\n/gim,
    ''
  );

  // 3. Strip code fence wrappers ONLY if they wrap the entire content
  const fenceMatch = cleanedContent.trim().match(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/);
  if (fenceMatch) {
    cleanedContent = fenceMatch[1];
  }

  // 4. Decode HTML entities
  cleanedContent = cleanedContent
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // 5. Decode literal escape sequences (from JSON encoding)
  cleanedContent = cleanedContent
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r');

  // 6. Normalize line endings and collapse excessive blank lines
  cleanedContent = cleanedContent
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')  // Max 2 blank lines
    .trim();

  return cleanedContent;
};

/**
 * Extract content from various response formats
 */
export const extractResponseContent = (data: any): string => {
  // Handle string inputs - try to parse as JSON first
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(data);
        return extractResponseContent(parsed);
      } catch (e) {
        return data;
      }
    }
    return data;
  }
  
  // Check for arrays first
  if (Array.isArray(data)) {
    if (data.length === 0) return "Empty response received.";
    
    const contents = data.map(item => extractResponseContent(item)).filter(content => content && content.trim());
    
    const uniqueContents = contents.filter((content, index) => {
      return contents.findIndex(c => 
        c === content || 
        (c.length > 100 && content.length > 100 && c.substring(0, 100) === content.substring(0, 100))
      ) === index;
    });
    
    if (uniqueContents.length === 0) return "No valid content found in array.";
    if (uniqueContents.length === 1) return uniqueContents[0];
    
    return uniqueContents.join('\n\n---\n\n');
  }
  
  if (data && typeof data === 'object') {
    const deepExtract = (obj: any, visited = new Set()): string | null => {
      if (!obj || typeof obj !== 'object' || visited.has(obj)) return null;
      visited.add(obj);
      
      const contentFields = ['content', 'output', 'message', 'response', 'text'];
      for (const field of contentFields) {
        if (obj[field] && typeof obj[field] === 'string' && obj[field].trim()) {
          return obj[field];
        }
      }
      
      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object') {
          const found = deepExtract(value, visited);
          if (found) return found;
        }
      }
      
      return null;
    };
    
    const extracted = deepExtract(data);
    if (extracted) return extracted;
    
    return JSON.stringify(data, null, 2);
  }
  
  return "Unable to extract content from response.";
};
