import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Brand colors matching the reference template exactly
const COLORS = {
  // Header bar - dark charcoal/black (matches cover page background)
  headerDark: rgb(15/255, 15/255, 26/255),      // #0F0F1A - dark navy/black
  headerAccent: rgb(124/255, 58/255, 237/255),  // #7C3AED - purple accent line
  
  // Icon backgrounds - light purple from SVG
  iconPurple: rgb(243/255, 232/255, 255/255),   // #F3E8FF
  
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
};

interface BrandSettings {
  primaryColor: string;
  secondaryColor: string;
}

interface RequestBody {
  file: string;
  fileName: string;
  fileType: string;
  settings: BrandSettings;
}

interface StructuredSection {
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet-list' | 'feature-grid' | 'page-break' | 'heading';
  content?: string;
  text?: string;
  level?: number;
  items?: string[];
  features?: Array<{ title: string; description: string }>;
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

// Extract content from DOCX
async function extractDocxContent(base64Content: string): Promise<ExtractedDocument> {
  console.log('[transform-document-design] Extracting content from DOCX');
  
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const zip = await JSZip.loadAsync(bytes);
  
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
      
      let sectionType: StructuredSection['type'] = 'paragraph';
      
      if (styleName.match(/Heading1|Title/i) || paragraphContent.includes('w:outlineLvl w:val="0"')) {
        sectionType = 'h1';
        if (!foundTitle && paragraphText.length > 10 && 
            !paragraphText.toUpperCase().includes('WHITEPAPER') &&
            !paragraphText.toUpperCase().includes('WHITE PAPER')) {
          title = paragraphText;
          foundTitle = true;
        }
      } else if (styleName.match(/Heading2|Subtitle/i) || paragraphContent.includes('w:outlineLvl w:val="1"')) {
        sectionType = 'h2';
        if (!foundTitle && paragraphText.length > 15) {
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
      
      // Check if it's a bullet point
      if (paragraphText.startsWith('•') || paragraphText.startsWith('-') || paragraphText.startsWith('*')) {
        const cleanText = paragraphText.replace(/^[•\-*]\s*/, '');
        // Try to add to existing bullet list or create new one
        const lastSection = sections[sections.length - 1];
        if (lastSection && lastSection.type === 'bullet-list' && lastSection.items) {
          lastSection.items.push(cleanText);
        } else {
          sections.push({
            type: 'bullet-list',
            items: [cleanText],
          });
        }
      } else {
        sections.push({
          type: sectionType,
          content: paragraphText,
        });
      }
    }
  }

  if (!title && sections.length > 0) {
    const firstHeading = sections.find(s => s.type === 'h1' && s.content && s.content.length > 10);
    if (firstHeading && firstHeading.content) {
      title = firstHeading.content;
    }
  }

  console.log(`[transform-document-design] Extracted ${sections.length} sections, title: "${title}"`);
  
  return { title, subtitle, sections, isConfidential };
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

// Draw Sentra logo icon (pixelated grid pattern) for content pages
function drawSentraLogoIcon(page: any, x: number, y: number, color: any, scale: number = 1) {
  const s = scale * 2.5;
  // Grid pattern - 3x3 with some missing for the sentra look
  // Top row
  page.drawRectangle({ x: x, y: y, width: 4*s, height: 4*s, color });
  page.drawRectangle({ x: x + 6*s, y: y, width: 4*s, height: 4*s, color });
  page.drawRectangle({ x: x + 12*s, y: y, width: 4*s, height: 4*s, color });
  // Middle row
  page.drawRectangle({ x: x, y: y - 6*s, width: 4*s, height: 4*s, color });
  page.drawRectangle({ x: x + 12*s, y: y - 6*s, width: 4*s, height: 4*s, color });
  // Bottom row
  page.drawRectangle({ x: x, y: y - 12*s, width: 4*s, height: 4*s, color });
  page.drawRectangle({ x: x + 6*s, y: y - 12*s, width: 4*s, height: 4*s, color });
  page.drawRectangle({ x: x + 12*s, y: y - 12*s, width: 4*s, height: 4*s, color });
}

// Draw content page header - DARK BAR (like cover page) with Sentra logo + purple accent line
function drawContentHeader(page: any, fonts: any) {
  const width = page.getWidth();
  const height = page.getHeight();
  const headerHeight = 45;
  const accentLineHeight = 4;
  const logoMargin = 35;

  // Full-width dark charcoal header bar (matches cover page background)
  page.drawRectangle({
    x: 0,
    y: height - headerHeight,
    width: width,
    height: headerHeight,
    color: COLORS.headerDark,
  });

  // Draw full Sentra logo (same as cover page - geometric with orange dot)
  drawSentraLogo(page, logoMargin, height - 12, 0.55);

  // "sentra" text in white, next to logo
  page.drawText('sentra', {
    x: logoMargin + 25,
    y: height - 30,
    size: 16,
    font: fonts.bold,
    color: COLORS.lightText,
  });

  // Thin purple accent line below the header bar
  page.drawRectangle({
    x: 0,
    y: height - headerHeight - accentLineHeight,
    width: width,
    height: accentLineHeight,
    color: COLORS.headerAccent,
  });
}

// Draw content page footer - copyright left, confidential center, page number right
function drawContentFooter(page: any, fonts: any, pageNumber: number, isConfidential: boolean) {
  const width = page.getWidth();
  const margin = 35;
  const footerY = 25;

  // Copyright - left aligned
  const copyrightText = `(c) Sentra ${new Date().getFullYear()}. All rights reserved.`;
  page.drawText(copyrightText, {
    x: margin,
    y: footerY,
    size: 9,
    font: fonts.regular,
    color: COLORS.footerGray,
  });

  // Confidential - center aligned
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

  // Page number - right aligned
  const pageNumText = pageNumber.toString();
  const pageNumWidth = fonts.regular.widthOfTextAtSize(pageNumText, 9);
  page.drawText(pageNumText, {
    x: width - margin - pageNumWidth,
    y: footerY,
    size: 9,
    font: fonts.regular,
    color: COLORS.footerGray,
  });
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

// Draw icon circle (light purple background) - matching SVG template
function drawIconCircle(page: any, x: number, y: number, size: number = 44) {
  // Light purple circle background (#F3E8FF)
  page.drawCircle({
    x: x + size / 2,
    y: y - size / 2,
    size: size / 2,
    color: COLORS.iconPurple,
  });
}

// Create cover page (BLACK background)
function createCoverPage(pdfDoc: any, fonts: any, data: ExtractedDocument) {
  const page = pdfDoc.addPage([595, 814]);
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 50;

  // Black background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: height,
    color: COLORS.black,
  });

  // Draw Sentra logo at top left
  drawSentraLogo(page, margin, height - 60, 1);

  // "Sentra" text next to logo
  page.drawText('Sentra', {
    x: margin + 50,
    y: height - 75,
    size: 20,
    font: fonts.bold,
    color: COLORS.lightText,
  });

  // Title in neon green
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

  // Colored footer bar
  drawFooterBar(page);
}

// Create TOC page
function createTOCPage(pdfDoc: any, fonts: any, tocEntries: TOCEntry[], isConfidential: boolean) {
  const page = pdfDoc.addPage([595, 814]);
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 50;

  drawContentHeader(page, fonts);

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

    // Dot leader
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

  drawContentFooter(page, fonts, 1, isConfidential);
}

// Generate TOC entries
function generateTOCEntries(sections: StructuredSection[], fonts: any): TOCEntry[] {
  const entries: TOCEntry[] = [];
  let currentPage = 3;
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

// Create content pages with proper styling - REBUILT FROM SCRATCH
function createContentPages(pdfDoc: any, fonts: any, sections: StructuredSection[], isConfidential: boolean) {
  let currentPage = pdfDoc.addPage([595, 814]);
  const pageWidth = currentPage.getWidth();
  const pageHeight = currentPage.getHeight();
  const margin = 35; // Match SVG template margin
  const contentWidth = pageWidth - margin * 2;
  
  // Start content below the dark header bar (45px) + purple accent line (4px) + gap
  let y = pageHeight - 75;
  const minY = 55; // Leave room for footer
  let pageNumber = 2;
  let hasContent = false;

  // Draw header on first content page
  drawContentHeader(currentPage, fonts);

  // Helper to add a new page
  const addNewPage = () => {
    drawContentFooter(currentPage, fonts, pageNumber, isConfidential);
    pageNumber++;
    currentPage = pdfDoc.addPage([595, 814]);
    y = pageHeight - 75; // Below header (45px) + accent line (4px) + padding
    drawContentHeader(currentPage, fonts);
    hasContent = false;
  };

  // Process each section
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const content = section.content || section.text || '';

    // Handle page breaks
    if (section.type === 'page-break') {
      if (hasContent) {
        addNewPage();
      }
      continue;
    }

    // Check if we need a new page
    if (y < minY + 80) {
      addNewPage();
    }

    // H1 - Main section headings (24px, bold, black)
    if (section.type === 'h1') {
      if (hasContent && i > 0) {
        addNewPage();
      }

      const lines = wrapText(content, fonts.bold, 24, contentWidth);
      for (const line of lines) {
        currentPage.drawText(line, {
          x: margin,
          y: y,
          size: 24,
          font: fonts.bold,
          color: COLORS.black,
        });
        y -= 32;
      }
      y -= 20;
      hasContent = true;
    }
    // H2 - Subsection headings (18px, bold, black)
    else if (section.type === 'h2') {
      if (y < minY + 60) addNewPage();
      
      y -= 8; // Add spacing before h2

      const lines = wrapText(content, fonts.bold, 18, contentWidth);
      for (const line of lines) {
        currentPage.drawText(line, {
          x: margin,
          y: y,
          size: 18,
          font: fonts.bold,
          color: COLORS.black,
        });
        y -= 24;
      }
      y -= 12;
      hasContent = true;
    }
    // H3 - Sub-subsection headings (14px, bold, dark gray)
    else if (section.type === 'h3') {
      if (y < minY + 40) addNewPage();
      
      y -= 6;

      const lines = wrapText(content, fonts.bold, 14, contentWidth);
      for (const line of lines) {
        currentPage.drawText(line, {
          x: margin,
          y: y,
          size: 14,
          font: fonts.bold,
          color: COLORS.darkGray,
        });
        y -= 20;
      }
      y -= 8;
      hasContent = true;
    }
    // Feature grid - 2 column layout with purple icon circles
    else if (section.type === 'feature-grid' && section.features) {
      const colGap = 30;
      const colWidth = (contentWidth - colGap) / 2;
      const iconSize = 44;
      const features = section.features;
      
      for (let j = 0; j < features.length; j += 2) {
        // Check if we need space for feature row
        if (y < minY + 100) addNewPage();

        const leftFeature = features[j];
        const rightFeature = features[j + 1];
        let rowHeight = 0;

        // LEFT COLUMN
        const leftX = margin;
        const leftTextX = leftX + iconSize + 12;
        const leftTextWidth = colWidth - iconSize - 12;
        
        // Draw icon circle
        drawIconCircle(currentPage, leftX, y, iconSize);
        
        // Feature title (bold, 14px, black)
        const leftTitleLines = wrapText(leftFeature.title, fonts.bold, 14, leftTextWidth);
        let leftY = y - 8;
        for (const line of leftTitleLines) {
          currentPage.drawText(line, {
            x: leftTextX,
            y: leftY,
            size: 14,
            font: fonts.bold,
            color: COLORS.black,
          });
          leftY -= 18;
        }
        
        // Feature description (regular, 11px, gray)
        const leftDescLines = wrapText(leftFeature.description, fonts.regular, 11, leftTextWidth);
        for (const line of leftDescLines) {
          currentPage.drawText(line, {
            x: leftTextX,
            y: leftY,
            size: 11,
            font: fonts.regular,
            color: COLORS.bodyText,
          });
          leftY -= 15;
        }
        
        rowHeight = Math.max(rowHeight, y - leftY);

        // RIGHT COLUMN
        if (rightFeature) {
          const rightX = margin + colWidth + colGap;
          const rightTextX = rightX + iconSize + 12;
          const rightTextWidth = colWidth - iconSize - 12;
          
          // Draw icon circle
          drawIconCircle(currentPage, rightX, y, iconSize);
          
          // Feature title
          const rightTitleLines = wrapText(rightFeature.title, fonts.bold, 14, rightTextWidth);
          let rightY = y - 8;
          for (const line of rightTitleLines) {
            currentPage.drawText(line, {
              x: rightTextX,
              y: rightY,
              size: 14,
              font: fonts.bold,
              color: COLORS.black,
            });
            rightY -= 18;
          }
          
          // Feature description
          const rightDescLines = wrapText(rightFeature.description, fonts.regular, 11, rightTextWidth);
          for (const line of rightDescLines) {
            currentPage.drawText(line, {
              x: rightTextX,
              y: rightY,
              size: 11,
              font: fonts.regular,
              color: COLORS.bodyText,
            });
            rightY -= 15;
          }
          
          rowHeight = Math.max(rowHeight, y - rightY);
        }

        y -= rowHeight + 20;
      }
      y -= 10;
      hasContent = true;
    }
    // Bullet list
    else if (section.type === 'bullet-list' && section.items) {
      for (const item of section.items) {
        if (y < minY + 25) addNewPage();

        const bulletIndent = 15;
        
        // Draw bullet character
        currentPage.drawText('-', {
          x: margin,
          y: y,
          size: 11,
          font: fonts.regular,
          color: COLORS.black,
        });

        // Wrap and draw text
        const lines = wrapText(item, fonts.regular, 11, contentWidth - bulletIndent);
        let isFirst = true;
        for (const line of lines) {
          currentPage.drawText(line, {
            x: margin + bulletIndent,
            y: y,
            size: 11,
            font: fonts.regular,
            color: COLORS.bodyText,
          });
          y -= 16;
          isFirst = false;
        }
      }
      y -= 10;
      hasContent = true;
    }
    // Regular paragraph (11px, regular, body text gray)
    else if (section.type === 'paragraph' && content) {
      const lines = wrapText(content, fonts.regular, 11, contentWidth);
      
      for (const line of lines) {
        if (y < minY) addNewPage();

        currentPage.drawText(line, {
          x: margin,
          y: y,
          size: 11,
          font: fonts.regular,
          color: COLORS.bodyText,
        });
        y -= 16;
      }
      y -= 12;
      hasContent = true;
    }
  }

  // Draw footer on last page
  drawContentFooter(currentPage, fonts, pageNumber, isConfidential);
}

// Main PDF generation
async function generatePDF(extractedDoc: ExtractedDocument): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const fonts = { regular: regularFont, bold: boldFont };

  const tocEntries = generateTOCEntries(extractedDoc.sections, fonts);

  createCoverPage(pdfDoc, fonts, extractedDoc);
  createTOCPage(pdfDoc, fonts, tocEntries, extractedDoc.isConfidential);
  createContentPages(pdfDoc, fonts, extractedDoc.sections, extractedDoc.isConfidential);

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

    // First, structure the content using the structure-content function
    let extractedDoc = await extractDocxContent(file);
    
    // Call structure-content to get properly formatted sections
    try {
      const structureResponse = await supabase.functions.invoke('structure-content', {
        body: { 
          content: extractedDoc.sections.map(s => s.content || '').join('\n\n'),
          documentTitle: extractedDoc.title 
        }
      });

      if (structureResponse.data?.success && structureResponse.data?.structured) {
        const structured = structureResponse.data.structured;
        extractedDoc = {
          ...extractedDoc,
          title: structured.title || extractedDoc.title,
          subtitle: structured.subtitle || extractedDoc.subtitle,
          sections: structured.sections || extractedDoc.sections,
        };
        console.log('[transform-document-design] Content structured successfully via AI');
      }
    } catch (structureError) {
      console.log('[transform-document-design] Structure function unavailable, using basic extraction:', structureError);
    }
    
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
