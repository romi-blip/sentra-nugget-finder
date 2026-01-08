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

interface RequestBody {
  file: string;
  fileName: string;
  fileType: string;
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

interface ElementTemplate {
  id: string;
  element_type: string;
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

// Draw header using element template
async function drawHeaderElement(
  page: any, 
  pdfDoc: any, 
  headerTemplate: ElementTemplate | null, 
  logoImage: any
) {
  const width = page.getWidth();
  const height = page.getHeight();
  
  if (headerTemplate?.image_base64) {
    // Use the template image as header
    try {
      const base64Data = headerTemplate.image_base64.split(',')[1] || headerTemplate.image_base64;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const headerImage = await pdfDoc.embedPng(bytes);
      const imgHeight = headerTemplate.image_height || 40;
      
      page.drawImage(headerImage, {
        x: 0,
        y: height - imgHeight,
        width: width,
        height: imgHeight,
      });
      
      return imgHeight;
    } catch (e) {
      console.log('[transform-document-design] Could not embed header image:', e);
    }
  }
  
  // Default header if no template
  const headerHeight = 40;
  page.drawRectangle({
    x: 0,
    y: height - headerHeight,
    width: width,
    height: headerHeight,
    color: COLORS.headerDark,
  });

  if (logoImage) {
    const logoHeight = 24;
    const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    page.drawImage(logoImage, {
      x: 25,
      y: height - headerHeight + 8,
      width: logoWidth,
      height: logoHeight,
    });
  }
  
  return headerHeight;
}

// Draw footer using element template
async function drawFooterElement(
  page: any, 
  pdfDoc: any, 
  fonts: any,
  footerTemplate: ElementTemplate | null,
  pageNumber: number,
  isConfidential: boolean
) {
  const width = page.getWidth();
  const margin = 35;
  
  if (footerTemplate?.image_base64) {
    // Use the template image as footer
    try {
      const base64Data = footerTemplate.image_base64.split(',')[1] || footerTemplate.image_base64;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const footerImage = await pdfDoc.embedPng(bytes);
      const imgHeight = footerTemplate.image_height || 30;
      
      page.drawImage(footerImage, {
        x: 0,
        y: 0,
        width: width,
        height: imgHeight,
      });
      
      return imgHeight;
    } catch (e) {
      console.log('[transform-document-design] Could not embed footer image:', e);
    }
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

// Create cover page with element templates
async function createCoverPageWithElements(
  pdfDoc: any, 
  fonts: any, 
  data: ExtractedDocument,
  coverTemplate: ElementTemplate | null,
  titleStyle: ElementTemplate | null
) {
  const page = pdfDoc.addPage([595, 842]);
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 50;

  // Draw cover background if template has image
  if (coverTemplate?.image_base64) {
    try {
      const base64Data = coverTemplate.image_base64.split(',')[1] || coverTemplate.image_base64;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const coverImage = await pdfDoc.embedPng(bytes);
      
      page.drawImage(coverImage, {
        x: 0,
        y: 0,
        width: width,
        height: height,
      });
    } catch (e) {
      console.log('[transform-document-design] Could not embed cover image:', e);
      // Fallback to black background
      page.drawRectangle({ x: 0, y: 0, width, height, color: COLORS.black });
      drawSentraLogo(page, margin, height - 60, 1);
      page.drawText('Sentra', { x: margin + 50, y: height - 75, size: 20, font: fonts.bold, color: COLORS.lightText });
      drawFooterBar(page);
    }
  } else {
    // Default black cover
    page.drawRectangle({ x: 0, y: 0, width, height, color: COLORS.black });
    drawSentraLogo(page, margin, height - 60, 1);
    page.drawText('Sentra', { x: margin + 50, y: height - 75, size: 20, font: fonts.bold, color: COLORS.lightText });
    drawFooterBar(page);
  }

  // Draw title with element style
  const titleY = coverTemplate?.image_base64 ? 400 : height - 440;
  const titleFontSize = titleStyle?.font_size || 28;
  const titleColor = titleStyle?.font_color ? hexToRgb(titleStyle.font_color) : COLORS.primary;
  const titleFont = titleStyle?.font_weight === 'bold' ? fonts.bold : fonts.bold;
  
  const titleLines = wrapText(data.title || 'Document Title', titleFont, titleFontSize, width - margin * 2);
  let currentY = titleY;
  for (const line of titleLines) {
    page.drawText(line, {
      x: margin,
      y: currentY,
      size: titleFontSize,
      font: titleFont,
      color: titleColor,
    });
    currentY -= titleFontSize + 8;
  }
}

// Create TOC page
async function createTOCPage(
  pdfDoc: any, 
  fonts: any, 
  tocEntries: TOCEntry[], 
  isConfidential: boolean, 
  logoImage: any,
  headerTemplate: ElementTemplate | null,
  footerTemplate: ElementTemplate | null
) {
  const page = pdfDoc.addPage([595, 842]);
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 50;

  const headerHeight = await drawHeaderElement(page, pdfDoc, headerTemplate, logoImage);

  const titleY = height - headerHeight - 40;
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

  await drawFooterElement(page, pdfDoc, fonts, footerTemplate, 1, isConfidential);
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

// Create content pages with element templates
async function createContentPages(
  pdfDoc: any, 
  fonts: any, 
  sections: StructuredSection[], 
  isConfidential: boolean, 
  logoImage: any,
  elements: {
    header?: ElementTemplate | null;
    footer?: ElementTemplate | null;
    h1?: ElementTemplate | null;
    h2?: ElementTemplate | null;
    h3?: ElementTemplate | null;
    paragraph?: ElementTemplate | null;
    bullet?: ElementTemplate | null;
  }
) {
  let currentPage = pdfDoc.addPage([595, 842]);
  const pageWidth = currentPage.getWidth();
  const pageHeight = currentPage.getHeight();
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  
  // Calculate content area based on header/footer heights
  const headerHeight = elements.header?.image_height || 40;
  const footerHeight = elements.footer?.image_height || 40;
  
  let y = pageHeight - headerHeight - 25;
  const minY = footerHeight + 20;
  let pageNumber = 2;
  let hasContent = false;

  // Draw header on first page
  await drawHeaderElement(currentPage, pdfDoc, elements.header || null, logoImage);

  const addNewPage = async () => {
    await drawFooterElement(currentPage, pdfDoc, fonts, elements.footer || null, pageNumber, isConfidential);
    pageNumber++;
    currentPage = pdfDoc.addPage([595, 842]);
    await drawHeaderElement(currentPage, pdfDoc, elements.header || null, logoImage);
    y = pageHeight - headerHeight - 25;
    hasContent = false;
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

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const content = section.content || section.text || '';

    if (section.type === 'page-break') {
      if (hasContent) {
        await addNewPage();
      }
      continue;
    }

    if (y < minY + 80) {
      await addNewPage();
    }

    if (section.type === 'h1') {
      if (hasContent && i > 0) {
        await addNewPage();
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
      if (y < minY + 60) await addNewPage();
      
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
      if (y < minY + 40) await addNewPage();
      
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
        if (y < minY + 30) await addNewPage();

        const bulletX = margin + 8;
        
        currentPage.drawText(style.bulletChar, {
          x: bulletX,
          y: y,
          size: style.fontSize,
          font: fonts.bold,
          color: style.color,
        });

        const lines = wrapText(item, fonts.regular, style.fontSize, contentWidth - style.bulletIndent - 8);
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          currentPage.drawText(lines[lineIdx], {
            x: margin + style.bulletIndent,
            y: y,
            size: style.fontSize,
            font: fonts.regular,
            color: style.color,
          });
          y -= style.fontSize + 6;
        }
        y -= 4;
      }
      y -= style.marginBottom;
      hasContent = true;
    }
    else if (section.type === 'paragraph' && content) {
      const style = getTextStyle('paragraph');
      const lines = wrapText(content, fonts.regular, style.fontSize, contentWidth);
      
      for (const line of lines) {
        if (y < minY) await addNewPage();

        currentPage.drawText(line, {
          x: margin,
          y: y,
          size: style.fontSize,
          font: fonts.regular,
          color: style.color,
        });
        y -= style.fontSize + 5;
      }
      y -= style.marginBottom;
      hasContent = true;
    }
  }

  await drawFooterElement(currentPage, pdfDoc, fonts, elements.footer || null, pageNumber, isConfidential);
}

// Main PDF generation
async function generatePDF(
  extractedDoc: ExtractedDocument, 
  logoBytes: Uint8Array | null,
  elements: {
    cover_background?: ElementTemplate | null;
    header?: ElementTemplate | null;
    footer?: ElementTemplate | null;
    title?: ElementTemplate | null;
    h1?: ElementTemplate | null;
    h2?: ElementTemplate | null;
    h3?: ElementTemplate | null;
    paragraph?: ElementTemplate | null;
    bullet?: ElementTemplate | null;
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular: regularFont, bold: boldFont };

  let logoImage = null;
  if (logoBytes) {
    try {
      logoImage = await pdfDoc.embedJpg(logoBytes);
    } catch (e) {
      console.log('[transform-document-design] Could not embed logo:', e);
    }
  }

  const tocEntries = generateTOCEntries(extractedDoc.sections, fonts);

  // Create cover page
  await createCoverPageWithElements(pdfDoc, fonts, extractedDoc, elements.cover_background || null, elements.title || null);
  
  // Create TOC page
  await createTOCPage(pdfDoc, fonts, tocEntries, extractedDoc.isConfidential, logoImage, elements.header || null, elements.footer || null);
  
  // Create content pages
  await createContentPages(pdfDoc, fonts, extractedDoc.sections, extractedDoc.isConfidential, logoImage, {
    header: elements.header,
    footer: elements.footer,
    h1: elements.h1,
    h2: elements.h2,
    h3: elements.h3,
    paragraph: elements.paragraph,
    bullet: elements.bullet,
  });

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

    // Extract document content
    const extractedDoc = await extractDocxContent(file);

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

    // First, try the new document profile system
    const { data: defaultProfile } = await supabase
      .from('document_profiles')
      .select('id')
      .eq('is_default', true)
      .single();

    if (defaultProfile) {
      console.log(`[transform-document-design] Found default document profile: ${defaultProfile.id}`);
      
      // Fetch page layouts for this profile
      const { data: pageLayouts } = await supabase
        .from('page_layouts')
        .select('*')
        .eq('profile_id', defaultProfile.id);

      console.log(`[transform-document-design] Found ${pageLayouts?.length || 0} page layouts`);

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
        }
      }

      // Fetch text styles for all layouts
      const layoutIds = pageLayouts?.map(l => l.id) || [];
      let textStylesMap: Record<string, Record<string, string>> = {};
      
      if (layoutIds.length > 0) {
        const { data: textStyles } = await supabase
          .from('page_text_styles')
          .select('*')
          .in('page_layout_id', layoutIds);

        console.log(`[transform-document-design] Found ${textStyles?.length || 0} text styles`);

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
              }
            }
          }
        }
      }

      // Fetch all needed element templates
      if (elementIds.size > 0) {
        const { data: elementTemplates } = await supabase
          .from('element_templates')
          .select('*')
          .in('id', Array.from(elementIds));

        console.log(`[transform-document-design] Fetched ${elementTemplates?.length || 0} element templates`);

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

        // Cover page elements
        if (coverLayout?.background_element_id && templateById[coverLayout.background_element_id]) {
          elements.cover_background = templateById[coverLayout.background_element_id];
        }
        if (coverLayout?.logo_element_id && templateById[coverLayout.logo_element_id]) {
          elements.logo = templateById[coverLayout.logo_element_id];
        }

        // Content page elements (header/footer for content pages)
        if (contentLayout?.header_element_id && templateById[contentLayout.header_element_id]) {
          elements.header = templateById[contentLayout.header_element_id];
        }
        if (contentLayout?.footer_element_id && templateById[contentLayout.footer_element_id]) {
          elements.footer = templateById[contentLayout.footer_element_id];
        }

        // Text styles - prioritize content layout for body text
        const contentStyles = textStylesMap['content'] || {};
        const coverStyles = textStylesMap['cover'] || {};
        const tocStyles = textStylesMap['toc'] || {};

        // Title/subtitle from cover
        if (coverStyles['title'] && templateById[coverStyles['title']]) {
          elements.title = templateById[coverStyles['title']];
        }
        if (coverStyles['subtitle'] && templateById[coverStyles['subtitle']]) {
          elements.subtitle = templateById[coverStyles['subtitle']];
        }

        // Heading/paragraph styles from content
        if (contentStyles['h1'] && templateById[contentStyles['h1']]) {
          elements.h1 = templateById[contentStyles['h1']];
        }
        if (contentStyles['h2'] && templateById[contentStyles['h2']]) {
          elements.h2 = templateById[contentStyles['h2']];
        }
        if (contentStyles['h3'] && templateById[contentStyles['h3']]) {
          elements.h3 = templateById[contentStyles['h3']];
        }
        if (contentStyles['paragraph'] && templateById[contentStyles['paragraph']]) {
          elements.paragraph = templateById[contentStyles['paragraph']];
        }
        if (contentStyles['bullet'] && templateById[contentStyles['bullet']]) {
          elements.bullet = templateById[contentStyles['bullet']];
        }

        // TOC styles
        if (tocStyles['toc_title'] && templateById[tocStyles['toc_title']]) {
          elements.toc_title = templateById[tocStyles['toc_title']];
        }
        if (tocStyles['toc_entry'] && templateById[tocStyles['toc_entry']]) {
          elements.toc_entry = templateById[tocStyles['toc_entry']];
        }
      }
    }

    // Fallback: If no profile or missing elements, use default element templates
    const { data: defaultElementTemplates } = await supabase
      .from('element_templates')
      .select('*')
      .eq('is_default', true);

    console.log(`[transform-document-design] Found ${defaultElementTemplates?.length || 0} fallback default element templates`);

    if (defaultElementTemplates) {
      for (const template of defaultElementTemplates) {
        // Only use defaults if not already set from profile
        if (!elements[template.element_type]) {
          elements[template.element_type] = template;
        }
      }
    }

    // Generate PDF with element templates
    const pdfBytes = await generatePDF(extractedDoc, logoBytes, {
      cover_background: elements['cover_background'] || null,
      header: elements['header'] || null,
      footer: elements['footer'] || null,
      title: elements['title'] || null,
      h1: elements['h1'] || null,
      h2: elements['h2'] || null,
      h3: elements['h3'] || null,
      paragraph: elements['paragraph'] || null,
      bullet: elements['bullet'] || null,
    });
    
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    return new Response(
      JSON.stringify({
        type: 'pdf',
        modifiedFile: pdfBase64,
        originalFileName: fileName.replace(/\.docx$/i, '_branded.pdf'),
        message: 'Document transformed successfully with Sentra branding.',
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
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
