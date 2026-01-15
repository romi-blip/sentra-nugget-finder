import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { PDFDocument, rgb, StandardFonts, PDFName, PDFRawStream } from "https://esm.sh/pdf-lib@1.17.1";
import { decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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
};

interface RequestBody {
  file?: string;
  fileName?: string;
  fileType?: string;
  mode?: 'extract' | 'generate';
  editedContent?: ExtractedDocument;
}

interface StructuredSection {
  id?: string;
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

// Create cover page with element templates
// logoConfig.height: The target display height for the logo (from page layout settings)
async function createCoverPageWithElements(
  pdfDoc: any, 
  fonts: any, 
  data: ExtractedDocument,
  coverTemplate: ElementTemplate | null,
  titleStyle: ElementTemplate | null,
  logoImage: any,
  logoConfig: { show: boolean; x: number; y: number; height?: number; } | null
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
  footerHeight: number,
  logoConfig: { show: boolean; x: number; y: number; height?: number; } | null = null
) {
  const page = pdfDoc.addPage([595, 842]);
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 50;

  const actualHeaderHeight = drawHeaderElement(page, embeddedHeaderImage, headerHeight, logoImage, logoConfig);

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
  embeddedContentPageImage: any | null = null
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
  let pageNumber = 2;
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

  const addNewPage = () => {
    // Limit pages to prevent CPU timeout
    if (pageNumber >= MAX_PAGES) {
      console.log(`[transform-document-design] WARNING: Max pages (${MAX_PAGES}) reached, stopping`);
      return false;
    }
    
    // Draw footer on current page (only if not using full page design)
    if (!embeddedContentPageImage) {
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
        if (!addNewPage()) break;
      }
      continue;
    }

    if (y < minY + 80) {
      if (!addNewPage()) break;
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
          if (!addNewPage()) break;
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
        if (!addNewPage()) break;
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
        if (!addNewPage()) break;
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
        if (!addNewPage()) break;
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
          if (!addNewPage()) break;
        }

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
        if (pageNumber >= MAX_PAGES) break;
        if (y < minY) {
          if (!addNewPage()) break;
        }

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

  // Draw footer on last page (only if not using full page design)
  if (!embeddedContentPageImage) {
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
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular: regularFont, bold: boldFont };

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

  // Create cover page with logo (height comes from config)
  await createCoverPageWithElements(pdfDoc, fonts, extractedDoc, elements.cover_background || null, elements.title || null, logoImage, coverLogoConfig);
  
  // Create TOC page with logo
  await createTOCPage(pdfDoc, fonts, tocEntries, extractedDoc.isConfidential, logoImage, embeddedHeaderImage, headerHeight, embeddedFooterImage, footerHeight, tocLogoConfig);
  
  // Create content pages with logo (pass content_page image if using full page design)
  await createContentPages(pdfDoc, fonts, extractedDoc.sections, extractedDoc.isConfidential, logoImage, embeddedHeaderImage, headerHeight, embeddedFooterImage, footerHeight, {
    h1: elements.h1,
    h2: elements.h2,
    h3: elements.h3,
    paragraph: elements.paragraph,
    bullet: elements.bullet,
  }, contentLogoConfig, embeddedContentPageImage);

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
    const { file, fileName, fileType, mode = 'extract', editedContent } = body;

    console.log(`[transform-document-design] Processing mode=${mode}, fileName=${fileName}, fileType=${fileType}`);

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
    
    // Generate PDF with element templates and layout config
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
    }, layoutConfigForPdf);
    
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
