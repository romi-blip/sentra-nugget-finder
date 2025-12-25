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

  console.log(`[transform-document-design] Extracted ${sections.length} sections, title: "${title}"`);
  
  return { title, subtitle, sections, isConfidential };
}

// Helper to wrap text into lines
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
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
    page.drawText('CONFIDENTIAL — Internal Use Only', {
      x: width - margin - fonts.regular.widthOfTextAtSize('CONFIDENTIAL — Internal Use Only', 10),
      y: height - 60,
      size: 10,
      font: fonts.regular,
      color: COLORS.gray,
    });
  }

  // Category badge
  const categoryY = height - 200;
  page.drawText('●', {
    x: margin,
    y: categoryY,
    size: 12,
    font: fonts.regular,
    color: COLORS.primary,
  });
  page.drawText('  TECHNICAL WHITEPAPER', {
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

  // SYSTEM_SECURE badge
  page.drawText('●', { x: margin, y: 100, size: 8, font: fonts.regular, color: COLORS.primary });
  page.drawText(' SYSTEM_SECURE', { x: margin + 12, y: 100, size: 8, font: fonts.regular, color: COLORS.gray });

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
  const indent = 25;

  for (let i = 0; i < tocEntries.length; i++) {
    const entry = tocEntries[i];
    const isMainHeading = entry.level === 1;
    const xOffset = isMainHeading ? 0 : indent;
    const bulletColor = isMainHeading ? COLORS.primary : COLORS.lightGray;
    const textFont = isMainHeading ? fonts.bold : fonts.regular;
    const fontSize = 11;

    // Bullet
    page.drawText('●', {
      x: margin + xOffset,
      y: y,
      size: 8,
      font: fonts.regular,
      color: bulletColor,
    });

    // Number in green
    page.drawText(entry.number, {
      x: margin + xOffset + 15,
      y: y,
      size: fontSize,
      font: fonts.bold,
      color: COLORS.primary,
    });

    // Title
    const numberWidth = fonts.bold.widthOfTextAtSize(entry.number + ' ', fontSize);
    page.drawText(entry.title, {
      x: margin + xOffset + 15 + numberWidth,
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
    const titleWidth = textFont.widthOfTextAtSize(entry.title, fontSize);
    const dotsStartX = margin + xOffset + 15 + numberWidth + titleWidth + 10;
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

// Create content pages
function createContentPages(pdfDoc: any, fonts: any, sections: ExtractedSection[]) {
  let currentPage = pdfDoc.addPage([612, 792]);
  let y = currentPage.getHeight() - 100;
  const margin = 50;
  const contentWidth = currentPage.getWidth() - margin * 2;
  const bodyFontSize = 11;
  const lineHeight = 18;
  const minY = 80;

  drawHeader(currentPage, fonts);

  let chapterNum = 0;
  let subChapterNum = 0;
  let isFirstChapter = true;

  for (const section of sections) {
    // Check if we need a new page
    if (y < minY + 100) {
      drawFooter(currentPage, fonts);
      currentPage = pdfDoc.addPage([612, 792]);
      y = currentPage.getHeight() - 100;
      drawHeader(currentPage, fonts);
    }

    if (section.type === 'heading') {
      if (section.level === 1 || section.level === 2) {
        chapterNum++;
        subChapterNum = 0;
        
        // Add page break before new chapter (except first)
        if (!isFirstChapter) {
          drawFooter(currentPage, fonts);
          currentPage = pdfDoc.addPage([612, 792]);
          y = currentPage.getHeight() - 100;
          drawHeader(currentPage, fonts);
        }
        isFirstChapter = false;

        // Chapter heading in green
        const headingText = `${chapterNum}. ${section.text}`;
        currentPage.drawText(headingText, {
          x: margin,
          y: y,
          size: 20,
          font: fonts.bold,
          color: COLORS.primary,
        });

        // Green underline
        const headingWidth = Math.min(fonts.bold.widthOfTextAtSize(headingText, 20), 200);
        currentPage.drawRectangle({
          x: margin,
          y: y - 6,
          width: headingWidth,
          height: 2,
          color: COLORS.primary,
        });

        y -= 45;
      } else if (section.level === 3) {
        subChapterNum++;
        
        // Subheading
        const subHeadingText = `${chapterNum}.${subChapterNum} ${section.text}`;
        currentPage.drawText(subHeadingText, {
          x: margin,
          y: y,
          size: 13,
          font: fonts.bold,
          color: COLORS.black,
        });

        y -= 30;
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

// Generate TOC entries from sections
function generateTOCEntries(sections: ExtractedSection[]): TOCEntry[] {
  const entries: TOCEntry[] = [];
  let chapterNum = 0;
  let subChapterNum = 0;
  let pageNum = 3; // Start after cover + TOC

  for (const section of sections) {
    if (section.type === 'heading') {
      if (section.level === 1 || section.level === 2) {
        chapterNum++;
        subChapterNum = 0;
        entries.push({
          title: section.text,
          page: pageNum,
          level: 1,
          number: `${chapterNum}.`,
        });
        pageNum++; // Each main chapter starts new page
      } else if (section.level === 3) {
        subChapterNum++;
        entries.push({
          title: section.text,
          page: pageNum,
          level: 2,
          number: `${chapterNum}.${subChapterNum}`,
        });
      }
    }
  }

  return entries;
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

  // Generate TOC entries
  const tocEntries = generateTOCEntries(extractedDoc.sections);

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
