import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sentra brand colors (RGB 0-1 scale)
const COLORS = {
  primary: rgb(57/255, 255/255, 20/255),      // #39FF14 Neon Green
  pink: rgb(255/255, 20/255, 147/255),        // #FF1493
  cyan: rgb(0/255, 255/255, 255/255),         // #00FFFF
  yellow: rgb(255/255, 215/255, 0/255),       // #FFD700
  black: rgb(5/255, 5/255, 5/255),            // #050505
  white: rgb(1, 1, 1),
  gray: rgb(107/255, 114/255, 128/255),       // #6B7280
  lightGray: rgb(156/255, 163/255, 175/255),  // #9CA3AF
  darkGray: rgb(31/255, 41/255, 55/255),      // #1F2937
  textGray: rgb(55/255, 65/255, 81/255),      // #374151
};

interface BrandSettings {
  primaryColor: string;
  secondaryColor: string;
  accentPink: string;
  accentCyan: string;
  backgroundColor: string;
  textColor: string;
  headingFont: string;
  headingWeight: string;
  bodyFont: string;
  bodyWeight: string;
}

interface RequestBody {
  file: string;
  fileName: string;
  fileType: string;
  settings: BrandSettings;
}

interface ExtractedSection {
  type: 'heading' | 'paragraph';
  text: string;
  level?: number;
}

interface ExtractedDocument {
  title: string;
  subtitle: string;
  sections: ExtractedSection[];
  isConfidential: boolean;
}

interface TOCEntry {
  title: string;
  page: number;
  level: number;
  number: string;
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

// Sanitize text for WinAnsi encoding (replace non-ASCII characters with ASCII equivalents)
function sanitizeForPdf(text: string): string {
  return text
    // Non-breaking hyphen and other hyphens
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
    // Various quotes
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    // Ellipsis
    .replace(/\u2026/g, '...')
    // Bullets and other symbols
    .replace(/[\u2022\u2023\u2043\u25CF\u25E6\u25AA\u25AB]/g, '-')
    // Spaces
    .replace(/[\u00A0\u2002\u2003\u2009]/g, ' ')
    // Arrows
    .replace(/[\u2190-\u21FF]/g, '->')
    // Copyright, trademark, registered
    .replace(/\u00A9/g, '(c)')
    .replace(/\u00AE/g, '(R)')
    .replace(/\u2122/g, '(TM)')
    // Degree symbol
    .replace(/\u00B0/g, ' deg')
    // Plus/minus
    .replace(/\u00B1/g, '+/-')
    // Multiplication
    .replace(/\u00D7/g, 'x')
    // Division
    .replace(/\u00F7/g, '/')
    // Any remaining non-ASCII characters - replace with space
    .replace(/[^\x00-\x7F]/g, ' ');
}

// Extract content from DOCX
async function extractDocxContent(base64Content: string): Promise<ExtractedDocument> {
  console.log('[transform-document-design] Extracting content from DOCX');
  
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const zip = await JSZip.loadAsync(bytes);
  
  const sections: ExtractedSection[] = [];
  let title = '';
  let subtitle = '';
  let isConfidential = false;

  const documentFile = zip.file('word/document.xml');
  if (documentFile) {
    const documentXml = await documentFile.async('string');
    
    if (documentXml.toLowerCase().includes('confidential')) {
      isConfidential = true;
    }

    const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    const styleRegex = /<w:pStyle w:val="([^"]*)"/;
    
    let match;
    let foundTitle = false;
    
    while ((match = paragraphRegex.exec(documentXml)) !== null) {
      const paragraphContent = match[1];
      
      let paragraphText = '';
      const textMatches = paragraphContent.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      for (const tm of textMatches) {
        paragraphText += tm[1];
      }
      
      paragraphText = decodeHtmlEntities(paragraphText.trim());
      if (!paragraphText) continue;
      
      // FIX 4: Filter out original "Contents" section from source DOCX
      const lowerText = paragraphText.toLowerCase();
      if (lowerText === 'contents' || 
          lowerText === 'table of contents' ||
          (lowerText.includes('contents') && paragraphText.length < 25)) {
        continue;
      }
      
      const styleMatch = styleRegex.exec(paragraphContent);
      const styleName = styleMatch ? styleMatch[1] : '';
      
      let isHeading = false;
      let headingLevel = 0;
      
      if (styleName.match(/Heading1|Title/i) || paragraphContent.includes('w:outlineLvl w:val="0"')) {
        isHeading = true;
        headingLevel = 1;
        if (!foundTitle && paragraphText.length > 10 && 
            !paragraphText.toUpperCase().includes('WHITEPAPER') &&
            !paragraphText.toUpperCase().includes('WHITE PAPER')) {
          title = paragraphText;
          foundTitle = true;
        }
      } else if (styleName.match(/Heading2|Subtitle/i) || paragraphContent.includes('w:outlineLvl w:val="1"')) {
        isHeading = true;
        headingLevel = 2;
        if (!foundTitle && paragraphText.length > 15) {
          title = paragraphText;
          foundTitle = true;
        }
      } else if (styleName.match(/Heading3/i) || paragraphContent.includes('w:outlineLvl w:val="2"')) {
        isHeading = true;
        headingLevel = 3;
      }
      
      if (paragraphText.length < 2) continue;
      if (/^\d+$/.test(paragraphText) || paragraphText.toLowerCase() === 'sentra') continue;
      if (paragraphText.toUpperCase() === 'WHITEPAPER' || 
          paragraphText.toUpperCase() === 'WHITE PAPER' ||
          paragraphText.toUpperCase() === 'TECHNICAL WHITEPAPER') continue;
      
      sections.push({
        type: isHeading ? 'heading' : 'paragraph',
        text: paragraphText,
        level: isHeading ? headingLevel : undefined,
      });
    }
  }

  if (!title && sections.length > 0) {
    const firstHeading = sections.find(s => s.type === 'heading' && s.text.length > 10);
    if (firstHeading) {
      title = firstHeading.text;
    }
  }

  // FIX: Filter out document title from sections so it doesn't appear as Chapter 1
  // The title is displayed on the cover page, not in the content
  let filteredSections = sections;
  if (title) {
    const titleLower = title.toLowerCase().trim();
    filteredSections = sections.filter((s, i) => {
      // Remove first heading if it matches the document title
      if (i === 0 && s.type === 'heading' && s.level === 1) {
        const sectionLower = s.text.toLowerCase().trim();
        if (sectionLower === titleLower || titleLower.includes(sectionLower) || sectionLower.includes(titleLower)) {
          return false;
        }
      }
      return true;
    });
  }

  console.log(`[transform-document-design] Extracted ${filteredSections.length} sections, title: "${title}"`);
  
  return { title, subtitle, sections: filteredSections, isConfidential };
}

// Helper to wrap text into lines (with sanitization)
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

// FIX 2: Truncate title with ellipsis if too long
function truncateTitle(text: string, font: any, fontSize: number, maxWidth: number): string {
  const sanitized = sanitizeForPdf(text);
  if (font.widthOfTextAtSize(sanitized, fontSize) <= maxWidth) {
    return sanitized;
  }
  
  let truncated = sanitized;
  while (truncated.length > 0 && font.widthOfTextAtSize(truncated + '...', fontSize) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

// Draw the colored footer bar
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

// Draw header with green underline
function drawHeader(page: any, fonts: any) {
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 50;
  const headerY = height - 40;

  // sentra text
  page.drawText('sentra', {
    x: margin,
    y: headerY,
    size: 14,
    font: fonts.bold,
    color: COLORS.black,
  });

  // | WHITEPAPER
  const sentraWidth = fonts.bold.widthOfTextAtSize('sentra', 14);
  page.drawText(' | WHITEPAPER', {
    x: margin + sentraWidth,
    y: headerY,
    size: 14,
    font: fonts.regular,
    color: COLORS.gray,
  });

  // Green underline
  page.drawRectangle({
    x: margin,
    y: headerY - 8,
    width: width - margin * 2,
    height: 2,
    color: COLORS.primary,
  });
}

// Draw footer with copyright
function drawFooter(page: any, fonts: any) {
  const width = page.getWidth();
  const margin = 50;
  const footerY = 30;

  page.drawText('© 2025 Sentra Inc. All rights reserved.', {
    x: margin,
    y: footerY,
    size: 9,
    font: fonts.regular,
    color: COLORS.lightGray,
  });

  page.drawText('www.sentra.io', {
    x: width - margin - fonts.regular.widthOfTextAtSize('www.sentra.io', 9),
    y: footerY,
    size: 9,
    font: fonts.regular,
    color: COLORS.primary,
  });
}

// Create cover page
function createCoverPage(pdfDoc: any, fonts: any, data: ExtractedDocument) {
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 50;

  // Sentra logo text
  page.drawText('sentra', {
    x: margin,
    y: height - 60,
    size: 28,
    font: fonts.bold,
    color: COLORS.black,
  });

  // Confidential badge (top right)
  if (data.isConfidential) {
    const confText = sanitizeForPdf('CONFIDENTIAL - Internal Use Only');
    page.drawText(confText, {
      x: width - margin - fonts.regular.widthOfTextAtSize(confText, 10),
      y: height - 60,
      size: 10,
      font: fonts.regular,
      color: COLORS.gray,
    });
  }

  // Category badge - draw circle instead of bullet text
  const categoryY = height - 200;
  page.drawCircle({
    x: margin + 4,
    y: categoryY + 4,
    size: 4,
    color: COLORS.primary,
  });
  page.drawText('TECHNICAL WHITEPAPER', {
    x: margin + 15,
    y: categoryY,
    size: 13,
    font: fonts.bold,
    color: COLORS.primary,
  });

  // Main title (wrapped)
  const titleLines = wrapText(data.title || 'Untitled Document', fonts.bold, 36, width - margin * 2);
  let titleY = categoryY - 50;
  for (const line of titleLines) {
    page.drawText(line, {
      x: margin,
      y: titleY,
      size: 36,
      font: fonts.bold,
      color: COLORS.black,
    });
    titleY -= 44;
  }

  // Metadata grid
  const metaY = 280;
  const col1X = margin;
  const col2X = width / 2;
  const labelSize = 9;
  const valueSize = 12;
  const rowHeight = 45;

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Row 1: Prepared For, Version
  page.drawText('PREPARED FOR', { x: col1X, y: metaY, size: labelSize, font: fonts.regular, color: COLORS.gray });
  page.drawText('Enterprise Customers', { x: col1X, y: metaY - 16, size: valueSize, font: fonts.bold, color: COLORS.black });
  
  page.drawText('VERSION', { x: col2X, y: metaY, size: labelSize, font: fonts.regular, color: COLORS.gray });
  page.drawText('v1.0', { x: col2X, y: metaY - 16, size: valueSize, font: fonts.bold, color: COLORS.black });

  // Row 2: Author, Date
  page.drawText('AUTHOR', { x: col1X, y: metaY - rowHeight, size: labelSize, font: fonts.regular, color: COLORS.gray });
  page.drawText('Sentra, Inc.', { x: col1X, y: metaY - rowHeight - 16, size: valueSize, font: fonts.bold, color: COLORS.black });
  
  page.drawText('DATE', { x: col2X, y: metaY - rowHeight, size: labelSize, font: fonts.regular, color: COLORS.gray });
  page.drawText(today, { x: col2X, y: metaY - rowHeight - 16, size: valueSize, font: fonts.bold, color: COLORS.black });

  // SYSTEM_SECURE badge - draw circle instead of bullet text
  page.drawCircle({ x: margin + 3, y: 103, size: 3, color: COLORS.primary });
  page.drawText('SYSTEM_SECURE', { x: margin + 12, y: 100, size: 8, font: fonts.regular, color: COLORS.gray });

  // Colored footer bar
  drawFooterBar(page);
}

// Create TOC page
function createTOCPage(pdfDoc: any, fonts: any, tocEntries: TOCEntry[]) {
  const page = pdfDoc.addPage([612, 792]);
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 50;

  drawHeader(page, fonts);

  // TOC Title
  const titleY = height - 100;
  page.drawText('Table of ', {
    x: margin,
    y: titleY,
    size: 28,
    font: fonts.bold,
    color: COLORS.black,
  });
  const tableOfWidth = fonts.bold.widthOfTextAtSize('Table of ', 28);
  page.drawText('Contents', {
    x: margin + tableOfWidth,
    y: titleY,
    size: 28,
    font: fonts.bold,
    color: COLORS.primary,
  });

  // TOC entries
  let y = titleY - 60;
  const lineHeight = 28;
  const indent = 20;

  for (let i = 0; i < tocEntries.length; i++) {
    const entry = tocEntries[i];
    const isMainHeading = entry.level === 1;
    const xOffset = isMainHeading ? 0 : indent;
    const textFont = isMainHeading ? fonts.bold : fonts.regular;
    const fontSize = 11;

    // FIX 1: Remove bullets - only use numbers
    // Number in green
    page.drawText(entry.number, {
      x: margin + xOffset,
      y: y,
      size: fontSize,
      font: fonts.bold,
      color: COLORS.primary,
    });

    // FIX 2: Truncate long titles with ellipsis
    const numberWidth = fonts.bold.widthOfTextAtSize(entry.number + ' ', fontSize);
    const pageNumReserve = 60; // Space for page number + dots
    const maxTitleWidth = width - margin - xOffset - numberWidth - pageNumReserve;
    const displayTitle = truncateTitle(entry.title, textFont, fontSize, maxTitleWidth);
    
    page.drawText(displayTitle, {
      x: margin + xOffset + numberWidth,
      y: y,
      size: fontSize,
      font: textFont,
      color: COLORS.black,
    });

    // Page number
    const pageNumText = entry.page.toString();
    const pageNumX = width - margin - fonts.regular.widthOfTextAtSize(pageNumText, fontSize);
    page.drawText(pageNumText, {
      x: pageNumX,
      y: y,
      size: fontSize,
      font: fonts.regular,
      color: COLORS.gray,
    });

    // Dot leader
    const titleWidth = textFont.widthOfTextAtSize(displayTitle, fontSize);
    const dotsStartX = margin + xOffset + numberWidth + titleWidth + 10;
    const dotsEndX = pageNumX - 10;
    const dotSpacing = 4;
    for (let dotX = dotsStartX; dotX < dotsEndX; dotX += dotSpacing) {
      page.drawText('.', {
        x: dotX,
        y: y,
        size: fontSize,
        font: fonts.regular,
        color: COLORS.lightGray,
      });
    }

    y -= lineHeight;

    // Add separator line between main sections
    if (isMainHeading && i < tocEntries.length - 1) {
      const nextEntry = tocEntries[i + 1];
      if (nextEntry.level === 1) {
        page.drawRectangle({
          x: margin,
          y: y + lineHeight / 2,
          width: width - margin * 2,
          height: 0.5,
          color: COLORS.lightGray,
        });
      }
    }
  }

  drawFooter(page, fonts);
}

// FIX: Only include H1 chapters in TOC (not H2/H3) and calculate accurate page numbers
function generateTOCEntries(sections: ExtractedSection[], fonts: any): TOCEntry[] {
  const entries: TOCEntry[] = [];
  let chapterNum = 0;
  
  // Simulate content page layout to get accurate page numbers
  const pageHeight = 792;
  const margin = 50;
  const minY = 100;
  const startY = pageHeight - 100;
  const bodyFontSize = 11;
  const lineHeight = 18;
  const contentWidth = 612 - margin * 2;
  
  let simulatedY = startY;
  let simulatedPage = 3; // Start after cover + TOC
  let isFirstChapter = true;

  for (const section of sections) {
    if (section.type === 'heading') {
      if (section.level === 1) {
        chapterNum++;
        
        // Page break before new H1 chapter (except first)
        if (!isFirstChapter) {
          simulatedPage++;
          simulatedY = startY;
        }
        isFirstChapter = false;
        
        // Only H1 chapters go in TOC
        entries.push({
          title: section.text,
          page: simulatedPage,
          level: 1,
          number: `${chapterNum}.`,
        });
        
        simulatedY -= 45;
      } else if (section.level === 2) {
        // H2 takes space but not in TOC
        if (simulatedY < minY + 100) {
          simulatedPage++;
          simulatedY = startY;
        }
        simulatedY -= 45;
      } else if (section.level === 3) {
        if (simulatedY < minY + 50) {
          simulatedPage++;
          simulatedY = startY;
        }
        simulatedY -= 30;
      }
    } else {
      // Simulate paragraph text wrapping
      const lines = wrapText(section.text, fonts.regular, bodyFontSize, contentWidth);
      
      for (const _line of lines) {
        if (simulatedY < minY) {
          simulatedPage++;
          simulatedY = startY;
        }
        simulatedY -= lineHeight;
      }
      simulatedY -= 10;
    }
  }

  return entries;
}

// Create content pages - FIX 3: Smart page breaks (only on H1)
function createContentPages(pdfDoc: any, fonts: any, sections: ExtractedSection[]) {
  let currentPage = pdfDoc.addPage([612, 792]);
  let y = currentPage.getHeight() - 100;
  const margin = 50;
  const contentWidth = currentPage.getWidth() - margin * 2;
  const bodyFontSize = 11;
  const lineHeight = 18;
  const minY = 100; // FIX 6: Increased from 80 to 100

  drawHeader(currentPage, fonts);

  let chapterNum = 0;
  let subChapterNum = 0;
  let isFirstChapter = true;

  for (const section of sections) {
    // Check if we need a new page for minimum content space
    if (y < minY + 100) {
      drawFooter(currentPage, fonts);
      currentPage = pdfDoc.addPage([612, 792]);
      y = currentPage.getHeight() - 100;
      drawHeader(currentPage, fonts);
    }

    if (section.type === 'heading') {
      // FIX 3: Only H1 triggers page break
      if (section.level === 1) {
        chapterNum++;
        subChapterNum = 0;
        
        // Add page break before new H1 chapter (except first)
        if (!isFirstChapter) {
          drawFooter(currentPage, fonts);
          currentPage = pdfDoc.addPage([612, 792]);
          y = currentPage.getHeight() - 100;
          drawHeader(currentPage, fonts);
        }
        isFirstChapter = false;

        // FIX: Wrap long H1 headings to prevent overflow
        const headingPrefix = `${chapterNum}. `;
        const headingLines = wrapText(headingPrefix + section.text, fonts.bold, 20, contentWidth);
        
        for (let i = 0; i < headingLines.length; i++) {
          currentPage.drawText(headingLines[i], {
            x: margin,
            y: y,
            size: 20,
            font: fonts.bold,
            color: COLORS.primary,
          });
          
          // Green underline only on first line
          if (i === 0) {
            const headingWidth = Math.min(fonts.bold.widthOfTextAtSize(headingLines[i], 20), 200);
            currentPage.drawRectangle({
              x: margin,
              y: y - 6,
              width: headingWidth,
              height: 2,
              color: COLORS.primary,
            });
          }
          y -= 26;
        }
        y -= 19; // Additional spacing after heading
      } else if (section.level === 2) {
        // FIX: Wrap long H2 headings to prevent overflow
        subChapterNum++;
        const subHeadingPrefix = `${chapterNum}.${subChapterNum} `;
        const subHeadingLines = wrapText(subHeadingPrefix + section.text, fonts.bold, 15, contentWidth);
        
        for (const line of subHeadingLines) {
          currentPage.drawText(line, {
            x: margin,
            y: y,
            size: 15,
            font: fonts.bold,
            color: COLORS.darkGray,
          });
          y -= 20;
        }
        y -= 15;
      } else if (section.level === 3) {
        // FIX: Wrap long H3 headings to prevent overflow
        subChapterNum++;
        const h3Prefix = `${chapterNum}.${subChapterNum} `;
        const h3Lines = wrapText(h3Prefix + section.text, fonts.bold, 13, contentWidth);
        
        for (const line of h3Lines) {
          currentPage.drawText(line, {
            x: margin,
            y: y,
            size: 13,
            font: fonts.bold,
            color: COLORS.black,
          });
          y -= 18;
        }
        y -= 12;
      }
    } else {
      // Paragraph text
      const lines = wrapText(section.text, fonts.regular, bodyFontSize, contentWidth);
      
      for (const line of lines) {
        if (y < minY) {
          drawFooter(currentPage, fonts);
          currentPage = pdfDoc.addPage([612, 792]);
          y = currentPage.getHeight() - 100;
          drawHeader(currentPage, fonts);
        }

        currentPage.drawText(line, {
          x: margin,
          y: y,
          size: bodyFontSize,
          font: fonts.regular,
          color: COLORS.textGray,
        });
        y -= lineHeight;
      }
      
      y -= 10; // Extra spacing after paragraph
    }
  }

  drawFooter(currentPage, fonts);
}

// Main PDF generation function
async function generatePDF(extractedDoc: ExtractedDocument): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  // Embed fonts
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const fonts = {
    regular: regularFont,
    bold: boldFont,
  };

  // FIX 5: Generate TOC entries with accurate page numbers (needs fonts for text measurement)
  const tocEntries = generateTOCEntries(extractedDoc.sections, fonts);

  // Create pages
  createCoverPage(pdfDoc, fonts, extractedDoc);
  createTOCPage(pdfDoc, fonts, tocEntries);
  createContentPages(pdfDoc, fonts, extractedDoc.sections);

  return await pdfDoc.save();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RequestBody = await req.json();
    const { file, fileName, fileType } = body;

    console.log(`[transform-document-design] Processing ${fileName} (${fileType})`);

    if (fileType !== 'docx') {
      return new Response(
        JSON.stringify({ 
          error: 'Only DOCX files are supported for PDF transformation',
          type: null,
          modifiedFile: null,
          originalFileName: fileName,
          message: 'Please upload a DOCX file.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract content from DOCX
    const extractedDoc = await extractDocxContent(file);
    
    console.log(`[transform-document-design] Generating PDF from extracted content`);

    // Generate PDF
    const pdfBytes = await generatePDF(extractedDoc);
    
    // Convert to base64
    let base64 = '';
    const chunkSize = 8192;
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      const chunk = pdfBytes.subarray(i, Math.min(i + chunkSize, pdfBytes.length));
      base64 += String.fromCharCode(...chunk);
    }
    const modifiedFile = btoa(base64);

    console.log(`[transform-document-design] PDF generated successfully`);

    return new Response(
      JSON.stringify({
        type: 'pdf',
        modifiedFile,
        originalFileName: fileName,
        message: 'Your document has been transformed into a branded PDF with Sentra styling.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[transform-document-design] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        type: null,
        modifiedFile: null,
        message: `Error transforming document: ${error.message}`
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
