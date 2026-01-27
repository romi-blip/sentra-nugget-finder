
## Plan: Add AI-Powered Content Structuring with Complete Element Support

### Problem Summary

The user wants to add an AI agent stage that structures document content correctly without altering the text. The AI must understand how to identify and properly tag all document elements:
- **Headings** (h1, h2, h3)
- **Paragraphs**
- **Bullet lists** (unordered)
- **Numbered lists** (ordered)
- **Tables** (with rows and cells)
- **Images** (with captions)
- **Feature grids** (title + description pairs)
- **Page breaks**

### Current Section Types Supported

The edge function currently supports these section types:

| Type | Description | Data Structure |
|------|-------------|----------------|
| `h1` | Main section heading | `{ type: 'h1', content: 'text' }` |
| `h2` | Subsection heading | `{ type: 'h2', content: 'text' }` |
| `h3` | Sub-subsection heading | `{ type: 'h3', content: 'text' }` |
| `paragraph` | Body text | `{ type: 'paragraph', content: 'text' }` |
| `bullet-list` | Unordered list | `{ type: 'bullet-list', items: ['a', 'b'] }` |
| `table` | Data table | `{ type: 'table', tableData: { rows: [['a', 'b'], ['c', 'd']] } }` |
| `image` | Embedded image | `{ type: 'image', imageBase64: '...', imageMimeType: '...' }` |
| `feature-grid` | Feature cards | `{ type: 'feature-grid', features: [{title, description}] }` |
| `page-break` | Force new page | `{ type: 'page-break' }` |

### Missing Element Type

The system is missing support for **numbered lists** (ordered lists like "1. Item", "a. Item"). This needs to be added.

---

### Solution Overview

1. **Add numbered-list type** to the section schema
2. **Create AI structuring function** in the edge function that:
   - Receives raw extracted text
   - Uses Lovable AI (Gemini) to analyze structure
   - Returns structured JSON with EXACT original text
3. **Update extraction logic** to preserve more raw content when AI mode is enabled
4. **Add UI toggle** to enable AI structuring

---

### Implementation Details

#### 1. Update Section Types

Add `numbered-list` to support ordered lists:

```typescript
interface StructuredSection {
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet-list' | 'numbered-list' | 'table' | 'feature-grid' | 'page-break' | 'image';
  content?: string;
  items?: string[];           // For bullet-list and numbered-list
  tableData?: { rows: string[][] };
  features?: Array<{ title: string; description: string }>;
  imageBase64?: string;
  imageMimeType?: string;
}
```

#### 2. AI System Prompt

The AI agent will use this comprehensive prompt to understand all element types:

```text
You are a document structure analyzer. Your ONLY job is to identify the structural hierarchy of a document.

ABSOLUTE RULES - VIOLATION MEANS FAILURE:
1. NEVER change, edit, paraphrase, correct spelling, or rewrite ANY text
2. Return the EXACT text as given - character for character, word for word
3. Only add structure metadata (heading levels, list detection, table identification)
4. If you're unsure whether something is a heading or paragraph, keep it as paragraph

ELEMENT TYPES YOU MUST IDENTIFY:

1. HEADINGS (identify by: larger font indicators, short lines, no ending punctuation)
   - h1: Main section titles (usually numbered like "1. Overview" or standalone major sections)
   - h2: Subsection titles (like "1.1 Details" or clearly subordinate sections)
   - h3: Sub-subsection titles (like "1.1.1 Specifics" or third-level headers)

2. PARAGRAPHS
   - Regular body text, usually multiple sentences
   - Ends with punctuation (period, question mark)
   - Keep long content blocks as single paragraphs - do NOT split them

3. BULLET LISTS (unordered)
   - Items starting with •, -, *, or similar markers
   - Return as: { "type": "bullet-list", "items": ["item 1 text", "item 2 text"] }
   - PRESERVE the exact text of each item

4. NUMBERED LISTS (ordered)
   - Items starting with numbers (1., 2.), letters (a., b.), or roman numerals (i., ii.)
   - Return as: { "type": "numbered-list", "items": ["first item text", "second item text"] }
   - Remove the number/letter prefix but keep all other text exactly

5. TABLES
   - Data arranged in rows and columns
   - Return as: { "type": "table", "tableData": { "rows": [["cell1", "cell2"], ["cell3", "cell4"]] } }
   - First row is typically the header
   - PRESERVE exact cell text

6. FEATURE GRIDS (optional - only if clear title:description pattern)
   - Pairs of short title with longer description
   - Return as: { "type": "feature-grid", "features": [{"title": "Feature Name", "description": "Description text"}] }

7. PAGE BREAKS
   - Only add if explicitly indicated in source
   - Return as: { "type": "page-break" }

OUTPUT FORMAT (JSON):
{
  "title": "Exact document title from content",
  "subtitle": "Category or subtitle if present",
  "sections": [
    { "type": "h1", "content": "EXACT heading text" },
    { "type": "paragraph", "content": "EXACT paragraph text..." },
    { "type": "bullet-list", "items": ["EXACT item 1", "EXACT item 2"] },
    { "type": "numbered-list", "items": ["EXACT item 1", "EXACT item 2"] },
    { "type": "table", "tableData": { "rows": [["EXACT cell", "EXACT cell"]] } }
  ]
}

CRITICAL REMINDERS:
- You are a STRUCTURE IDENTIFIER, not an editor
- Every word in your output MUST appear in the input
- If content appears in input, it MUST appear in output (no omissions)
- Do NOT add any text that wasn't in the original
```

#### 3. Edge Function Changes

| Function | Change |
|----------|--------|
| `extractRawDocxText()` | New function - minimal extraction preserving all text, tables, images |
| `callAiStructuring()` | New function - calls Lovable AI gateway with the system prompt |
| `renderNumberedList()` | New function - renders ordered lists with numbers in PDF |

#### 4. File Changes

| File | Change |
|------|--------|
| `supabase/functions/transform-document-design/index.ts` | Add AI structuring function, add `numbered-list` type, add render logic for numbered lists |
| `src/services/brandService.ts` | Add `useAiStructuring` option to `TransformOptions` |
| `src/components/brand/BulkDocumentList.tsx` | Add "AI Structure" toggle column |
| `src/pages/BrandDesigner.tsx` | Add toggle state and pass to service |

---

### AI Gateway Integration

Use the Lovable AI gateway with Gemini for fast, accurate structuring:

```typescript
async function callAiStructuring(rawText: string, tables: TableData[], images: ImageData[]): Promise<StructuredDocument> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: STRUCTURE_SYSTEM_PROMPT },
        { role: 'user', content: `Structure this document. Tables and images are provided separately.\n\nTEXT:\n${rawText}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,  // Low for consistency
    }),
  });
  
  const data = await response.json();
  const structured = JSON.parse(data.choices[0].message.content);
  
  // Re-attach tables and images that were extracted separately
  return mergeStructuredWithMedia(structured, tables, images);
}
```

---

### PDF Rendering for Numbered Lists

Add rendering logic parallel to bullet lists:

```typescript
// In content page generation
if (section.type === 'numbered-list' && section.items) {
  const style = getTextStyle('bullet');
  for (let i = 0; i < section.items.length; i++) {
    const itemText = `${i + 1}. ${section.items[i]}`;
    const lines = wrapText(itemText, fonts.medium, style.fontSize, contentWidth - indent);
    // ... draw each line
  }
}
```

---

### UI Changes

Add a simple toggle in the document upload section:

| Location | Change |
|----------|--------|
| Bulk Document List | Add "AI Structure" switch column (default: OFF) |
| Single Upload | Add "Use AI Structuring" checkbox before transform |

When enabled:
- Raw text extraction (minimal filtering)
- AI analyzes and returns structured JSON
- Tables/images merged back in
- PDF generated from AI-structured content

When disabled (default):
- Current regex-based extraction behavior
- Faster processing
- Works for most documents

---

### Expected Outcome

After implementation:
- Users can toggle "AI Structuring" for documents requiring exact content fidelity
- AI correctly identifies: h1, h2, h3, paragraphs, bullet lists, numbered lists, tables, images
- Character-for-character text preservation
- Side-by-side comparison will show identical content
- Fallback to regex extraction if AI fails (rate limit, timeout)

---

### Technical Notes

- Uses `LOVABLE_API_KEY` (already configured)
- Model: `google/gemini-3-flash-preview` for speed
- Temperature: 0.1 for deterministic output
- Response format: JSON object for reliable parsing
- Timeout handling with fallback to regex extraction
