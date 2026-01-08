import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Brand colors from the exact SVG template (RGB 0-1 scale)
const COLORS = {
  // Primary neon green from template #66FF66
  primary: rgb(102/255, 255/255, 102/255),
  // Orange accent from logo #FFAE1A
  orange: rgb(255/255, 174/255, 26/255),
  // Footer bar colors
  pink: rgb(255/255, 20/255, 147/255),        // #FF1493
  cyan: rgb(0/255, 255/255, 255/255),         // #00FFFF
  yellow: rgb(255/255, 215/255, 0/255),       // #FFD700
  // Backgrounds
  black: rgb(0, 0, 0),                        // #000000 Pure black
  white: rgb(1, 1, 1),
  // Text colors - from template #F0F0F0
  lightText: rgb(240/255, 240/255, 240/255),  // #F0F0F0
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

  let filteredSections = sections;
  if (title) {
    const titleLower = title.toLowerCase().trim();
    filteredSections = sections.filter((s, i) => {
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

// Truncate title with ellipsis if too long
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

// Draw the colored footer bar (4 segments: green, pink, yellow, cyan)
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

// Draw header with green underline (content pages)
function drawHeader(page: any, fonts: any) {
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 50;
  const headerY = height - 40;

  // sentra text in black
  page.drawText('sentra', {
    x: margin,
    y: headerY,
    size: 14,
    font: fonts.bold,
    color: COLORS.black,
  });

  // | WHITEPAPER in gray
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

  page.drawText('(c) 2025 Sentra Inc. All rights reserved.', {
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

// Draw Sentra logo (geometric design matching SVG template)
function drawSentraLogo(page: any, x: number, y: number, scale: number = 1) {
  const s = scale;
  
  // White/light gray squares pattern (simplified geometric logo)
  const lightColor = COLORS.lightText;
  
  // Top row rectangles
  page.drawRectangle({ x: x, y: y, width: 8 * s, height: 8 * s, color: lightColor });
  page.drawRectangle({ x: x + 12 * s, y: y, width: 20 * s, height: 8 * s, color: lightColor });
  
  // Bottom row rectangles  
  page.drawRectangle({ x: x, y: y - 24 * s, width: 20 * s, height: 8 * s, color: lightColor });
  page.drawRectangle({ x: x + 24 * s, y: y - 24 * s, width: 8 * s, height: 8 * s, color: lightColor });
  
  // Middle row rectangles
  page.drawRectangle({ x: x, y: y - 12 * s, width: 8 * s, height: 8 * s, color: lightColor });
  page.drawRectangle({ x: x + 24 * s, y: y - 12 * s, width: 8 * s, height: 8 * s, color: lightColor });
  
  // Orange circle in center
  page.drawCircle({
    x: x + 16 * s,
    y: y - 8 * s,
    size: 5 * s,
    color: COLORS.orange,
  });
}

// Create cover page (BLACK background, matching SVG template exactly)
function createCoverPage(pdfDoc: any, fonts: any, data: ExtractedDocument) {
  const page = pdfDoc.addPage([595, 814]); // A4 size matching SVG dimensions
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 56;

  // Black background (matching template)
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: height,
    color: COLORS.black,
  });

  // Draw Sentra logo at top left (matching position from SVG)
  drawSentraLogo(page, margin, height - 60, 1);

  // "Sentra" text next to logo
  page.drawText('Sentra', {
    x: margin + 50,
    y: height - 75,
    size: 20,
    font: fonts.bold,
    color: COLORS.lightText,
  });

  // Confidential badge (top right) if applicable
  if (data.isConfidential) {
    const confText = sanitizeForPdf('CONFIDENTIAL - Internal Use Only');
    page.drawText(confText, {
      x: width - margin - fonts.regular.widthOfTextAtSize(confText, 10),
      y: height - 75,
      size: 10,
      font: fonts.regular,
      color: COLORS.gray,
    });
  }

  // Title in neon green (matching template position ~y=355)
  const titleY = height - 440;
  const titleLines = wrapText(data.title || 'Document Title', fonts.bold, 32, width - margin * 2);
  let currentY = titleY;
  for (const line of titleLines) {
    page.drawText(line, {
      x: margin,
      y: currentY,
      size: 32,
      font: fonts.bold,
      color: COLORS.primary,
    });
    currentY -= 40;
  }

  // Colored footer bar at bottom
  drawFooterBar(page);
}

// Create TOC page (White background with header/footer)
function createTOCPage(pdfDoc: any, fonts: any, tocEntries: TOCEntry[]) {
  const page = pdfDoc.addPage([595, 814]);
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 56;

  // White background (default)

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

  for (let i = 0; i < tocEntries.length; i++) {
    const entry = tocEntries[i];
    const textFont = fonts.bold;
    const fontSize = 11;

    const pageNumReserve = 60;
    const maxTitleWidth = width - margin * 2 - pageNumReserve;
    const displayTitle = truncateTitle(entry.title, textFont, fontSize, maxTitleWidth);
    
    page.drawText(displayTitle, {
      x: margin,
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
    const dotsStartX = margin + titleWidth + 10;
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

    // Separator line between entries
    if (i < tocEntries.length - 1) {
      page.drawRectangle({
        x: margin,
        y: y + lineHeight / 2,
        width: width - margin * 2,
        height: 0.5,
        color: COLORS.lightGray,
      });
    }
  }

  drawFooter(page, fonts);
}

// Generate TOC entries - Only H1 chapters with accurate page numbers
function generateTOCEntries(sections: ExtractedSection[], fonts: any): TOCEntry[] {
  const entries: TOCEntry[] = [];
  
  const pageHeight = 814;
  const margin = 56;
  const minY = 100;
  const startY = pageHeight - 100;
  const bodyFontSize = 11;
  const lineHeight = 16;
  const contentWidth = 595 - margin * 2;
  
  let simulatedY = startY;
  let simulatedPage = 3;
  let hasContentOnPage = false;

  for (const section of sections) {
    if (section.type === 'heading') {
      if (section.level === 1) {
        if (hasContentOnPage) {
          simulatedPage++;
          simulatedY = startY;
          hasContentOnPage = false;
        }
        
        entries.push({
          title: section.text,
          page: simulatedPage,
          level: 1,
        });
        
        simulatedY -= 40;
        hasContentOnPage = true;
      } else if (section.level === 2) {
        if (simulatedY < minY + 80) {
          simulatedPage++;
          simulatedY = startY;
        }
        simulatedY -= 35;
        hasContentOnPage = true;
      } else if (section.level === 3) {
        if (simulatedY < minY + 50) {
          simulatedPage++;
          simulatedY = startY;
        }
        simulatedY -= 28;
        hasContentOnPage = true;
      }
    } else {
      const lines = wrapText(section.text, fonts.regular, bodyFontSize, contentWidth);
      
      for (const _line of lines) {
        if (simulatedY < minY) {
          simulatedPage++;
          simulatedY = startY;
        }
        simulatedY -= lineHeight;
      }
      simulatedY -= 12;
      hasContentOnPage = true;
    }
  }

  return entries;
}

// Create content pages - standardized spacing, smart page breaks
function createContentPages(pdfDoc: any, fonts: any, sections: ExtractedSection[]) {
  let currentPage = pdfDoc.addPage([595, 814]);
  let y = currentPage.getHeight() - 100;
  const margin = 56;
  const contentWidth = currentPage.getWidth() - margin * 2;
  const bodyFontSize = 11;
  const lineHeight = 16;
  const minY = 100;

  const SPACING = {
    afterH1: 20,
    afterH2: 16,
    afterH3: 12,
    afterParagraph: 12,
  };

  drawHeader(currentPage, fonts);

  let hasContentOnPage = false;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    if (y < minY + 60) {
      drawFooter(currentPage, fonts);
      currentPage = pdfDoc.addPage([595, 814]);
      y = currentPage.getHeight() - 100;
      drawHeader(currentPage, fonts);
      hasContentOnPage = false;
    }

    if (section.type === 'heading') {
      if (section.level === 1) {
        if (hasContentOnPage) {
          drawFooter(currentPage, fonts);
          currentPage = pdfDoc.addPage([595, 814]);
          y = currentPage.getHeight() - 100;
          drawHeader(currentPage, fonts);
          hasContentOnPage = false;
        }

        const headingLines = wrapText(section.text, fonts.bold, 20, contentWidth);
        
        for (let j = 0; j < headingLines.length; j++) {
          currentPage.drawText(headingLines[j], {
            x: margin,
            y: y,
            size: 20,
            font: fonts.bold,
            color: COLORS.primary,
          });
          
          if (j === 0) {
            const headingWidth = Math.min(fonts.bold.widthOfTextAtSize(headingLines[j], 20), 200);
            currentPage.drawRectangle({
              x: margin,
              y: y - 6,
              width: headingWidth,
              height: 2,
              color: COLORS.primary,
            });
          }
          y -= 24;
        }
        y -= SPACING.afterH1;
        hasContentOnPage = true;
      } else if (section.level === 2) {
        const subHeadingLines = wrapText(section.text, fonts.bold, 15, contentWidth);
        
        for (const line of subHeadingLines) {
          currentPage.drawText(line, {
            x: margin,
            y: y,
            size: 15,
            font: fonts.bold,
            color: COLORS.darkGray,
          });
          y -= 18;
        }
        y -= SPACING.afterH2;
        hasContentOnPage = true;
      } else if (section.level === 3) {
        const h3Lines = wrapText(section.text, fonts.bold, 13, contentWidth);
        
        for (const line of h3Lines) {
          currentPage.drawText(line, {
            x: margin,
            y: y,
            size: 13,
            font: fonts.bold,
            color: COLORS.black,
          });
          y -= 16;
        }
        y -= SPACING.afterH3;
        hasContentOnPage = true;
      }
    } else {
      const lines = wrapText(section.text, fonts.regular, bodyFontSize, contentWidth);
      
      for (const line of lines) {
        if (y < minY) {
          drawFooter(currentPage, fonts);
          currentPage = pdfDoc.addPage([595, 814]);
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
      
      y -= SPACING.afterParagraph;
      hasContentOnPage = true;
    }
  }

  drawFooter(currentPage, fonts);
}

// Main PDF generation function
async function generatePDF(extractedDoc: ExtractedDocument): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const fonts = {
    regular: regularFont,
    bold: boldFont,
  };

  const tocEntries = generateTOCEntries(extractedDoc.sections, fonts);

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

    const extractedDoc = await extractDocxContent(file);
    
    console.log(`[transform-document-design] Generating PDF from extracted content`);

    const pdfBytes = await generatePDF(extractedDoc);
    
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
