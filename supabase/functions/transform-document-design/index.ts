import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { PDFDocument, rgb, StandardFonts, PDFName, PDFRawStream } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import { decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// Google Fonts CDN URLs for Poppins
const POPPINS_REGULAR_URL = "https://fonts.gstatic.com/s/poppins/v21/pxiEyp8kv8JHgFVrFJDUc1NECPY.ttf";
const POPPINS_MEDIUM_URL = "https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLGT9Z1xlEA.ttf";
const POPPINS_BOLD_URL = "https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLCz7Z1xlEA.ttf";

// Cache for fonts to avoid re-fetching
let cachedPoppinsRegular: Uint8Array | null = null;
let cachedPoppinsMedium: Uint8Array | null = null;
let cachedPoppinsBold: Uint8Array | null = null;

async function fetchPoppinsFonts(): Promise<{ regular: Uint8Array; medium: Uint8Array; bold: Uint8Array }> {
  if (cachedPoppinsRegular && cachedPoppinsMedium && cachedPoppinsBold) {
    console.log('[transform-document-design] Using cached Poppins fonts');
    return { regular: cachedPoppinsRegular, medium: cachedPoppinsMedium, bold: cachedPoppinsBold };
  }

  console.log('[transform-document-design] Fetching Poppins fonts from Google Fonts...');
  const [regularResponse, mediumResponse, boldResponse] = await Promise.all([
    fetch(POPPINS_REGULAR_URL),
    fetch(POPPINS_MEDIUM_URL),
    fetch(POPPINS_BOLD_URL),
  ]);

  if (!regularResponse.ok || !mediumResponse.ok || !boldResponse.ok) {
    throw new Error('Failed to fetch Poppins fonts from Google Fonts');
  }

  cachedPoppinsRegular = new Uint8Array(await regularResponse.arrayBuffer());
  cachedPoppinsMedium = new Uint8Array(await mediumResponse.arrayBuffer());
  cachedPoppinsBold = new Uint8Array(await boldResponse.arrayBuffer());
  
  console.log('[transform-document-design] Poppins fonts fetched successfully');
  return { regular: cachedPoppinsRegular, medium: cachedPoppinsMedium, bold: cachedPoppinsBold };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Memory limits for images
const MAX_IMAGE_SIZE = 500 * 1024; // 500KB per image
const MAX_TOTAL_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB total
const MAX_COVER_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB max for cover background (increased for optimized images)

// Fast base64 to Uint8Array conversion using Deno's built-in decoder
function fastBase64ToBytes(base64: string): Uint8Array {
  // Remove data URL prefix if present
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  return decodeBase64(cleanBase64);
}

// Fast Uint8Array to base64 conversion
function fastBytesToBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes);
}

// Brand colors matching the reference template exactly
const COLORS = {
  // Header bar - dark charcoal/black (matches cover page background)
  headerDark: rgb(15/255, 15/255, 26/255),      // #0F0F1A - dark navy/black
  
  // Cover page colors
  primary: rgb(102/255, 255/255, 102/255),      // Neon green #66FF66
  orange: rgb(255/255, 174/255, 26/255),        // Orange accent #FFAE1A
  
  // Footer bar colors (cover page)
  pink: rgb(255/255, 20/255, 147/255),
  cyan: rgb(0/255, 255/255, 255/255),
  yellow: rgb(255/255, 215/255, 0/255),
  
  // Backgrounds
  black: rgb(0, 0, 0),
  white: rgb(1, 1, 1),
  
  // Text colors
  lightText: rgb(240/255, 240/255, 240/255),
  gray: rgb(107/255, 114/255, 128/255),         // #6B7280
  lightGray: rgb(156/255, 163/255, 175/255),    // #9CA3AF
  darkGray: rgb(31/255, 41/255, 55/255),        // #1F2937
  bodyText: rgb(55/255, 65/255, 81/255),        // #374151
  footerGray: rgb(107/255, 114/255, 128/255),   // #6B7280
  
  // Special markings
  confidentialRed: rgb(204/255, 0, 0),          // #CC0000 - Confidential marking
};

interface RequestBody {
  file?: string;
  fileName?: string;
  fileType?: string;
  mode?: 'extract' | 'generate';
  editedContent?: ExtractedDocument;
  coverTitleHighlightWordsOverride?: number;
}

interface StructuredSection {
  id?: string;
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet-list' | 'table' | 'feature-grid' | 'page-break' | 'heading' | 'image';
  content?: string;
  text?: string;
  level?: number;
  items?: string[];
  features?: Array<{ title: string; description: string }>;
  // Image fields
  imageBase64?: string;
  imageMimeType?: string;
  imageCaption?: string;
  // Table fields
  tableData?: { rows: string[][]; };
}

interface ExtractedDocument {
  title: string;
  subtitle: string;
  sections: StructuredSection[];
  isConfidential: boolean;
}

interface TOCEntry {
  title: string;
  page: number;
  level: number;
}

interface ElementTemplate {
  id: string;
  element_type: string;
  name?: string;
  image_base64: string | null;
  image_height: number | null;
  image_width: number | null;
  font_family: string | null;
  font_size: number | null;
  font_weight: string | null;
  font_color: string | null;
  margin_top: number | null;
  margin_bottom: number | null;
  margin_left: number | null;
  text_align: string | null;
  bullet_character: string | null;
  bullet_indent: number | null;
}

// Footer section configuration
type FooterSectionType = 'none' | 'text' | 'page_number' | 'image';
type PageNumberFormat = 'full' | 'number_only';

interface FooterConfig {
  showSeparator: boolean;
  separatorColor: string;
  separatorThickness: number;
  leftType: FooterSectionType;
  leftText: string | null;
  leftImageBase64: string | null;
  leftImageMime: string | null;
  leftPageNumberFormat: PageNumberFormat;
  middleType: FooterSectionType;
  middleText: string | null;
  middleImageBase64: string | null;
  middleImageMime: string | null;
  middlePageNumberFormat: PageNumberFormat;
  rightType: FooterSectionType;
  rightText: string | null;
  rightImageBase64: string | null;
  rightImageMime: string | null;
  rightPageNumberFormat: PageNumberFormat;
}

// Cover page title configuration
interface CoverTitleConfig {
  highlightWords: number;
  highlightColor: string;
  textColor: string;
  yOffset: number;
  showConfidential: boolean;
}

// Helper to convert hex color to RGB
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return rgb(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    );
  }
  return COLORS.bodyText;
}

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&apos;/g, "'");
}

// Sanitize text for WinAnsi encoding
function sanitizeForPdf(text: string): string {
  return text
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u2023\u2043\u25CF\u25E6\u25AA\u25AB]/g, '-')
    .replace(/[\u00A0\u2002\u2003\u2009]/g, ' ')
    .replace(/[\u2190-\u21FF]/g, '->')
    .replace(/\u00A9/g, '(c)')
    .replace(/\u00AE/g, '(R)')
    .replace(/\u2122/g, '(TM)')
    .replace(/\u00B0/g, ' deg')
    .replace(/\u00B1/g, '+/-')
    .replace(/\u00D7/g, 'x')
    .replace(/\u00F7/g, '/')
    .replace(/[^\x00-\x7F]/g, ' ');
}

// Parse DOCX relationships file to map rId to image paths
async function parseDocxRelationships(zip: JSZip): Promise<Map<string, string>> {
  const relMap = new Map<string, string>();
  
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (!relsFile) {
    console.log('[transform-document-design] No relationships file found');
    return relMap;
  }
  
  const relsXml = await relsFile.async('string');
  console.log(`[transform-document-design] Relationships XML length: ${relsXml.length}`);
  
  // Find all Relationship elements
  const relElementRegex = /<Relationship[^>]*\/?\s*>/gi;
  let relMatch;
  
  while ((relMatch = relElementRegex.exec(relsXml)) !== null) {
    const relElement = relMatch[0];
    
    // Check if it's an image type (the Type attribute contains "image")
    if (!relElement.toLowerCase().includes('/image')) continue;
    
    // Extract Id and Target attributes
    const idMatch = relElement.match(/Id\s*=\s*"([^"]+)"/i);
    const targetMatch = relElement.match(/Target\s*=\s*"([^"]+)"/i);
    
    if (idMatch && targetMatch) {
      relMap.set(idMatch[1], targetMatch[1]);
      console.log(`[transform-document-design] Found image relationship: ${idMatch[1]} -> ${targetMatch[1]}`);
    }
  }
  
  console.log(`[transform-document-design] Total image relationships found: ${relMap.size}`);
  return relMap;
}

// Extract images from DOCX media folder
async function extractDocxImages(zip: JSZip, relMap: Map<string, string>): Promise<Map<string, { base64: string; mimeType: string }>> {
  const images = new Map<string, { base64: string; mimeType: string }>();
  let totalSize = 0;
  
  for (const [rId, path] of relMap) {
    // Normalize path - it might be relative (media/image1.png) or absolute
    const normalizedPath = path.startsWith('media/') ? `word/${path}` : 
                           path.startsWith('word/') ? path : 
                           `word/media/${path.split('/').pop()}`;
    
    const imageFile = zip.file(normalizedPath);
    if (imageFile) {
      try {
        const imageData = await imageFile.async('base64');
        const imageSize = imageData.length * 0.75; // Approximate decoded size
        
        // Check size limits
        if (imageSize > MAX_IMAGE_SIZE) {
          console.log(`[transform-document-design] Skipping oversized image ${rId}: ${Math.round(imageSize / 1024)}KB`);
          continue;
        }
        if (totalSize + imageSize > MAX_TOTAL_IMAGE_SIZE) {
          console.log(`[transform-document-design] Reached total image size limit, skipping remaining images`);
          break;
        }
        
        const ext = path.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : 
                         ext === 'gif' ? 'image/gif' : 
                         ext === 'bmp' ? 'image/bmp' : 'image/jpeg';
        
        images.set(rId, { base64: imageData, mimeType });
        totalSize += imageSize;
        console.log(`[transform-document-design] Extracted image ${rId}: ${ext}, ${Math.round(imageSize / 1024)}KB`);
      } catch (e) {
        console.log(`[transform-document-design] Error extracting image ${rId}:`, e);
      }
    } else {
      // Try alternative paths
      const altPaths = [
        `word/media/${path.split('/').pop()}`,
        path,
        `word/${path}`
      ];
      for (const altPath of altPaths) {
        const altFile = zip.file(altPath);
        if (altFile) {
          try {
            const imageData = await altFile.async('base64');
            const ext = path.split('.').pop()?.toLowerCase();
            const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
            images.set(rId, { base64: imageData, mimeType });
            console.log(`[transform-document-design] Extracted image ${rId} from alt path: ${altPath}`);
            break;
          } catch (e) {
            console.log(`[transform-document-design] Error with alt path ${altPath}:`, e);
          }
        }
      }
    }
  }
  
  console.log(`[transform-document-design] Extracted ${images.size} images, total size: ${Math.round(totalSize / 1024)}KB`);
  return images;
}

// Extract content from DOCX including images
async function extractDocxContent(base64Content: string): Promise<ExtractedDocument> {
  console.log('[transform-document-design] Extracting content from DOCX');
  
  const bytes = fastBase64ToBytes(base64Content);
  const zip = await JSZip.loadAsync(bytes);
  
  // Extract image relationships and images
  const relMap = await parseDocxRelationships(zip);
  const docxImages = await extractDocxImages(zip, relMap);
  
  const sections: StructuredSection[] = [];
  let title = '';
  let subtitle = '';
  let isConfidential = false;

  const documentFile = zip.file('word/document.xml');
  if (documentFile) {
    const documentXml = await documentFile.async('string');
    
    if (documentXml.toLowerCase().includes('confidential')) {
      isConfidential = true;
    }

    // ============ Extract Tables First ============
    // Use a more robust approach to match tables by finding balanced tags
    const tablePositions: Array<{ startIndex: number; endIndex: number; section: StructuredSection }> = [];
    
    // Helper to find proper <w:tbl> or <w:tbl ...> tag (not <w:tblPr>, <w:tblGrid>, etc.)
    const findTableTag = (xml: string, startFrom: number): number => {
      let pos = startFrom;
      while (true) {
        const idx = xml.indexOf('<w:tbl', pos);
        if (idx === -1) return -1;
        
        // Check the character after '<w:tbl' - must be '>' or ' ' or '/'
        const nextChar = xml[idx + 6]; // '<w:tbl'.length = 6
        if (nextChar === '>' || nextChar === ' ' || nextChar === '/') {
          return idx;
        }
        // It's something like <w:tblPr, <w:tblGrid, etc. - skip it
        pos = idx + 1;
      }
    };
    
    // Find all table start positions
    let searchPos = 0;
    while (true) {
      const tableStart = findTableTag(documentXml, searchPos);
      if (tableStart === -1) break;
      
      // Find the matching end tag by counting nested tables
      let depth = 0;
      let pos = tableStart;
      let tableEnd = -1;
      
      while (pos < documentXml.length) {
        const nextOpen = findTableTag(documentXml, pos + 1);
        const nextClose = documentXml.indexOf('</w:tbl>', pos);
        
        if (nextClose === -1) break;
        
        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++;
          pos = nextOpen;
        } else {
          if (depth === 0) {
            tableEnd = nextClose + '</w:tbl>'.length;
            break;
          }
          depth--;
          pos = nextClose + 1;
        }
      }
      
      if (tableEnd === -1) {
        searchPos = tableStart + 1;
        continue;
      }
      
      const tableContent = documentXml.substring(tableStart, tableEnd);
      const rows: string[][] = [];
      
      // Add diagnostic logging
      console.log(`[transform-document-design] Table found at ${tableStart}-${tableEnd}, length: ${tableContent.length}`);
      console.log(`[transform-document-design] Table preview (first 300 chars): ${tableContent.substring(0, 300).replace(/\n/g, ' ')}`);
      console.log(`[transform-document-design] Contains <w:tr: ${tableContent.includes('<w:tr')}, Contains </w:tr>: ${tableContent.includes('</w:tr>')}`);
      
      // Use regex with word boundary and dotAll mode for reliable extraction
      // This approach handles nested content correctly by being non-greedy
      const rowRegex = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
      let rowMatch;
      
      while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
        const rowContent = rowMatch[0]; // Full row including tags
        const cells: string[] = [];
        
        // Extract cells using regex - create new regex for each row to reset state
        const cellRegex = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
        let cellMatch;
        
        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
          const cellInner = cellMatch[1];
          
          // Extract all text runs from the cell
          let cellText = '';
          const textMatches = cellInner.matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>/g);
          for (const tm of textMatches) {
            cellText += tm[1];
          }
          cells.push(decodeHtmlEntities(cellText.trim()));
        }
        
        if (cells.length > 0) {
          rows.push(cells);
        }
      }
      
      console.log(`[transform-document-design] Regex extracted ${rows.length} rows from table`);
      
      // Fallback: If regex finds no rows but table has w:t content, try simpler extraction
      if (rows.length === 0 && tableContent.includes('<w:t')) {
        console.log('[transform-document-design] Fallback: regex found 0 rows, attempting manual split extraction');
        
        // Try splitting by </w:tr> and extracting
        const rowParts = tableContent.split('</w:tr>');
        for (const part of rowParts) {
          if (!part.includes('<w:tr')) continue;
          
          const rowStart = part.indexOf('<w:tr');
          const rowContent = part.substring(rowStart);
          const cells: string[] = [];
          
          // Split by </w:tc> to get cells
          const cellParts = rowContent.split('</w:tc>');
          for (const cellPart of cellParts) {
            if (!cellPart.includes('<w:tc')) continue;
            
            let cellText = '';
            const textMatches = cellPart.matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>/g);
            for (const tm of textMatches) {
              cellText += tm[1];
            }
            if (cellText.trim()) {
              cells.push(decodeHtmlEntities(cellText.trim()));
            }
          }
          
          if (cells.length > 0) {
            rows.push(cells);
          }
        }
        
        console.log(`[transform-document-design] Fallback extracted ${rows.length} rows from table`);
      }
      
      // Skip tables that look like TOC (single column tables where MOST rows end with page numbers)
      const colCounts = rows.map(r => r.length);
      const maxCols = Math.max(...colCounts, 0);
      const rowsEndingWithNumber = rows.filter(r => /\d+$/.test(r[r.length - 1]?.trim() || '')).length;
      
      // Only consider it a TOC if it has tab leaders or dots pattern (indicating page references)
      const hasTabLeaders = tableContent.includes('w:tab') || tableContent.includes('……') || tableContent.includes('...');
      const isTocTable = maxCols === 1 && rows.length > 3 && rowsEndingWithNumber >= rows.length * 0.7 && hasTabLeaders;
      
      console.log(`[transform-document-design] Table analysis: ${rows.length} rows, maxCols=${maxCols}, rowsWithNumbers=${rowsEndingWithNumber}, hasTabLeaders=${hasTabLeaders}, isTOC=${isTocTable}`);
      
      if (rows.length > 0 && !isTocTable) {
        tablePositions.push({
          startIndex: tableStart,
          endIndex: tableEnd,
          section: {
            type: 'table',
            tableData: { rows }
          }
        });
        console.log(`[transform-document-design] ✓ Extracted table with ${rows.length} rows, ${maxCols} cols`);
      } else if (isTocTable) {
        // Still track position to skip paragraphs inside
        tablePositions.push({
          startIndex: tableStart,
          endIndex: tableEnd,
          section: { type: 'paragraph', content: '' }
        });
        console.log(`[transform-document-design] ✗ Skipped TOC table with ${rows.length} rows`);
      } else if (rows.length === 0) {
        console.log(`[transform-document-design] ✗ Empty table skipped - no rows found`);
      }
      
      searchPos = tableEnd;
    }
    
    // ============ Extract Paragraphs (Skip those inside tables) ============
    const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    const styleRegex = /<w:pStyle w:val="([^"]*)"/;
    
    // Helper to check if a position is inside any table
    const isInsideTable = (pos: number): boolean => {
      for (const table of tablePositions) {
        if (pos >= table.startIndex && pos < table.endIndex) {
          return true;
        }
      }
      return false;
    };
    
    let match;
    let foundTitle = false;
    
    // Track position for interleaving tables
    let tableInsertIndex = 0;
    
    while ((match = paragraphRegex.exec(documentXml)) !== null) {
      const paragraphStartIndex = match.index;
      
      // Skip paragraphs that are inside table cells
      if (isInsideTable(paragraphStartIndex)) {
        continue;
      }
      
      // Insert any tables that appear before this paragraph (skip empty placeholders)
      while (tableInsertIndex < tablePositions.length && 
             tablePositions[tableInsertIndex].startIndex < paragraphStartIndex) {
        const tableSection = tablePositions[tableInsertIndex].section;
        // Only add actual tables (not empty placeholders from TOC tables)
        if (tableSection.type === 'table' && tableSection.tableData && tableSection.tableData.rows.length > 0) {
          sections.push(tableSection);
        }
        tableInsertIndex++;
      }
      
      const paragraphContent = match[1];
      
      // Check for images in this paragraph
      const blipMatch = paragraphContent.match(/<a:blip[^>]*r:embed="(rId\d+)"/);
      if (blipMatch && docxImages.has(blipMatch[1])) {
        const img = docxImages.get(blipMatch[1])!;
        sections.push({
          type: 'image',
          imageBase64: img.base64,
          imageMimeType: img.mimeType,
        });
        console.log(`[transform-document-design] Added image section for ${blipMatch[1]}`);
        continue; // Skip text extraction for image paragraphs
      }
      
      // Also check for w:drawing elements
      const drawingMatch = paragraphContent.match(/<w:drawing[\s\S]*?<a:blip[^>]*r:embed="(rId\d+)"[\s\S]*?<\/w:drawing>/);
      if (drawingMatch && docxImages.has(drawingMatch[1])) {
        const img = docxImages.get(drawingMatch[1])!;
        sections.push({
          type: 'image',
          imageBase64: img.base64,
          imageMimeType: img.mimeType,
        });
        console.log(`[transform-document-design] Added image section from drawing for ${drawingMatch[1]}`);
        // Don't continue - there might be text with the image
      }
      
      let paragraphText = '';
      const textMatches = paragraphContent.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      for (const tm of textMatches) {
        paragraphText += tm[1];
      }
      
      paragraphText = decodeHtmlEntities(paragraphText.trim());
      if (!paragraphText) continue;
      
      const lowerText = paragraphText.toLowerCase();
      if (lowerText === 'contents' || 
          lowerText === 'table of contents' ||
          (lowerText.includes('contents') && paragraphText.length < 25)) {
        continue;
      }
      
      const styleMatch = styleRegex.exec(paragraphContent);
      const styleName = styleMatch ? styleMatch[1] : '';
      
      // Skip TOC entries (Word uses TOC styles or SDT wrappers)
      if (styleName.match(/^TOC\d|^toc\d|TOCHeading/i)) {
        console.log(`[transform-document-design] Skipped TOC paragraph: "${paragraphText.substring(0, 30)}..."`);
        continue;
      }
      
      // Also skip text that looks like TOC entries (text ending with page numbers, often with tabs)
      // Pattern: "Some Title4" or "Some Title 4" at end - indicating TOC entry with page number
      const looksLikeTocEntry = /^[A-Za-z][^0-9]*\d{1,3}$/.test(paragraphText.trim()) && 
                                paragraphText.length < 80 &&
                                !paragraphText.includes('.') && // Skip if has periods (likely a sentence)
                                !/\d{4}/.test(paragraphText); // Skip if has year
      if (looksLikeTocEntry) {
        console.log(`[transform-document-design] Skipped TOC-like paragraph: "${paragraphText}"`);
        continue;
      }
      
      let sectionType: StructuredSection['type'] = 'paragraph';
      
      // Cover page text extraction strategy:
      // - First short heading (< 30 chars or all caps) -> subtitle/category (e.g., "POLICY DOCUMENT")
      // - First longer heading -> main title (e.g., "AI Tools Policy & Procedure")
      const isShortCategoryHeading = paragraphText.length < 30 || paragraphText === paragraphText.toUpperCase();
      const skipForTitle = paragraphText.toUpperCase().includes('WHITEPAPER') || 
                           paragraphText.toUpperCase().includes('WHITE PAPER');
      
      if (styleName.match(/Heading1|Title/i) || paragraphContent.includes('w:outlineLvl w:val="0"')) {
        sectionType = 'h1';
        if (!skipForTitle && paragraphText.length > 3) {
          if (!subtitle && isShortCategoryHeading) {
            // First short/uppercase heading becomes subtitle
            subtitle = paragraphText;
          } else if (!foundTitle && paragraphText.length > 10) {
            // Longer heading becomes title
            title = paragraphText;
            foundTitle = true;
          }
        }
      } else if (styleName.match(/Heading2|Subtitle/i) || paragraphContent.includes('w:outlineLvl w:val="1"')) {
        sectionType = 'h2';
        if (!foundTitle && paragraphText.length > 15 && !skipForTitle) {
          title = paragraphText;
          foundTitle = true;
        }
      } else if (styleName.match(/Heading3/i) || paragraphContent.includes('w:outlineLvl w:val="2"')) {
        sectionType = 'h3';
      }
      
      if (paragraphText.length < 2) continue;
      if (/^\d+$/.test(paragraphText) || paragraphText.toLowerCase() === 'sentra') continue;
      if (paragraphText.toUpperCase() === 'WHITEPAPER' || 
          paragraphText.toUpperCase() === 'WHITE PAPER' ||
          paragraphText.toUpperCase() === 'TECHNICAL WHITEPAPER') continue;
      
      // ============ Improved Bullet Detection ============
      // Check for Word's native numbering properties (w:numPr) or list styles
      const hasNumPr = /<w:numPr[\s\S]*?<\/w:numPr>/.test(paragraphContent);
      const isListStyle = styleName.match(/ListParagraph|ListBullet|ListNumber|List\d/i);
      const startsWithBulletChar = paragraphText.startsWith('•') || paragraphText.startsWith('-') || paragraphText.startsWith('*');
      const startsWithNumber = /^(\d+[\.\)\]]|[a-zA-Z][\.\)\]])\s/.test(paragraphText);
      
      // Detect list item by: numbering properties, list style, bullet chars, or numbering pattern
      if (hasNumPr || isListStyle || startsWithBulletChar || startsWithNumber) {
        // Clean the text - remove bullet chars or numbering prefix
        const cleanText = paragraphText.replace(/^([•\-*]|\d+[\.\)\]]|[a-zA-Z][\.\)\]])\s*/, '');
        
        if (cleanText.trim()) {
          const lastSection = sections[sections.length - 1];
          if (lastSection && lastSection.type === 'bullet-list' && lastSection.items) {
            lastSection.items.push(cleanText);
          } else {
            sections.push({
              type: 'bullet-list',
              items: [cleanText],
            });
          }
        }
      } else {
        sections.push({
          type: sectionType,
          content: paragraphText,
        });
      }
    }
    
    // Insert any remaining tables after last paragraph (skip empty placeholders)
    while (tableInsertIndex < tablePositions.length) {
      const tableSection = tablePositions[tableInsertIndex].section;
      if (tableSection.type === 'table' && tableSection.tableData && tableSection.tableData.rows.length > 0) {
        sections.push(tableSection);
      }
      tableInsertIndex++;
    }
  }

  if (!title && sections.length > 0) {
    const firstHeading = sections.find(s => s.type === 'h1' && s.content && s.content.length > 10);
    if (firstHeading && firstHeading.content) {
      title = firstHeading.content;
    }
  }

  const imageCount = sections.filter(s => s.type === 'image').length;
  const tableCount = sections.filter(s => s.type === 'table').length;
  const bulletCount = sections.filter(s => s.type === 'bullet-list').length;
  console.log(`[transform-document-design] Extracted ${sections.length} sections (${imageCount} images, ${tableCount} tables, ${bulletCount} bullet lists), title: "${title}"`);
  
  return { title, subtitle, sections, isConfidential };
}

// Extract content from PDF including images
async function extractPdfContent(base64Content: string): Promise<ExtractedDocument> {
  console.log('[transform-document-design] Extracting content from PDF');
  
  const bytes = fastBase64ToBytes(base64Content);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  
  const sections: StructuredSection[] = [];
  let totalImageSize = 0;
  let extractedImageCount = 0;
  
  console.log(`[transform-document-design] PDF has ${pages.length} pages`);
  
  // Extract images from each page
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    
    try {
      // Get page resources
      const resources = page.node.Resources();
      if (!resources) continue;
      
      const xObjectDict = resources.get(PDFName.of('XObject'));
      if (!xObjectDict) continue;
      
      // Iterate through XObjects looking for images
      const dict = xObjectDict.dict || (xObjectDict as any).entries?.() || [];
      const entries = dict instanceof Map ? Array.from(dict.entries()) : 
                      Array.isArray(dict) ? dict : 
                      typeof dict === 'object' ? Object.entries(dict) : [];
      
      for (const [key, ref] of entries) {
        try {
          const xObject = pdfDoc.context.lookup(ref);
          if (!xObject) continue;
          
          // Check if it's an image
          const subtype = xObject.get?.(PDFName.of('Subtype'));
          if (subtype?.encodedName !== '/Image') continue;
          
          // Get image stream
          if (xObject instanceof PDFRawStream) {
            const imageBytes = xObject.contents;
            const imageSize = imageBytes.length;
            
            // Check size limits
            if (imageSize > MAX_IMAGE_SIZE) {
              console.log(`[transform-document-design] Skipping oversized PDF image on page ${pageIndex + 1}`);
              continue;
            }
            if (totalImageSize + imageSize > MAX_TOTAL_IMAGE_SIZE) {
              console.log(`[transform-document-design] Reached total image size limit for PDF`);
              break;
            }
            
            // Determine image type from filter
            const filter = xObject.get(PDFName.of('Filter'));
            let mimeType = 'image/jpeg';
            if (filter?.encodedName === '/FlateDecode') {
              mimeType = 'image/png';
            } else if (filter?.encodedName === '/DCTDecode') {
              mimeType = 'image/jpeg';
            }
            
            // Convert to base64 in chunks
            let base64 = '';
            const chunkSize = 8192;
            for (let i = 0; i < imageBytes.length; i += chunkSize) {
              const chunk = imageBytes.slice(i, Math.min(i + chunkSize, imageBytes.length));
              base64 += String.fromCharCode.apply(null, Array.from(chunk));
            }
            base64 = btoa(base64);
            
            sections.push({
              type: 'image',
              imageBase64: base64,
              imageMimeType: mimeType,
            });
            
            totalImageSize += imageSize;
            extractedImageCount++;
            console.log(`[transform-document-design] Extracted image from PDF page ${pageIndex + 1}, size: ${Math.round(imageSize / 1024)}KB`);
          }
        } catch (e) {
          // Skip individual image errors
          console.log(`[transform-document-design] Error extracting image from page ${pageIndex + 1}:`, e);
        }
      }
    } catch (e) {
      console.log(`[transform-document-design] Error processing page ${pageIndex + 1}:`, e);
    }
  }
  
  console.log(`[transform-document-design] Extracted ${extractedImageCount} images from PDF, total size: ${Math.round(totalImageSize / 1024)}KB`);
  
  // Note: Full text extraction from PDF is complex and would require additional libraries
  // For now, we focus on preserving images. Add a placeholder section if no images found.
  if (sections.length === 0) {
    sections.push({
      type: 'paragraph',
      content: 'PDF document imported. Text extraction from PDF requires additional processing.',
    });
  }
  
  return {
    title: 'Imported PDF Document',
    subtitle: '',
    sections,
    isConfidential: false,
  };
}

// Helper to wrap text into lines
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const sanitized = sanitizeForPdf(text);
  const words = sanitized.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

// Draw the colored footer bar (4 segments)
function drawFooterBar(page: any) {
  const width = page.getWidth();
  const barHeight = 8;
  const segmentWidth = width / 4;
  const y = 0;

  page.drawRectangle({ x: 0, y, width: segmentWidth, height: barHeight, color: COLORS.primary });
  page.drawRectangle({ x: segmentWidth, y, width: segmentWidth, height: barHeight, color: COLORS.pink });
  page.drawRectangle({ x: segmentWidth * 2, y, width: segmentWidth, height: barHeight, color: COLORS.yellow });
  page.drawRectangle({ x: segmentWidth * 3, y, width: segmentWidth, height: barHeight, color: COLORS.cyan });
}

// Draw Sentra logo (geometric design)
function drawSentraLogo(page: any, x: number, y: number, scale: number = 1) {
  const s = scale;
  const lightColor = COLORS.lightText;
  
  page.drawRectangle({ x: x, y: y, width: 8 * s, height: 8 * s, color: lightColor });
  page.drawRectangle({ x: x + 12 * s, y: y, width: 20 * s, height: 8 * s, color: lightColor });
  page.drawRectangle({ x: x, y: y - 24 * s, width: 20 * s, height: 8 * s, color: lightColor });
  page.drawRectangle({ x: x + 24 * s, y: y - 24 * s, width: 8 * s, height: 8 * s, color: lightColor });
  page.drawRectangle({ x: x, y: y - 12 * s, width: 8 * s, height: 8 * s, color: lightColor });
  page.drawRectangle({ x: x + 24 * s, y: y - 12 * s, width: 8 * s, height: 8 * s, color: lightColor });
  
  page.drawCircle({
    x: x + 16 * s,
    y: y - 8 * s,
    size: 5 * s,
    color: COLORS.orange,
  });
}

// Draw header using pre-embedded image or default
// logoConfig.height: The target display height for the logo (from page layout settings)
function drawHeaderElement(
  page: any, 
  embeddedHeaderImage: any | null,
  headerHeight: number,
  logoImage: any,
  logoConfig: { show: boolean; x: number; y: number; height?: number; } | null = null
) {
  const width = page.getWidth();
  const height = page.getHeight();
  
  // Use config height or default to 24, capped by header height
  const targetLogoHeight = Math.min(logoConfig?.height || 24, headerHeight - 8);
  
  if (embeddedHeaderImage) {
    page.drawImage(embeddedHeaderImage, {
      x: 0,
      y: height - headerHeight,
      width: width,
      height: headerHeight,
    });
    
    // Draw logo on top of header if configured
    if (logoConfig?.show && logoImage) {
      const logoWidth = (logoImage.width / logoImage.height) * targetLogoHeight;
      page.drawImage(logoImage, {
        x: logoConfig.x,
        y: height - logoConfig.y - targetLogoHeight,
        width: logoWidth,
        height: targetLogoHeight,
      });
    }
    return headerHeight;
  }
  
  // Default header if no template
  const defaultHeight = 40;
  page.drawRectangle({
    x: 0,
    y: height - defaultHeight,
    width: width,
    height: defaultHeight,
    color: COLORS.headerDark,
  });

  // Draw logo at configured position or default
  if (logoConfig?.show && logoImage) {
    const logoWidth = (logoImage.width / logoImage.height) * targetLogoHeight;
    page.drawImage(logoImage, {
      x: logoConfig.x,
      y: height - logoConfig.y - targetLogoHeight,
      width: logoWidth,
      height: targetLogoHeight,
    });
  } else if (logoImage) {
    // Fallback default position
    const logoWidth = (logoImage.width / logoImage.height) * targetLogoHeight;
    page.drawImage(logoImage, {
      x: 25,
      y: height - defaultHeight + 8,
      width: logoWidth,
      height: targetLogoHeight,
    });
  }
  
  return defaultHeight;
}

// Draw footer using pre-embedded image or default
function drawFooterElement(
  page: any, 
  fonts: any,
  embeddedFooterImage: any | null,
  footerHeight: number,
  pageNumber: number,
  isConfidential: boolean
) {
  const width = page.getWidth();
  const margin = 35;
  
  if (embeddedFooterImage) {
    page.drawImage(embeddedFooterImage, {
      x: 0,
      y: 0,
      width: width,
      height: footerHeight,
    });
    return footerHeight;
  }
  
  // Default footer
  const footerY = 25;

  const copyrightText = `(c) Sentra ${new Date().getFullYear()}. All rights reserved.`;
  page.drawText(copyrightText, {
    x: margin,
    y: footerY,
    size: 9,
    font: fonts.regular,
    color: COLORS.footerGray,
  });

  if (isConfidential) {
    const confText = 'Confidential';
    const confWidth = fonts.regular.widthOfTextAtSize(confText, 9);
    page.drawText(confText, {
      x: (width - confWidth) / 2,
      y: footerY,
      size: 9,
      font: fonts.regular,
      color: COLORS.footerGray,
    });
  }

  const pageNumText = pageNumber.toString();
  const pageNumWidth = fonts.regular.widthOfTextAtSize(pageNumText, 9);
  page.drawText(pageNumText, {
    x: width - margin - pageNumWidth,
    y: footerY,
    size: 9,
    font: fonts.regular,
    color: COLORS.footerGray,
  });
  
  return 40;
}

// Draw configurable footer with separator, left/middle/right sections
async function drawConfigurableFooter(
  page: any,
  pdfDoc: any,
  fonts: any,
  footerConfig: FooterConfig | null,
  pageNumber: number,
  totalPages: number,
  isConfidential: boolean,
  embeddedFooterImages: Map<string, any>
) {
  const width = page.getWidth();
  const margin = 35;
  const footerY = 25;
  const fontSize = 9;
  
  // If no config, use default footer
  if (!footerConfig) {
    return drawFooterElement(page, fonts, null, 40, pageNumber, isConfidential);
  }

  // Draw separator line if enabled - full width of page
  if (footerConfig.showSeparator) {
    const separatorColor = footerConfig.separatorColor 
      ? hexToRgb(footerConfig.separatorColor) 
      : COLORS.lightGray;
    const thickness = footerConfig.separatorThickness || 1;
    
    page.drawLine({
      start: { x: 0, y: footerY + 15 },
      end: { x: width, y: footerY + 15 },
      thickness: thickness,
      color: separatorColor,
    });
  }

  // Helper to draw a section
  const drawSection = async (
    type: FooterSectionType,
    text: string | null,
    imageBase64: string | null,
    imageMime: string | null,
    position: 'left' | 'middle' | 'right',
    pageNumberFormat: PageNumberFormat = 'full'
  ) => {
    if (type === 'none') return;

    let x: number;
    let displayText = '';

    if (type === 'text' && text) {
      displayText = text;
    } else if (type === 'page_number') {
      // Use configured format: 'number_only' shows just the number, 'full' shows "Page X of Y"
      displayText = pageNumberFormat === 'number_only' 
        ? pageNumber.toString() 
        : `Page ${pageNumber} of ${totalPages}`;
    }

    if (type === 'text' || type === 'page_number') {
      const textWidth = fonts.regular.widthOfTextAtSize(displayText, fontSize);
      
      if (position === 'left') {
        x = margin;
      } else if (position === 'middle') {
        x = (width - textWidth) / 2;
      } else {
        x = width - margin - textWidth;
      }

      page.drawText(displayText, {
        x: x,
        y: footerY,
        size: fontSize,
        font: fonts.regular,
        color: COLORS.footerGray,
      });
    } else if (type === 'image' && imageBase64) {
      try {
        // Check cache first
        const cacheKey = `footer_${position}`;
        let embeddedImg = embeddedFooterImages.get(cacheKey);
        
        if (!embeddedImg) {
          const imgBytes = fastBase64ToBytes(imageBase64);
          if (imageMime?.includes('png')) {
            embeddedImg = await pdfDoc.embedPng(imgBytes);
          } else {
            embeddedImg = await pdfDoc.embedJpg(imgBytes);
          }
          embeddedFooterImages.set(cacheKey, embeddedImg);
        }

        // Scale image to fit footer height (about 20px)
        const maxHeight = 18;
        const scale = maxHeight / embeddedImg.height;
        const imgWidth = embeddedImg.width * scale;
        const imgHeight = maxHeight;

        if (position === 'left') {
          x = margin;
        } else if (position === 'middle') {
          x = (width - imgWidth) / 2;
        } else {
          x = width - margin - imgWidth;
        }

        page.drawImage(embeddedImg, {
          x: x,
          y: footerY - 4,
          width: imgWidth,
          height: imgHeight,
        });
      } catch (e) {
        console.log(`[transform-document-design] Error embedding footer image for ${position}:`, e);
      }
    }
  };

  // Draw each section with their respective page number formats
  await drawSection(footerConfig.leftType, footerConfig.leftText, footerConfig.leftImageBase64, footerConfig.leftImageMime, 'left', footerConfig.leftPageNumberFormat);
  await drawSection(footerConfig.middleType, footerConfig.middleText, footerConfig.middleImageBase64, footerConfig.middleImageMime, 'middle', footerConfig.middlePageNumberFormat);
  await drawSection(footerConfig.rightType, footerConfig.rightText, footerConfig.rightImageBase64, footerConfig.rightImageMime, 'right', footerConfig.rightPageNumberFormat);

  return 40;
}

// Create cover page with element templates
// logoConfig.height: The target display height for the logo (from page layout settings)
async function createCoverPageWithElements(
  pdfDoc: any, 
  fonts: any, 
  data: ExtractedDocument,
  coverTemplate: ElementTemplate | null,
  titleStyle: ElementTemplate | null,
  subtitleStyle: ElementTemplate | null,
  logoImage: any,
  logoConfig: { show: boolean; x: number; y: number; height?: number; } | null,
  titleConfig: CoverTitleConfig | null = null,
  showConfidential: boolean = false
) {
  const page = pdfDoc.addPage([595, 842]);
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 50;

  // Draw cover background if template has image - check size first to prevent CPU timeout
  if (coverTemplate?.image_base64) {
    const base64Size = coverTemplate.image_base64.length * 0.75; // Approximate bytes from base64
    console.log(`[transform-document-design] Cover image size: ~${Math.round(base64Size / 1024)}KB`);
    
    if (base64Size > MAX_COVER_IMAGE_SIZE) {
      console.log(`[transform-document-design] Cover image too large (${Math.round(base64Size / 1024)}KB > ${MAX_COVER_IMAGE_SIZE / 1024}KB) - using fallback`);
      page.drawRectangle({ x: 0, y: 0, width, height, color: COLORS.black });
      drawSentraLogo(page, margin, height - 60, 1);
      page.drawText('Sentra', { x: margin + 50, y: height - 75, size: 20, font: fonts.bold, color: COLORS.lightText });
      drawFooterBar(page);
    } else {
      try {
        const bytes = fastBase64ToBytes(coverTemplate.image_base64);
        // Try PNG first, fallback to JPG
        let coverImage;
        try {
          coverImage = await pdfDoc.embedPng(bytes);
        } catch {
          coverImage = await pdfDoc.embedJpg(bytes);
        }
        
        page.drawImage(coverImage, {
          x: 0,
          y: 0,
          width: width,
          height: height,
        });
        console.log('[transform-document-design] Embedded cover background');
      } catch (e) {
        console.log('[transform-document-design] Could not embed cover image:', e);
        page.drawRectangle({ x: 0, y: 0, width, height, color: COLORS.black });
        drawSentraLogo(page, margin, height - 60, 1);
        page.drawText('Sentra', { x: margin + 50, y: height - 75, size: 20, font: fonts.bold, color: COLORS.lightText });
        drawFooterBar(page);
      }
    }
  } else {
    // Default black cover
    page.drawRectangle({ x: 0, y: 0, width, height, color: COLORS.black });
    drawSentraLogo(page, margin, height - 60, 1);
    page.drawText('Sentra', { x: margin + 50, y: height - 75, size: 20, font: fonts.bold, color: COLORS.lightText });
    drawFooterBar(page);
  }

  // Draw logo on cover page if configured - use config height for sizing
  if (logoConfig?.show && logoImage) {
    const targetLogoHeight = logoConfig.height || 40;
    const logoWidth = Math.round((logoImage.width / logoImage.height) * targetLogoHeight);
    const logoX = Math.round(logoConfig.x);
    const logoY = Math.round(height - logoConfig.y - targetLogoHeight);
    
    console.log(`[transform-document-design] COVER LOGO DEBUG:`);
    console.log(`  - Logo image dimensions: ${logoImage.width}x${logoImage.height}`);
    console.log(`  - Target height: ${targetLogoHeight}pt, Calculated width: ${logoWidth}pt`);
    console.log(`  - Config position: x=${logoConfig.x}, y=${logoConfig.y} (from top)`);
    console.log(`  - PDF position: x=${logoX}, y=${logoY} (from bottom)`);
    
    page.drawImage(logoImage, {
      x: logoX,
      y: logoY,
      width: logoWidth,
      height: targetLogoHeight,
    });
  }

  // Draw title with element style and configurable split-color
  // Apply y offset from titleConfig (higher offset = higher on page)
  const baseY = coverTemplate?.image_base64 ? 400 : height - 440;
  const yOffset = titleConfig?.yOffset ?? 100;
  const titleY = baseY + yOffset;
  
  const titleFontSize = titleStyle?.font_size || 28;
  const titleFont = titleStyle?.font_weight === 'bold' ? fonts.bold : fonts.bold;
  
  // Get colors from titleConfig or fall back to defaults
  const highlightColor = titleConfig?.highlightColor ? hexToRgb(titleConfig.highlightColor) : COLORS.primary;
  const textColor = titleConfig?.textColor ? hexToRgb(titleConfig.textColor) : COLORS.white;
  const highlightWords = titleConfig?.highlightWords ?? 3;
  
  const titleText = data.title || 'Document Title';
  const titleLines = wrapText(titleText, titleFont, titleFontSize, width - margin * 2);
  
  // Split title into words to track highlight boundary
  const allWords = titleText.split(/\s+/);
  let wordsProcessed = 0;
  
  let currentY = titleY;
  for (const line of titleLines) {
    const lineWords = line.split(/\s+/);
    
    // Calculate where in this line the highlight ends
    const wordsBeforeLine = wordsProcessed;
    const wordsAfterLine = wordsProcessed + lineWords.length;
    
    if (highlightWords === 0) {
      // No highlight, all text in secondary color
      page.drawText(line, {
        x: margin,
        y: currentY,
        size: titleFontSize,
        font: titleFont,
        color: textColor,
      });
    } else if (wordsAfterLine <= highlightWords) {
      // Entire line is highlighted
      page.drawText(line, {
        x: margin,
        y: currentY,
        size: titleFontSize,
        font: titleFont,
        color: highlightColor,
      });
    } else if (wordsBeforeLine >= highlightWords) {
      // Entire line is in text color (past highlight)
      page.drawText(line, {
        x: margin,
        y: currentY,
        size: titleFontSize,
        font: titleFont,
        color: textColor,
      });
    } else {
      // Line contains the transition point - split rendering
      const highlightWordCount = highlightWords - wordsBeforeLine;
      const highlightedPart = lineWords.slice(0, highlightWordCount).join(' ') + ' ';
      const remainingPart = lineWords.slice(highlightWordCount).join(' ');
      
      // Draw highlighted portion
      page.drawText(highlightedPart, {
        x: margin,
        y: currentY,
        size: titleFontSize,
        font: titleFont,
        color: highlightColor,
      });
      
      // Measure highlighted text width and draw remaining
      const highlightedWidth = titleFont.widthOfTextAtSize(highlightedPart, titleFontSize);
      page.drawText(remainingPart, {
        x: margin + highlightedWidth,
        y: currentY,
        size: titleFontSize,
        font: titleFont,
        color: textColor,
      });
    }
    
    wordsProcessed += lineWords.length;
    currentY -= titleFontSize + 8;
  }
  
  // Draw subtitle/category ABOVE the title (e.g., "POLICY DOCUMENT")
  if (data.subtitle) {
    const subtitleFontSize = subtitleStyle?.font_size || 14;
    const subtitleFont = fonts.bold;
    const subtitleColor = subtitleStyle?.font_color ? hexToRgb(subtitleStyle.font_color) : COLORS.white;
    
    // Position subtitle above the title with some spacing
    const subtitleY = titleY + (titleLines.length * (titleFontSize + 8)) + 30;
    
    page.drawText(data.subtitle.toUpperCase(), {
      x: margin,
      y: subtitleY,
      size: subtitleFontSize,
      font: subtitleFont,
      color: subtitleColor,
    });
    
    console.log(`[transform-document-design] Rendered subtitle: "${data.subtitle}" at y=${subtitleY}`);
  }
  
  // Draw "Confidential" marking at bottom center if enabled
  if (showConfidential) {
    const confidentialText = 'Confidential';
    const confidentialFontSize = 14;
    const confidentialFont = fonts.bold;
    const confidentialColor = COLORS.confidentialRed;
    
    const textWidth = confidentialFont.widthOfTextAtSize(confidentialText, confidentialFontSize);
    const confidentialX = (width - textWidth) / 2; // Center horizontally
    const confidentialY = 30; // 30pt from bottom
    
    page.drawText(confidentialText, {
      x: confidentialX,
      y: confidentialY,
      size: confidentialFontSize,
      font: confidentialFont,
      color: confidentialColor,
    });
    
    console.log(`[transform-document-design] Rendered "Confidential" marking at center bottom`);
  }
}

// Create TOC page
async function createTOCPage(
  pdfDoc: any, 
  fonts: any, 
  tocEntries: TOCEntry[], 
  isConfidential: boolean, 
  logoImage: any,
  embeddedHeaderImage: any | null,
  headerHeight: number,
  embeddedFooterImage: any | null,
  footerHeight: number,
  logoConfig: { show: boolean; x: number; y: number; height?: number; } | null = null,
  footerConfig: FooterConfig | null = null,
  totalPages: number = 1,
  tocPageNumber: number = 2,
  embeddedFooterImages: Map<string, any> = new Map()
) {
  const page = pdfDoc.addPage([595, 842]);
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 50;

  const actualHeaderHeight = drawHeaderElement(page, embeddedHeaderImage, headerHeight, logoImage, logoConfig);

  const titleY = height - actualHeaderHeight - 40;
  // TOC title - all black text (no green on content pages, only cover page has green)
  page.drawText('Table of Contents', {
    x: margin,
    y: titleY,
    size: 28,
    font: fonts.bold,
    color: COLORS.black,
  });

  let y = titleY - 50;

  for (let i = 0; i < tocEntries.length; i++) {
    const entry = tocEntries[i];
    const fontSize = 11;
    const pageNumReserve = 50;
    const maxTitleWidth = width - margin * 2 - pageNumReserve;
    
    let displayTitle = sanitizeForPdf(entry.title);
    if (fonts.bold.widthOfTextAtSize(displayTitle, fontSize) > maxTitleWidth) {
      while (displayTitle.length > 0 && fonts.bold.widthOfTextAtSize(displayTitle + '...', fontSize) > maxTitleWidth) {
        displayTitle = displayTitle.slice(0, -1);
      }
      displayTitle += '...';
    }
    
    page.drawText(displayTitle, {
      x: margin,
      y: y,
      size: fontSize,
      font: fonts.bold,
      color: COLORS.black,
    });

    const pageNumText = entry.page.toString();
    const pageNumX = width - margin - fonts.regular.widthOfTextAtSize(pageNumText, fontSize);
    page.drawText(pageNumText, {
      x: pageNumX,
      y: y,
      size: fontSize,
      font: fonts.regular,
      color: COLORS.gray,
    });

    const titleWidth = fonts.bold.widthOfTextAtSize(displayTitle, fontSize);
    const dotsStartX = margin + titleWidth + 8;
    const dotsEndX = pageNumX - 8;
    for (let dotX = dotsStartX; dotX < dotsEndX; dotX += 4) {
      page.drawText('.', {
        x: dotX,
        y: y,
        size: fontSize,
        font: fonts.regular,
        color: COLORS.lightGray,
      });
    }

    y -= 26;
  }

  // Use configurable footer if provided, otherwise fall back to default
  if (footerConfig) {
    await drawConfigurableFooter(page, pdfDoc, fonts, footerConfig, tocPageNumber, totalPages, isConfidential, embeddedFooterImages);
  } else {
    drawFooterElement(page, fonts, embeddedFooterImage, footerHeight, tocPageNumber, isConfidential);
  }
}

// Generate TOC entries
// Page numbering starts at 2 (TOC is page 1, content starts at page 2, cover not counted)
function generateTOCEntries(sections: StructuredSection[], fonts: any): TOCEntry[] {
  const entries: TOCEntry[] = [];
  let currentPage = 2; // Content starts at page 2 (cover not counted, TOC is page 1)
  let hasContent = false;

  for (const section of sections) {
    if (section.type === 'h1' || section.type === 'page-break') {
      if (hasContent) {
        currentPage++;
        hasContent = false;
      }
      
      if (section.type === 'h1' && section.content) {
        entries.push({
          title: section.content,
          page: currentPage,
          level: 1,
        });
      }
      hasContent = true;
    } else {
      hasContent = true;
    }
  }

  return entries;
}

// Create content pages with element templates - now with image support
// logoConfig.height: The target display height for the logo (from page layout settings)
async function createContentPages(
  pdfDoc: any, 
  fonts: any, 
  sections: StructuredSection[], 
  isConfidential: boolean, 
  logoImage: any,
  embeddedHeaderImage: any | null,
  headerHeight: number,
  embeddedFooterImage: any | null,
  footerHeight: number,
  elements: {
    h1?: ElementTemplate | null;
    h2?: ElementTemplate | null;
    h3?: ElementTemplate | null;
    paragraph?: ElementTemplate | null;
    bullet?: ElementTemplate | null;
  },
  logoConfig: { show: boolean; x: number; y: number; height?: number; } | null = null,
  embeddedContentPageImage: any | null = null,
  footerConfig: FooterConfig | null = null,
  totalPages: number = 10,
  startPageNumber: number = 3,
  embeddedFooterImages: Map<string, any> = new Map()
) {
  // Limit sections to prevent CPU timeout
  const MAX_SECTIONS = 100;
  const limitedSections = sections.slice(0, MAX_SECTIONS);
  if (sections.length > MAX_SECTIONS) {
    console.log(`[transform-document-design] WARNING: Limiting sections from ${sections.length} to ${MAX_SECTIONS}`);
  }
  
  let currentPage = pdfDoc.addPage([595, 842]);
  const pageWidth = currentPage.getWidth();
  const pageHeight = currentPage.getHeight();
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  
  // If using full content page design, adjust header/footer heights to account for the design
  const effectiveHeaderHeight = embeddedContentPageImage ? 42 : headerHeight; // Full page design has header included
  const effectiveFooterHeight = embeddedContentPageImage ? 50 : footerHeight; // Full page design has footer included
  
  let y = pageHeight - effectiveHeaderHeight - 25;
  const minY = effectiveFooterHeight + 20;
  let pageNumber = startPageNumber;
  let hasContent = false;
  
  // Limit pages to prevent CPU timeout
  const MAX_PAGES = 20;

  // Cache for embedded images to avoid re-embedding duplicates
  const embeddedImageCache = new Map<string, any>();

  // Helper to draw page background (either full content page design or separate header/footer)
  const drawPageBackground = (page: any) => {
    if (embeddedContentPageImage) {
      // Draw full page design as background
      page.drawImage(embeddedContentPageImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
      // Logo can still be drawn on top if configured - use config height for sizing
      if (logoConfig?.show && logoImage) {
        const targetLogoHeight = logoConfig.height || 24;
        const logoWidth = Math.round((logoImage.width / logoImage.height) * targetLogoHeight);
        const logoX = Math.round(logoConfig.x);
        const logoY = Math.round(pageHeight - logoConfig.y - targetLogoHeight);
        
        console.log(`[transform-document-design] CONTENT PAGE LOGO DEBUG:`);
        console.log(`  - Logo image dimensions: ${logoImage.width}x${logoImage.height}`);
        console.log(`  - Target height: ${targetLogoHeight}pt, Calculated width: ${logoWidth}pt`);
        console.log(`  - Config position: x=${logoConfig.x}, y=${logoConfig.y} (from top)`);
        console.log(`  - PDF position: x=${logoX}, y=${logoY} (from bottom)`);
        
        page.drawImage(logoImage, {
          x: logoX,
          y: logoY,
          width: logoWidth,
          height: targetLogoHeight,
        });
      }
    } else {
      // Draw separate header element
      drawHeaderElement(page, embeddedHeaderImage, headerHeight, logoImage, logoConfig);
    }
  };

  // Draw background on first page
  drawPageBackground(currentPage);

  const addNewPage = async () => {
    // Limit pages to prevent CPU timeout
    if (pageNumber >= MAX_PAGES) {
      console.log(`[transform-document-design] WARNING: Max pages (${MAX_PAGES}) reached, stopping`);
      return false;
    }
    
    // Draw footer on current page
    // If using configurable footer, always draw it (even on full page design)
    // Otherwise, only draw default footer if not using full page design
    if (footerConfig) {
      await drawConfigurableFooter(currentPage, pdfDoc, fonts, footerConfig, pageNumber, totalPages, isConfidential, embeddedFooterImages);
    } else if (!embeddedContentPageImage) {
      drawFooterElement(currentPage, fonts, embeddedFooterImage, footerHeight, pageNumber, isConfidential);
    }
    pageNumber++;
    currentPage = pdfDoc.addPage([595, 842]);
    drawPageBackground(currentPage);
    y = pageHeight - effectiveHeaderHeight - 25;
    hasContent = false;
    return true;
  };

  // Get text style properties
  const getTextStyle = (type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet') => {
    const template = elements[type];
    return {
      fontSize: template?.font_size || (type === 'h1' ? 22 : type === 'h2' ? 16 : type === 'h3' ? 13 : 10),
      fontWeight: template?.font_weight || (type.startsWith('h') ? 'bold' : 'normal'),
      color: template?.font_color ? hexToRgb(template.font_color) : (type.startsWith('h') ? COLORS.black : COLORS.bodyText),
      marginTop: template?.margin_top || (type === 'h1' ? 20 : type === 'h2' ? 16 : type === 'h3' ? 12 : 0),
      marginBottom: template?.margin_bottom || (type === 'h1' ? 12 : type === 'h2' ? 8 : type === 'h3' ? 6 : 8),
      bulletChar: template?.bullet_character || '-',
      bulletIndent: template?.bullet_indent || 20,
    };
  };

  for (let i = 0; i < limitedSections.length; i++) {
    // Check page limit
    if (pageNumber >= MAX_PAGES) break;
    
    const section = limitedSections[i];
    const content = section.content || section.text || '';

    if (section.type === 'page-break') {
      if (hasContent) {
        if (!(await addNewPage())) break;
      }
      continue;
    }

    if (y < minY + 80) {
      if (!(await addNewPage())) break;
    }

    // Handle image sections - limit to 5 embedded images to prevent timeout
    if (section.type === 'image' && section.imageBase64 && section.imageMimeType) {
      if (embeddedImageCache.size >= 5) {
        console.log('[transform-document-design] Skipping image - max embedded images reached');
        continue;
      }
      
      try {
        // Check cache first
        const cacheKey = section.imageBase64.substring(0, 100);
        let embeddedImg = embeddedImageCache.get(cacheKey);
        
        if (!embeddedImg) {
          const imgBytes = fastBase64ToBytes(section.imageBase64);
          
          // Embed based on type
          if (section.imageMimeType.includes('png')) {
            embeddedImg = await pdfDoc.embedPng(imgBytes);
          } else {
            embeddedImg = await pdfDoc.embedJpg(imgBytes);
          }
          
          embeddedImageCache.set(cacheKey, embeddedImg);
        }
        
        // Calculate scaling to fit page width
        const maxWidth = contentWidth * 0.9; // 90% of content width
        const maxHeight = 400; // Maximum height
        
        let imgWidth = embeddedImg.width;
        let imgHeight = embeddedImg.height;
        
        // Scale down if needed
        if (imgWidth > maxWidth) {
          const scale = maxWidth / imgWidth;
          imgWidth *= scale;
          imgHeight *= scale;
        }
        if (imgHeight > maxHeight) {
          const scale = maxHeight / imgHeight;
          imgWidth *= scale;
          imgHeight *= scale;
        }
        
        // Check page break
        if (y - imgHeight < minY + 50) {
          if (!(await addNewPage())) break;
        }
        
        // Center image horizontally
        const imgX = margin + (contentWidth - imgWidth) / 2;
        
        currentPage.drawImage(embeddedImg, {
          x: imgX,
          y: y - imgHeight,
          width: imgWidth,
          height: imgHeight,
        });
        
        y -= imgHeight + 20; // Add spacing after image
        hasContent = true;
        
        console.log(`[transform-document-design] Drew image: ${Math.round(imgWidth)}x${Math.round(imgHeight)}`);
      } catch (e) {
        console.log('[transform-document-design] Error embedding content image:', e);
      }
      continue;
    }

    if (section.type === 'h1') {
      if (hasContent && i > 0) {
        if (!(await addNewPage())) break;
      }

      const style = getTextStyle('h1');
      y -= style.marginTop;
      
      const font = style.fontWeight === 'bold' ? fonts.bold : fonts.regular;
      const lines = wrapText(content, font, style.fontSize, contentWidth);
      for (const line of lines) {
        currentPage.drawText(line, {
          x: margin,
          y: y,
          size: style.fontSize,
          font: font,
          color: style.color,
        });
        y -= style.fontSize + 6;
      }
      y -= style.marginBottom;
      hasContent = true;
    }
    else if (section.type === 'h2') {
      if (y < minY + 60) {
        if (!(await addNewPage())) break;
      }
      
      const style = getTextStyle('h2');
      y -= style.marginTop;

      const font = style.fontWeight === 'bold' ? fonts.bold : fonts.regular;
      const lines = wrapText(content, font, style.fontSize, contentWidth);
      for (const line of lines) {
        currentPage.drawText(line, {
          x: margin,
          y: y,
          size: style.fontSize,
          font: font,
          color: style.color,
        });
        y -= style.fontSize + 6;
      }
      y -= style.marginBottom;
      hasContent = true;
    }
    else if (section.type === 'h3') {
      if (y < minY + 40) {
        if (!(await addNewPage())) break;
      }
      
      const style = getTextStyle('h3');
      y -= style.marginTop;

      const font = style.fontWeight === 'bold' ? fonts.bold : fonts.regular;
      const lines = wrapText(content, font, style.fontSize, contentWidth);
      for (const line of lines) {
        currentPage.drawText(line, {
          x: margin,
          y: y,
          size: style.fontSize,
          font: font,
          color: style.color,
        });
        y -= style.fontSize + 4;
      }
      y -= style.marginBottom;
      hasContent = true;
    }
    else if (section.type === 'bullet-list' && section.items) {
      const style = getTextStyle('bullet');
      
      for (const item of section.items) {
        if (pageNumber >= MAX_PAGES) break;
        if (y < minY + 30) {
          if (!(await addNewPage())) break;
        }

        const bulletX = margin + 8;
        
        currentPage.drawText(style.bulletChar, {
          x: bulletX,
          y: y,
          size: style.fontSize,
          font: fonts.bold,
          color: style.color,
        });

        const lines = wrapText(item, fonts.medium, style.fontSize, contentWidth - style.bulletIndent - 8);
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          currentPage.drawText(lines[lineIdx], {
            x: margin + style.bulletIndent,
            y: y,
            size: style.fontSize,
            font: fonts.medium,
            color: style.color,
          });
          y -= style.fontSize + 6;
        }
        y -= 4;
      }
      y -= style.marginBottom;
      hasContent = true;
    }
    else if (section.type === 'table' && section.tableData) {
      // ============ Table Rendering ============
      const { rows } = section.tableData;
      if (rows.length === 0) continue;
      
      const colCount = Math.max(...rows.map(r => r.length));
      const colWidth = contentWidth / colCount;
      const cellPadding = 4;
      const baseFontSize = 9;
      const lineHeight = 12; // Height per line of text
      const cellVerticalPadding = 4;
      
      // Pre-calculate wrapped text and row heights for all rows
      const rowsData: Array<{ wrappedCells: string[][]; rowHeight: number }> = [];
      for (const row of rows) {
        const wrappedCells: string[][] = [];
        let maxLines = 1;
        
        for (let colIdx = 0; colIdx < colCount; colIdx++) {
          const cellText = row[colIdx] || '';
          const font = rowsData.length === 0 ? fonts.bold : fonts.medium;
          const maxCellWidth = colWidth - (cellPadding * 2);
          const cellLines = wrapText(cellText, font, baseFontSize, maxCellWidth);
          wrappedCells.push(cellLines);
          maxLines = Math.max(maxLines, cellLines.length);
        }
        
        const rowHeight = (maxLines * lineHeight) + (cellVerticalPadding * 2);
        rowsData.push({ wrappedCells, rowHeight });
      }
      
      const totalTableHeight = rowsData.reduce((sum, r) => sum + r.rowHeight, 0);
      
      // Check page break before table
      if (y - totalTableHeight < minY + 50) {
        if (!(await addNewPage())) break;
      }
      
      // Draw table
      for (let rowIdx = 0; rowIdx < rowsData.length; rowIdx++) {
        if (pageNumber >= MAX_PAGES) break;
        
        const { wrappedCells, rowHeight } = rowsData[rowIdx];
        const rowY = y;
        
        // Check if we need a new page mid-table
        if (rowY - rowHeight < minY) {
          if (!(await addNewPage())) break;
        }
        
        // Draw top border for this row
        currentPage.drawLine({
          start: { x: margin, y: rowY },
          end: { x: margin + contentWidth, y: rowY },
          thickness: rowIdx === 0 ? 1 : 0.5,
          color: rowIdx === 0 ? COLORS.darkGray : COLORS.lightGray,
        });
        
        // Draw vertical column separators
        for (let colIdx = 0; colIdx <= colCount; colIdx++) {
          const colX = margin + (colIdx * colWidth);
          currentPage.drawLine({
            start: { x: colX, y: rowY },
            end: { x: colX, y: rowY - rowHeight },
            thickness: 0.5,
            color: COLORS.lightGray,
          });
        }
        
        // Draw cell text with wrapping
        for (let colIdx = 0; colIdx < colCount; colIdx++) {
          const cellX = margin + (colIdx * colWidth) + cellPadding;
          const cellLines = wrappedCells[colIdx];
          const font = rowIdx === 0 ? fonts.bold : fonts.medium;
          const textColor = rowIdx === 0 ? COLORS.darkGray : COLORS.bodyText;
          
          for (let lineIdx = 0; lineIdx < cellLines.length; lineIdx++) {
            const lineY = rowY - cellVerticalPadding - lineHeight + 2 - (lineIdx * lineHeight);
            currentPage.drawText(cellLines[lineIdx], {
              x: cellX,
              y: lineY,
              size: baseFontSize,
              font,
              color: textColor,
            });
          }
        }
        
        y -= rowHeight;
      }
      
      // Draw bottom border
      currentPage.drawLine({
        start: { x: margin, y: y },
        end: { x: margin + contentWidth, y: y },
        thickness: 1,
        color: COLORS.darkGray,
      });
      
      y -= 15; // Spacing after table
      hasContent = true;
      console.log(`[transform-document-design] Drew table with ${rows.length} rows`);
    }
    else if (section.type === 'paragraph' && content) {
      const style = getTextStyle('paragraph');
      const lines = wrapText(content, fonts.medium, style.fontSize, contentWidth);
      
      for (const line of lines) {
        if (pageNumber >= MAX_PAGES) break;
        if (y < minY) {
          if (!(await addNewPage())) break;
        }

        currentPage.drawText(line, {
          x: margin,
          y: y,
          size: style.fontSize,
          font: fonts.medium,
          color: style.color,
        });
        y -= style.fontSize + 5;
      }
      y -= style.marginBottom;
      hasContent = true;
    }
  }

  // Draw footer on last page
  // If using configurable footer, always draw it (even on full page design)
  // Otherwise, only draw default footer if not using full page design
  if (footerConfig) {
    await drawConfigurableFooter(currentPage, pdfDoc, fonts, footerConfig, pageNumber, totalPages, isConfidential, embeddedFooterImages);
  } else if (!embeddedContentPageImage) {
    drawFooterElement(currentPage, fonts, embeddedFooterImage, footerHeight, pageNumber, isConfidential);
  }
}

// Main PDF generation
async function generatePDF(
  extractedDoc: ExtractedDocument, 
  logoBytes: Uint8Array | null,
  elements: {
    cover_background?: ElementTemplate | null;
    header?: ElementTemplate | null;
    footer?: ElementTemplate | null;
    logo?: ElementTemplate | null;
    content_page?: ElementTemplate | null;
    title?: ElementTemplate | null;
    h1?: ElementTemplate | null;
    h2?: ElementTemplate | null;
    h3?: ElementTemplate | null;
    paragraph?: ElementTemplate | null;
    bullet?: ElementTemplate | null;
  },
  layoutConfig: {
    cover?: { show_logo: boolean; logo_x: number; logo_y: number; logo_height?: number; } | null;
    content?: { show_logo: boolean; logo_x: number; logo_y: number; logo_height?: number; } | null;
    toc?: { show_logo: boolean; logo_x: number; logo_y: number; logo_height?: number; } | null;
  },
  footerConfigs: {
    toc?: FooterConfig | null;
    content?: FooterConfig | null;
  } = {},
  coverTitleConfig: CoverTitleConfig | null = null
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  // Register fontkit for custom fonts
  pdfDoc.registerFontkit(fontkit);
  
  // Fetch and embed Poppins fonts
  let regularFont, mediumFont, boldFont;
  try {
    const poppinsFonts = await fetchPoppinsFonts();
    regularFont = await pdfDoc.embedFont(poppinsFonts.regular);
    mediumFont = await pdfDoc.embedFont(poppinsFonts.medium);
    boldFont = await pdfDoc.embedFont(poppinsFonts.bold);
    console.log('[transform-document-design] Successfully embedded Poppins fonts (Regular, Medium, Bold)');
  } catch (e) {
    console.log('[transform-document-design] Failed to embed Poppins fonts, falling back to Helvetica:', e);
    regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    mediumFont = await pdfDoc.embedFont(StandardFonts.Helvetica); // Helvetica has no medium, use regular
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }
  const fonts = { regular: regularFont, medium: mediumFont, bold: boldFont };

  // Embed logo from element template if available
  let logoImage: any = null;
  if (elements.logo?.image_base64) {
    try {
      const bytes = fastBase64ToBytes(elements.logo.image_base64);
      // Try PNG first, then JPG
      try {
        logoImage = await pdfDoc.embedPng(bytes);
      } catch {
        logoImage = await pdfDoc.embedJpg(bytes);
      }
      console.log('[transform-document-design] Embedded logo from element template');
    } catch (e) {
      console.log('[transform-document-design] Could not embed logo from element template:', e);
    }
  }
  
  // Fallback to logoBytes if no element template logo
  if (!logoImage && logoBytes) {
    try {
      logoImage = await pdfDoc.embedJpg(logoBytes);
      console.log('[transform-document-design] Embedded logo from fallback bytes');
    } catch (e) {
      console.log('[transform-document-design] Could not embed fallback logo:', e);
    }
  }

  // DISABLED: Header/footer images cause CPU timeout due to size
  // Skip embedding header/footer images to avoid CPU limits
  const embeddedHeaderImage: any = null;
  let headerHeight = 40;
  if (elements.header?.image_base64) {
    console.log('[transform-document-design] SKIPPED header image (too CPU intensive) - using default header');
  }

  const embeddedFooterImage: any = null;
  let footerHeight = 40;
  if (elements.footer?.image_base64) {
    console.log('[transform-document-design] SKIPPED footer image (too CPU intensive) - using default footer');
  }

  // Content page background image - now enabled with size check (optimized images are ~8-100KB)
  let embeddedContentPageImage: any = null;
  if (elements.content_page?.image_base64) {
    const base64Size = elements.content_page.image_base64.length * 0.75;
    console.log(`[transform-document-design] Content page image size: ~${Math.round(base64Size / 1024)}KB`);
    
    if (base64Size > MAX_COVER_IMAGE_SIZE) {
      console.log(`[transform-document-design] Content page image too large - skipping`);
    } else {
      try {
        const bytes = fastBase64ToBytes(elements.content_page.image_base64);
        // Try PNG first, fallback to JPG
        try {
          embeddedContentPageImage = await pdfDoc.embedPng(bytes);
        } catch {
          embeddedContentPageImage = await pdfDoc.embedJpg(bytes);
        }
        console.log('[transform-document-design] ✓ Embedded content page background');
      } catch (e) {
        console.log('[transform-document-design] Could not embed content page image:', e);
      }
    }
  }

  const tocEntries = generateTOCEntries(extractedDoc.sections, fonts);

  // Build logo configs for each page type
  const coverLogoConfig = layoutConfig.cover ? {
    show: layoutConfig.cover.show_logo,
    x: layoutConfig.cover.logo_x,
    y: layoutConfig.cover.logo_y,
    height: layoutConfig.cover.logo_height || 40,
  } : null;
  
  const contentLogoConfig = layoutConfig.content ? {
    show: layoutConfig.content.show_logo,
    x: layoutConfig.content.logo_x,
    y: layoutConfig.content.logo_y,
    height: layoutConfig.content.logo_height || 24,
  } : null;
  
  const tocLogoConfig = layoutConfig.toc ? {
    show: layoutConfig.toc.show_logo,
    x: layoutConfig.toc.logo_x,
    y: layoutConfig.toc.logo_y,
    height: layoutConfig.toc.logo_height || 24,
  } : contentLogoConfig; // Fallback TOC to content config

  // Get logo original height from element template for proper scaling
  console.log(`[transform-document-design] Logo configs - cover: ${JSON.stringify(coverLogoConfig)}, content: ${JSON.stringify(contentLogoConfig)}, toc: ${JSON.stringify(tocLogoConfig)}`);
  console.log(`[transform-document-design] Footer configs - toc: ${JSON.stringify(footerConfigs.toc)}, content: ${JSON.stringify(footerConfigs.content)}`);

  // Estimate total pages (excluding cover page from count)
  // Total displayed pages = TOC + content pages (cover not numbered)
  const estimatedContentPages = Math.max(1, Math.ceil(extractedDoc.sections.filter(s => s.type === 'h1' || s.type === 'page-break').length + 1));
  const totalPages = 1 + estimatedContentPages; // TOC + content (cover not counted)
  
  // Cache for embedded footer images
  const embeddedFooterImages = new Map<string, any>();

  // Create cover page with logo (height comes from config) - no page number
  // Pass coverTitleConfig for split-color title rendering and confidential marking
  console.log(`[transform-document-design] Cover page: subtitle="${extractedDoc.subtitle}", title="${extractedDoc.title}", confidential=${coverTitleConfig?.showConfidential ?? false}`);
  await createCoverPageWithElements(pdfDoc, fonts, extractedDoc, elements.cover_background || null, elements.title || null, elements.subtitle || null, logoImage, coverLogoConfig, coverTitleConfig, coverTitleConfig?.showConfidential ?? false);
  
  // Create TOC page with logo and configurable footer
  // TOC is page 1 (cover not counted)
  await createTOCPage(pdfDoc, fonts, tocEntries, extractedDoc.isConfidential, logoImage, embeddedHeaderImage, headerHeight, embeddedFooterImage, footerHeight, tocLogoConfig, footerConfigs.toc || null, totalPages, 1, embeddedFooterImages);
  
  // Create content pages with logo and configurable footer (pass content_page image if using full page design)
  // Content pages start at page 2 (cover not counted)
  await createContentPages(pdfDoc, fonts, extractedDoc.sections, extractedDoc.isConfidential, logoImage, embeddedHeaderImage, headerHeight, embeddedFooterImage, footerHeight, {
    h1: elements.h1,
    h2: elements.h2,
    h3: elements.h3,
    paragraph: elements.paragraph,
    bullet: elements.bullet,
  }, contentLogoConfig, embeddedContentPageImage, footerConfigs.content || null, totalPages, 2, embeddedFooterImages);

  return await pdfDoc.save();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use anon client for auth verification
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    // Use service role for database queries to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RequestBody = await req.json();
    const { file, fileName, fileType, mode = 'extract', editedContent, coverTitleHighlightWordsOverride } = body;

    console.log(`[transform-document-design] Processing mode=${mode}, fileName=${fileName}, fileType=${fileType}, coverTitleHighlightWordsOverride=${coverTitleHighlightWordsOverride ?? 'none'}`);

    // Handle generate mode - use edited content directly
    let extractedDoc: ExtractedDocument;
    
    if (mode === 'generate' && editedContent) {
      console.log(`[transform-document-design] Using edited content with ${editedContent.sections?.length || 0} sections`);
      extractedDoc = editedContent;
    } else {
      // Extract mode - parse the file
      if (!file || !fileName || !fileType) {
        return new Response(
          JSON.stringify({ 
            error: 'File, fileName, and fileType are required for extract mode',
            type: null,
            modifiedFile: null,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Now support both DOCX and PDF
      if (fileType !== 'docx' && fileType !== 'pdf') {
        return new Response(
          JSON.stringify({ 
            error: 'Only DOCX and PDF files are supported for transformation',
            type: null,
            modifiedFile: null,
            originalFileName: fileName,
            message: 'Please upload a DOCX or PDF file.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract document content based on file type
      if (fileType === 'docx') {
        extractedDoc = await extractDocxContent(file);
      } else {
        extractedDoc = await extractPdfContent(file);
      }
      
      // Add IDs to sections for editing
      extractedDoc.sections = extractedDoc.sections.map((section, index) => ({
        ...section,
        id: `section-${index}`,
      }));
    }

    // Fetch Sentra logo
    let logoBytes: Uint8Array | null = null;
    try {
      const logoResponse = await fetch('https://gmgrlphiopslkyxmuced.supabase.co/storage/v1/object/public/knowledge-files/sentra-logo.jpg');
      if (logoResponse.ok) {
        logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
      }
    } catch (e) {
      console.log('[transform-document-design] Could not fetch logo:', e);
    }

    // Try to fetch from document profile system first
    let elements: Record<string, ElementTemplate | null> = {
      cover_background: null,
      header: null,
      footer: null,
      logo: null,
      content_page: null,
      title: null,
      subtitle: null,
      h1: null,
      h2: null,
      h3: null,
      paragraph: null,
      bullet: null,
      toc_title: null,
      toc_entry: null,
    };

    // Store layout configs for PDF generation
    let layoutConfigForPdf: {
      cover?: { show_logo: boolean; logo_x: number; logo_y: number; } | null;
      content?: { show_logo: boolean; logo_x: number; logo_y: number; } | null;
      toc?: { show_logo: boolean; logo_x: number; logo_y: number; } | null;
    } = {};

    // Store footer configs for PDF generation
    let footerConfigsForPdf: {
      toc?: FooterConfig | null;
      content?: FooterConfig | null;
    } = {};

    // Store cover title config for split-color rendering
    let coverTitleConfigForPdf: CoverTitleConfig | null = null;

    // First, try the new document profile system
    const { data: defaultProfile, error: profileError } = await supabase
      .from('document_profiles')
      .select('id, name')
      .eq('is_default', true)
      .single();

    if (profileError) {
      console.log(`[transform-document-design] Error fetching default profile:`, profileError.message);
    }

    if (defaultProfile) {
      console.log(`[transform-document-design] ✓ Found default document profile: "${defaultProfile.name}" (${defaultProfile.id})`);
      
      // Fetch page layouts for this profile
      const { data: pageLayouts, error: layoutError } = await supabase
        .from('page_layouts')
        .select('*')
        .eq('profile_id', defaultProfile.id);

      if (layoutError) {
        console.log(`[transform-document-design] Error fetching page layouts:`, layoutError.message);
      }

      console.log(`[transform-document-design] Page layouts found: ${pageLayouts?.length || 0}`);
      if (pageLayouts) {
        for (const layout of pageLayouts) {
          console.log(`[transform-document-design]   - ${layout.page_type}: bg=${layout.background_element_id || 'none'}, header=${layout.header_element_id || 'none'}, footer=${layout.footer_element_id || 'none'}, logo=${layout.logo_element_id || 'none'}`);
        }
      }

      // Collect all element IDs we need to fetch
      const elementIds = new Set<string>();
      const layoutMap: Record<string, any> = {};
      
      if (pageLayouts) {
        for (const layout of pageLayouts) {
          layoutMap[layout.page_type] = layout;
          if (layout.background_element_id) elementIds.add(layout.background_element_id);
          if (layout.header_element_id) elementIds.add(layout.header_element_id);
          if (layout.footer_element_id) elementIds.add(layout.footer_element_id);
          if (layout.logo_element_id) elementIds.add(layout.logo_element_id);
          if (layout.content_page_element_id) elementIds.add(layout.content_page_element_id);
        }
      }

      // Fetch text styles for all layouts
      const layoutIds = pageLayouts?.map(l => l.id) || [];
      let textStylesMap: Record<string, Record<string, string>> = {};
      
      if (layoutIds.length > 0) {
        const { data: textStyles, error: stylesError } = await supabase
          .from('page_text_styles')
          .select('*')
          .in('page_layout_id', layoutIds);

        if (stylesError) {
          console.log(`[transform-document-design] Error fetching text styles:`, stylesError.message);
        }

        console.log(`[transform-document-design] Text styles found: ${textStyles?.length || 0}`);

        if (textStyles) {
          for (const style of textStyles) {
            if (style.element_template_id) {
              elementIds.add(style.element_template_id);
              
              // Find which page type this layout belongs to
              const layout = pageLayouts?.find(l => l.id === style.page_layout_id);
              if (layout) {
                if (!textStylesMap[layout.page_type]) {
                  textStylesMap[layout.page_type] = {};
                }
                textStylesMap[layout.page_type][style.context] = style.element_template_id;
                console.log(`[transform-document-design]   - ${layout.page_type}/${style.context} -> element ${style.element_template_id}`);
              }
            }
          }
        }
      }

      console.log(`[transform-document-design] Total unique element IDs to fetch: ${elementIds.size}`);

      // Fetch all needed element templates
      if (elementIds.size > 0) {
        const { data: elementTemplates, error: elementsError } = await supabase
          .from('element_templates')
          .select('*')
          .in('id', Array.from(elementIds));

        if (elementsError) {
          console.log(`[transform-document-design] Error fetching element templates:`, elementsError.message);
        }

        console.log(`[transform-document-design] Element templates fetched: ${elementTemplates?.length || 0}`);
        if (elementTemplates) {
          for (const t of elementTemplates) {
            console.log(`[transform-document-design]   - "${t.name}" (${t.element_type}) id=${t.id}`);
          }
        }

        const templateById: Record<string, ElementTemplate> = {};
        if (elementTemplates) {
          for (const t of elementTemplates) {
            templateById[t.id] = t;
          }
        }

        // Map visual elements from layouts - use cover layout for cover-specific, content layout for rest
        const coverLayout = layoutMap['cover'];
        const contentLayout = layoutMap['content'];
        const tocLayout = layoutMap['toc'];

        console.log(`[transform-document-design] Layout mapping: cover=${coverLayout?.id || 'none'}, content=${contentLayout?.id || 'none'}, toc=${tocLayout?.id || 'none'}`);

        // Build layout config for PDF generation with logo positions and heights
        if (coverLayout) {
          layoutConfigForPdf.cover = {
            show_logo: coverLayout.show_logo ?? true,
            logo_x: coverLayout.logo_position_x ?? 50,
            logo_y: coverLayout.logo_position_y ?? 50,
            logo_height: coverLayout.logo_height ?? 40, // Larger default for cover
          };
          console.log(`[transform-document-design] Cover logo config: show=${layoutConfigForPdf.cover.show_logo}, x=${layoutConfigForPdf.cover.logo_x}, y=${layoutConfigForPdf.cover.logo_y}, height=${layoutConfigForPdf.cover.logo_height}`);
          
          // Extract cover title config for split-color rendering
          coverTitleConfigForPdf = {
            highlightWords: coverTitleHighlightWordsOverride ?? coverLayout.cover_title_highlight_words ?? 3,
            highlightColor: coverLayout.cover_title_highlight_color ?? '#39FF14',
            textColor: coverLayout.cover_title_text_color || '#FFFFFF',
            yOffset: coverLayout.cover_title_y_offset ?? 100,
            showConfidential: coverLayout.show_confidential ?? false,
          };
          console.log(`[transform-document-design] Cover title config: highlightWords=${coverTitleConfigForPdf.highlightWords} (override=${coverTitleHighlightWordsOverride ?? 'none'}), highlightColor=${coverTitleConfigForPdf.highlightColor}, textColor=${coverTitleConfigForPdf.textColor}, yOffset=${coverTitleConfigForPdf.yOffset}, showConfidential=${coverTitleConfigForPdf.showConfidential}`);
        }
        if (contentLayout) {
          layoutConfigForPdf.content = {
            show_logo: contentLayout.show_logo ?? true,
            logo_x: contentLayout.logo_position_x ?? 25,
            logo_y: contentLayout.logo_position_y ?? 8,
            logo_height: contentLayout.logo_height ?? 24, // Smaller for content pages
          };
          console.log(`[transform-document-design] Content logo config: show=${layoutConfigForPdf.content.show_logo}, x=${layoutConfigForPdf.content.logo_x}, y=${layoutConfigForPdf.content.logo_y}, height=${layoutConfigForPdf.content.logo_height}`);
        }
        if (tocLayout) {
          layoutConfigForPdf.toc = {
            show_logo: tocLayout.show_logo ?? true,
            logo_x: tocLayout.logo_position_x ?? 25,
            logo_y: tocLayout.logo_position_y ?? 8,
            logo_height: tocLayout.logo_height ?? 24,
          };
          console.log(`[transform-document-design] TOC logo config: show=${layoutConfigForPdf.toc.show_logo}, x=${layoutConfigForPdf.toc.logo_x}, y=${layoutConfigForPdf.toc.logo_y}, height=${layoutConfigForPdf.toc.logo_height}`);
        }

        // Extract footer configs from page layouts
        const extractFooterConfig = (layout: any): FooterConfig | null => {
          if (!layout) return null;
          // Check if any footer section is configured
          const hasFooterConfig = layout.footer_show_separator || 
            layout.footer_left_type !== 'none' || 
            layout.footer_middle_type !== 'none' || 
            layout.footer_right_type !== 'none';
          
          if (!hasFooterConfig && !layout.footer_show_separator) return null;
          
          return {
            showSeparator: layout.footer_show_separator ?? false,
            separatorColor: layout.footer_separator_color ?? '#CCCCCC',
            separatorThickness: layout.footer_separator_thickness ?? 1,
            leftType: (layout.footer_left_type as FooterSectionType) ?? 'none',
            leftText: layout.footer_left_text ?? null,
            leftImageBase64: layout.footer_left_image_base64 ?? null,
            leftImageMime: layout.footer_left_image_mime ?? null,
            leftPageNumberFormat: (layout.footer_left_page_number_format as PageNumberFormat) ?? 'full',
            middleType: (layout.footer_middle_type as FooterSectionType) ?? 'none',
            middleText: layout.footer_middle_text ?? null,
            middleImageBase64: layout.footer_middle_image_base64 ?? null,
            middleImageMime: layout.footer_middle_image_mime ?? null,
            middlePageNumberFormat: (layout.footer_middle_page_number_format as PageNumberFormat) ?? 'full',
            rightType: (layout.footer_right_type as FooterSectionType) ?? 'none',
            rightText: layout.footer_right_text ?? null,
            rightImageBase64: layout.footer_right_image_base64 ?? null,
            rightImageMime: layout.footer_right_image_mime ?? null,
            rightPageNumberFormat: (layout.footer_right_page_number_format as PageNumberFormat) ?? 'full',
          };
        };

        footerConfigsForPdf.toc = extractFooterConfig(tocLayout);
        footerConfigsForPdf.content = extractFooterConfig(contentLayout);
        
        console.log(`[transform-document-design] Footer configs extracted - TOC: ${footerConfigsForPdf.toc ? 'configured' : 'default'}, Content: ${footerConfigsForPdf.content ? 'configured' : 'default'}`);

        // Cover page elements
        if (coverLayout?.background_element_id && templateById[coverLayout.background_element_id]) {
          elements.cover_background = templateById[coverLayout.background_element_id];
          console.log(`[transform-document-design] ✓ cover_background from profile: "${elements.cover_background.name}"`);
        }
        if (coverLayout?.logo_element_id && templateById[coverLayout.logo_element_id]) {
          elements.logo = templateById[coverLayout.logo_element_id];
          console.log(`[transform-document-design] ✓ logo from profile: "${elements.logo.name}"`);
        }
        // Also check content layout for logo if cover doesn't have one
        if (!elements.logo && contentLayout?.logo_element_id && templateById[contentLayout.logo_element_id]) {
          elements.logo = templateById[contentLayout.logo_element_id];
          console.log(`[transform-document-design] ✓ logo from content layout: "${elements.logo.name}"`);
        }

        // Content page elements (header/footer for content pages, or full page design)
        if (contentLayout?.content_page_element_id && templateById[contentLayout.content_page_element_id]) {
          elements.content_page = templateById[contentLayout.content_page_element_id];
          console.log(`[transform-document-design] ✓ content_page from profile: "${elements.content_page.name}"`);
        }
        if (contentLayout?.header_element_id && templateById[contentLayout.header_element_id]) {
          elements.header = templateById[contentLayout.header_element_id];
          console.log(`[transform-document-design] ✓ header from profile: "${elements.header.name}"`);
        }
        if (contentLayout?.footer_element_id && templateById[contentLayout.footer_element_id]) {
          elements.footer = templateById[contentLayout.footer_element_id];
          console.log(`[transform-document-design] ✓ footer from profile: "${elements.footer.name}"`);
        }

        // Text styles - prioritize content layout for body text
        const contentStyles = textStylesMap['content'] || {};
        const coverStyles = textStylesMap['cover'] || {};
        const tocStyles = textStylesMap['toc'] || {};

        console.log(`[transform-document-design] Text style mappings: cover=${JSON.stringify(coverStyles)}, content=${JSON.stringify(contentStyles)}, toc=${JSON.stringify(tocStyles)}`);

        // Title/subtitle from cover
        if (coverStyles['title'] && templateById[coverStyles['title']]) {
          elements.title = templateById[coverStyles['title']];
          console.log(`[transform-document-design] ✓ title from profile: "${elements.title.name}"`);
        }
        if (coverStyles['subtitle'] && templateById[coverStyles['subtitle']]) {
          elements.subtitle = templateById[coverStyles['subtitle']];
          console.log(`[transform-document-design] ✓ subtitle from profile: "${elements.subtitle.name}"`);
        }

        // Heading/paragraph styles from content
        if (contentStyles['h1'] && templateById[contentStyles['h1']]) {
          elements.h1 = templateById[contentStyles['h1']];
          console.log(`[transform-document-design] ✓ h1 from profile: "${elements.h1.name}"`);
        }
        if (contentStyles['h2'] && templateById[contentStyles['h2']]) {
          elements.h2 = templateById[contentStyles['h2']];
          console.log(`[transform-document-design] ✓ h2 from profile: "${elements.h2.name}"`);
        }
        if (contentStyles['h3'] && templateById[contentStyles['h3']]) {
          elements.h3 = templateById[contentStyles['h3']];
          console.log(`[transform-document-design] ✓ h3 from profile: "${elements.h3.name}"`);
        }
        if (contentStyles['paragraph'] && templateById[contentStyles['paragraph']]) {
          elements.paragraph = templateById[contentStyles['paragraph']];
          console.log(`[transform-document-design] ✓ paragraph from profile: "${elements.paragraph.name}"`);
        }
        if (contentStyles['bullet'] && templateById[contentStyles['bullet']]) {
          elements.bullet = templateById[contentStyles['bullet']];
          console.log(`[transform-document-design] ✓ bullet from profile: "${elements.bullet.name}"`);
        }

        // TOC styles
        if (tocStyles['toc_title'] && templateById[tocStyles['toc_title']]) {
          elements.toc_title = templateById[tocStyles['toc_title']];
          console.log(`[transform-document-design] ✓ toc_title from profile: "${elements.toc_title.name}"`);
        }
        if (tocStyles['toc_entry'] && templateById[tocStyles['toc_entry']]) {
          elements.toc_entry = templateById[tocStyles['toc_entry']];
          console.log(`[transform-document-design] ✓ toc_entry from profile: "${elements.toc_entry.name}"`);
        }
      }
    } else {
      console.log(`[transform-document-design] ⚠ No default document profile found, will use fallback defaults`);
    }

    // Fallback: If no profile or missing elements, use default element templates
    const { data: defaultElementTemplates } = await supabase
      .from('element_templates')
      .select('*')
      .eq('is_default', true);

    console.log(`[transform-document-design] Fallback default element templates available: ${defaultElementTemplates?.length || 0}`);

    if (defaultElementTemplates) {
      for (const template of defaultElementTemplates) {
        // Only use defaults if not already set from profile
        if (!elements[template.element_type]) {
          elements[template.element_type] = template;
          console.log(`[transform-document-design] ⚠ Using fallback for ${template.element_type}: "${template.name}"`);
        }
      }
    }

    // Final summary of what we're using
    console.log(`[transform-document-design] === FINAL ELEMENTS ===`);
    for (const [key, value] of Object.entries(elements)) {
      if (value) {
        console.log(`[transform-document-design]   ${key}: "${value.name}" (${value.id})`);
      } else {
        console.log(`[transform-document-design]   ${key}: NULL (no element)`);
      }
    }

    // Build layout config from stored layoutMap (need to extract from if block)
    // We need to store layoutMap outside, so let's define it at the top
    
    // Generate PDF with element templates, layout config, footer configs, and cover title config
    const pdfBytes = await generatePDF(extractedDoc, logoBytes, {
      cover_background: elements['cover_background'] || null,
      header: elements['header'] || null,
      footer: elements['footer'] || null,
      logo: elements['logo'] || null,
      content_page: elements['content_page'] || null,
      title: elements['title'] || null,
      h1: elements['h1'] || null,
      h2: elements['h2'] || null,
      h3: elements['h3'] || null,
      paragraph: elements['paragraph'] || null,
      bullet: elements['bullet'] || null,
    }, layoutConfigForPdf, footerConfigsForPdf, coverTitleConfigForPdf);
    
    // Convert to base64 using fast method
    const pdfBase64 = fastBytesToBase64(pdfBytes);

    const outputFileName = (fileName || 'document').replace(/\.(docx|pdf)$/i, '_branded.pdf');
    
    // Calculate approximate page count from sections
    const pageCount = extractedDoc.sections.filter(s => s.type === 'h1' || s.type === 'page-break').length + 2;

    return new Response(
      JSON.stringify({
        type: 'pdf',
        modifiedFile: pdfBase64,
        originalFileName: outputFileName,
        message: `Document transformed successfully with Sentra branding. ${mode === 'generate' ? 'Generated from edited content.' : `Extracted ${extractedDoc.sections.filter(s => s.type === 'image').length} images.`}`,
        extractedContent: mode === 'extract' ? extractedDoc : undefined,
        pageCount: pageCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[transform-document-design] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        type: null,
        modifiedFile: null,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
