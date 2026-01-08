import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { PDFDocument, rgb, StandardFonts, PDFName, PDFRawStream } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Memory limits for images
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB per image
const MAX_TOTAL_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB total

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
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet-list' | 'feature-grid' | 'page-break' | 'heading' | 'image';
  content?: string;
  text?: string;
  level?: number;
  items?: string[];
  features?: Array<{ title: string; description: string }>;
  // Image fields
  imageBase64?: string;
  imageMimeType?: string;
  imageCaption?: string;
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

// Parse DOCX relationships file to map rId to image paths
async function parseDocxRelationships(zip: JSZip): Promise<Map<string, string>> {
  const relMap = new Map<string, string>();
  
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (!relsFile) {
    console.log('[transform-document-design] No relationships file found');
    return relMap;
  }
  
  const relsXml = await relsFile.async('string');
  
  // Match relationship entries for images
  const relRegex = /<Relationship[^>]*Id="(rId\d+)"[^>]*Target="([^"]+)"[^>]*Type="[^"]*\/image"[^>]*\/?>/gi;
  const relRegex2 = /<Relationship[^>]*Type="[^"]*\/image"[^>]*Target="([^"]+)"[^>]*Id="(rId\d+)"[^>]*\/?>/gi;
  
  let match;
  while ((match = relRegex.exec(relsXml)) !== null) {
    relMap.set(match[1], match[2]);
  }
  while ((match = relRegex2.exec(relsXml)) !== null) {
    relMap.set(match[2], match[1]);
  }
  
  console.log(`[transform-document-design] Found ${relMap.size} image relationships`);
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
  
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

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

    const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    const styleRegex = /<w:pStyle w:val="([^"]*)"/;
    
    let match;
    let foundTitle = false;
    
    while ((match = paragraphRegex.exec(documentXml)) !== null) {
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

  const imageCount = sections.filter(s => s.type === 'image').length;
  console.log(`[transform-document-design] Extracted ${sections.length} sections (${imageCount} images), title: "${title}"`);
  
  return { title, subtitle, sections, isConfidential };
}

// Extract content from PDF including images
async function extractPdfContent(base64Content: string): Promise<ExtractedDocument> {
  console.log('[transform-document-design] Extracting content from PDF');
  
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
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
function drawHeaderElement(
  page: any, 
  embeddedHeaderImage: any | null,
  headerHeight: number,
  logoImage: any
) {
  const width = page.getWidth();
  const height = page.getHeight();
  
  if (embeddedHeaderImage) {
    page.drawImage(embeddedHeaderImage, {
      x: 0,
      y: height - headerHeight,
      width: width,
      height: headerHeight,
    });
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

  if (logoImage) {
    const logoHeight = 24;
    const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    page.drawImage(logoImage, {
      x: 25,
      y: height - defaultHeight + 8,
      width: logoWidth,
      height: logoHeight,
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
function createTOCPage(
  pdfDoc: any, 
  fonts: any, 
  tocEntries: TOCEntry[], 
  isConfidential: boolean, 
  logoImage: any,
  embeddedHeaderImage: any | null,
  headerHeight: number,
  embeddedFooterImage: any | null,
  footerHeight: number
) {
  const page = pdfDoc.addPage([595, 842]);
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 50;

  const actualHeaderHeight = drawHeaderElement(page, embeddedHeaderImage, headerHeight, logoImage);

  const titleY = height - actualHeaderHeight - 40;
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

  drawFooterElement(page, fonts, embeddedFooterImage, footerHeight, 1, isConfidential);
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

// Create content pages with element templates - now with image support
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
  }
) {
  let currentPage = pdfDoc.addPage([595, 842]);
  const pageWidth = currentPage.getWidth();
  const pageHeight = currentPage.getHeight();
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  
  let y = pageHeight - headerHeight - 25;
  const minY = footerHeight + 20;
  let pageNumber = 2;
  let hasContent = false;

  // Cache for embedded images to avoid re-embedding duplicates
  const embeddedImageCache = new Map<string, any>();

  // Draw header on first page
  drawHeaderElement(currentPage, embeddedHeaderImage, headerHeight, logoImage);

  const addNewPage = () => {
    drawFooterElement(currentPage, fonts, embeddedFooterImage, footerHeight, pageNumber, isConfidential);
    pageNumber++;
    currentPage = pdfDoc.addPage([595, 842]);
    drawHeaderElement(currentPage, embeddedHeaderImage, headerHeight, logoImage);
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
        addNewPage();
      }
      continue;
    }

    if (y < minY + 80) {
      addNewPage();
    }

    // Handle image sections
    if (section.type === 'image' && section.imageBase64 && section.imageMimeType) {
      try {
        // Check cache first
        const cacheKey = section.imageBase64.substring(0, 100);
        let embeddedImg = embeddedImageCache.get(cacheKey);
        
        if (!embeddedImg) {
          const binaryString = atob(section.imageBase64);
          const imgBytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            imgBytes[j] = binaryString.charCodeAt(j);
          }
          
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
          addNewPage();
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
        addNewPage();
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
      if (y < minY + 60) addNewPage();
      
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
      if (y < minY + 40) addNewPage();
      
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
        if (y < minY + 30) addNewPage();

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
        if (y < minY) addNewPage();

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

  drawFooterElement(currentPage, fonts, embeddedFooterImage, footerHeight, pageNumber, isConfidential);
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

  // Embed header image ONCE if template has one
  let embeddedHeaderImage: any = null;
  let headerHeight = 40;
  if (elements.header?.image_base64) {
    try {
      const base64Data = elements.header.image_base64.split(',')[1] || elements.header.image_base64;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      embeddedHeaderImage = await pdfDoc.embedPng(bytes);
      headerHeight = elements.header.image_height || 40;
      console.log('[transform-document-design] Embedded header image once');
    } catch (e) {
      console.log('[transform-document-design] Could not embed header image:', e);
    }
  }

  // Embed footer image ONCE if template has one
  let embeddedFooterImage: any = null;
  let footerHeight = 40;
  if (elements.footer?.image_base64) {
    try {
      const base64Data = elements.footer.image_base64.split(',')[1] || elements.footer.image_base64;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      embeddedFooterImage = await pdfDoc.embedPng(bytes);
      footerHeight = elements.footer.image_height || 30;
      console.log('[transform-document-design] Embedded footer image once');
    } catch (e) {
      console.log('[transform-document-design] Could not embed footer image:', e);
    }
  }

  const tocEntries = generateTOCEntries(extractedDoc.sections, fonts);

  // Create cover page
  await createCoverPageWithElements(pdfDoc, fonts, extractedDoc, elements.cover_background || null, elements.title || null);
  
  // Create TOC page
  await createTOCPage(pdfDoc, fonts, tocEntries, extractedDoc.isConfidential, logoImage, embeddedHeaderImage, headerHeight, embeddedFooterImage, footerHeight);
  
  // Create content pages
  await createContentPages(pdfDoc, fonts, extractedDoc.sections, extractedDoc.isConfidential, logoImage, embeddedHeaderImage, headerHeight, embeddedFooterImage, footerHeight, {
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
    const { file, fileName, fileType } = body;

    console.log(`[transform-document-design] Processing ${fileName} (${fileType})`);

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
    let extractedDoc: ExtractedDocument;
    if (fileType === 'docx') {
      extractedDoc = await extractDocxContent(file);
    } else {
      extractedDoc = await extractPdfContent(file);
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

        // Cover page elements
        if (coverLayout?.background_element_id && templateById[coverLayout.background_element_id]) {
          elements.cover_background = templateById[coverLayout.background_element_id];
          console.log(`[transform-document-design] ✓ cover_background from profile: "${elements.cover_background.name}"`);
        }
        if (coverLayout?.logo_element_id && templateById[coverLayout.logo_element_id]) {
          elements.logo = templateById[coverLayout.logo_element_id];
          console.log(`[transform-document-design] ✓ logo from profile: "${elements.logo.name}"`);
        }

        // Content page elements (header/footer for content pages)
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
    
    // Convert to base64 in chunks to avoid stack overflow with large arrays
    let pdfBase64 = '';
    const chunkSize = 8192;
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      const chunk = pdfBytes.subarray(i, Math.min(i + chunkSize, pdfBytes.length));
      pdfBase64 += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    pdfBase64 = btoa(pdfBase64);

    const outputFileName = fileName.replace(/\.(docx|pdf)$/i, '_branded.pdf');

    return new Response(
      JSON.stringify({
        type: 'pdf',
        modifiedFile: pdfBase64,
        originalFileName: outputFileName,
        message: `Document transformed successfully with Sentra branding. Extracted ${extractedDoc.sections.filter(s => s.type === 'image').length} images.`,
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
