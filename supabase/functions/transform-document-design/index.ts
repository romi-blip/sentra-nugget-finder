import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Header,
  Footer,
  AlignmentType,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  VerticalAlign,
  convertInchesToTwip,
} from "npm:docx@8.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sentra brand colors (matching the template exactly)
const COLORS = {
  primary: "39FF14", // Neon Green
  primaryDark: "32CD32",
  orange: "FFA500",
  pink: "FF1493",
  cyan: "00FFFF",
  yellow: "FFD700",
  black: "050505",
  white: "FFFFFF",
  gray: "6B7280",
  lightGray: "9CA3AF",
  darkGray: "1F2937",
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
  file: string; // base64
  fileName: string;
  fileType: string;
  settings: BrandSettings;
}

interface ExtractedSection {
  type: 'heading' | 'paragraph';
  text: string;
  level?: number; // 1, 2, 3 for headings
}

interface ExtractedImage {
  id: string;
  base64: string;
  mimeType: string;
}

interface ExtractedDocument {
  title: string;
  subtitle: string;
  sections: ExtractedSection[];
  images: ExtractedImage[];
  isConfidential: boolean;
}

// Decode HTML entities that may appear in extracted text
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

// Convert ArrayBuffer to base64 without stack overflow
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
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
  const images: ExtractedImage[] = [];
  let title = '';
  let subtitle = '';
  let isConfidential = false;

  // Extract images from word/media folder
  const mediaFolder = zip.folder('word/media');
  if (mediaFolder) {
    const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('word/media/'));
    for (const path of mediaFiles) {
      const file = zip.file(path);
      if (file && !file.dir) {
        try {
          const imageData = await file.async('base64');
          const ext = path.split('.').pop()?.toLowerCase() || 'png';
          const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
          images.push({
            id: path.replace('word/media/', ''),
            base64: imageData,
            mimeType,
          });
        } catch (e) {
          console.log(`[transform-document-design] Could not extract image: ${path}`);
        }
      }
    }
  }
  console.log(`[transform-document-design] Extracted ${images.length} images`);

  // Extract text content from document.xml
  const documentFile = zip.file('word/document.xml');
  if (documentFile) {
    const documentXml = await documentFile.async('string');
    
    // Check for confidential markers
    if (documentXml.toLowerCase().includes('confidential')) {
      isConfidential = true;
    }

    // Extract paragraphs with their styles
    const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    const styleRegex = /<w:pStyle w:val="([^"]*)"/;
    
    let match;
    let foundTitle = false;
    
    while ((match = paragraphRegex.exec(documentXml)) !== null) {
      const paragraphContent = match[1];
      
      // Extract all text from this paragraph
      let paragraphText = '';
      const textMatches = paragraphContent.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      for (const tm of textMatches) {
        paragraphText += tm[1];
      }
      
      paragraphText = decodeHtmlEntities(paragraphText.trim());
      if (!paragraphText) continue;
      
      // Check if it's a heading
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
      
      // Skip very short text that's likely formatting artifacts
      if (paragraphText.length < 2) continue;
      
      // Skip page numbers and common artifacts
      if (/^\d+$/.test(paragraphText) || paragraphText.toLowerCase() === 'sentra') continue;
      
      // Skip common document artifacts
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

  // If no title found, try to extract from first meaningful heading
  if (!title && sections.length > 0) {
    const firstHeading = sections.find(s => s.type === 'heading' && s.text.length > 10);
    if (firstHeading) {
      title = firstHeading.text;
    }
  }

  console.log(`[transform-document-design] Extracted ${sections.length} sections, title: "${title}"`);
  
  return { title, subtitle, sections, images, isConfidential };
}

// Create colored footer bar table
function createColoredFooterBar(): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: COLORS.primary },
            children: [new Paragraph({ children: [new TextRun({ text: " ", size: 8 })] })],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: COLORS.pink },
            children: [new Paragraph({ children: [new TextRun({ text: " ", size: 8 })] })],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: COLORS.yellow },
            children: [new Paragraph({ children: [new TextRun({ text: " ", size: 8 })] })],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: COLORS.cyan },
            children: [new Paragraph({ children: [new TextRun({ text: " ", size: 8 })] })],
          }),
        ],
      }),
    ],
  });
}

// Create 2-column metadata table for cover page
function createMetadataTable(): Table {
  const today = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const noBorders = {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      // Row 1: PREPARED FOR | VERSION labels
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "PREPARED FOR", size: 18, color: COLORS.gray, allCaps: true }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "VERSION", size: 18, color: COLORS.gray, allCaps: true }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Row 2: PREPARED FOR | VERSION values
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                spacing: { after: 300 },
                children: [
                  new TextRun({ text: "Enterprise Customers", size: 24, bold: true, color: COLORS.black }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                spacing: { after: 300 },
                children: [
                  new TextRun({ text: "v1.0", size: 24, bold: true, color: COLORS.black }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Row 3: AUTHOR | DATE labels
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "AUTHOR", size: 18, color: COLORS.gray, allCaps: true }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "DATE", size: 18, color: COLORS.gray, allCaps: true }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Row 4: AUTHOR | DATE values
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Sentra, Inc.", size: 24, bold: true, color: COLORS.black }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: today, size: 24, bold: true, color: COLORS.black }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// Generate cover page matching the Sentra template design exactly
function createCoverPage(documentTitle: string, isConfidential: boolean): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  // Sentra logo text at top-left with larger size
  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "sentra",
          bold: true,
          size: 56,
          color: COLORS.black,
        }),
      ],
      spacing: { after: 100 },
    })
  );

  // Confidential badge at top-right (if confidential)
  if (isConfidential) {
    elements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "🔒 CONFIDENTIAL",
            bold: true,
            size: 20,
            color: COLORS.gray,
          }),
          new TextRun({
            text: " — Internal Use Only",
            size: 18,
            color: COLORS.lightGray,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 200 },
      })
    );
  }

  // Large spacer to push content down
  elements.push(
    new Paragraph({
      children: [],
      spacing: { before: 2400 },
    })
  );

  // Category badge: "● TECHNICAL WHITEPAPER"
  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "●",
          color: COLORS.primary,
          size: 20,
        }),
        new TextRun({
          text: "  TECHNICAL WHITEPAPER",
          color: COLORS.primary,
          bold: true,
          size: 26,
          allCaps: true,
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // MAIN DOCUMENT TITLE - Large black text
  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: documentTitle || "Untitled Document",
          bold: true,
          size: 72,
          color: COLORS.black,
        }),
      ],
      spacing: { after: 800 },
    })
  );

  // Spacer before metadata
  elements.push(
    new Paragraph({
      children: [],
      spacing: { before: 1600 },
    })
  );

  // 2-column metadata table
  elements.push(createMetadataTable());

  // Spacer before footer
  elements.push(
    new Paragraph({
      children: [],
      spacing: { before: 1200 },
    })
  );

  // SYSTEM_SECURE badge
  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "●",
          color: COLORS.primary,
          size: 14,
        }),
        new TextRun({
          text: " SYSTEM_SECURE",
          color: COLORS.gray,
          size: 16,
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Colored footer bar
  elements.push(createColoredFooterBar());

  // Page break after cover
  elements.push(
    new Paragraph({
      children: [new PageBreak()],
    })
  );

  return elements;
}

// Generate Table of Contents with proper formatting
function createTableOfContents(sections: ExtractedSection[]): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  
  const headings = sections.filter(s => s.type === 'heading' && (s.level === 1 || s.level === 2));
  
  if (headings.length === 0) {
    return elements;
  }

  // TOC Title - "Table of" black, "Contents" green
  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Table of ",
          bold: true,
          size: 56,
          color: COLORS.black,
        }),
        new TextRun({
          text: "Contents",
          bold: true,
          size: 56,
          color: COLORS.primary,
        }),
      ],
      spacing: { after: 600 },
    })
  );

  // Track section numbering
  let chapterNum = 0;
  let subSectionNum = 0;
  let pageNum = 3;

  headings.forEach((heading) => {
    let sectionNumber = '';
    
    if (heading.level === 1) {
      chapterNum++;
      subSectionNum = 0;
      sectionNumber = `${chapterNum}.`;
      
      // Add separator line before major chapters (except first)
      if (chapterNum > 1) {
        elements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "─".repeat(60),
                size: 12,
                color: COLORS.lightGray,
              }),
            ],
            spacing: { before: 150, after: 150 },
          })
        );
      }
    } else if (heading.level === 2) {
      subSectionNum++;
      sectionNumber = `${chapterNum}.${subSectionNum}`;
    }

    const indent = heading.level === 2 ? 400 : 0;
    const fontSize = heading.level === 1 ? 26 : 22;
    const bulletColor = heading.level === 1 ? COLORS.primary : COLORS.gray;

    // Create dot leaders
    const textLength = heading.text.length + sectionNumber.length;
    const dotsCount = Math.max(40 - Math.floor(textLength / 2), 10);
    
    elements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "● ",
            color: bulletColor,
            size: 14,
          }),
          new TextRun({
            text: sectionNumber + " ",
            size: fontSize,
            bold: true,
            color: COLORS.primary,
          }),
          new TextRun({
            text: heading.text,
            size: fontSize,
            bold: heading.level === 1,
            color: COLORS.black,
          }),
          new TextRun({
            text: " " + ".".repeat(dotsCount) + " ",
            size: 12,
            color: COLORS.lightGray,
          }),
          new TextRun({
            text: `${pageNum}`,
            size: fontSize,
            color: COLORS.gray,
          }),
        ],
        indent: { left: indent },
        spacing: { after: heading.level === 1 ? 180 : 120 },
      })
    );
    
    if (heading.level === 1) pageNum++;
  });

  // Page break after TOC
  elements.push(
    new Paragraph({
      children: [new PageBreak()],
    })
  );

  return elements;
}

// Generate content pages with proper styling
function createContentPages(sections: ExtractedSection[], images: ExtractedImage[]): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  
  let chapterNum = 0;
  let subSectionNum = 0;
  let subSubSectionNum = 0;

  sections.forEach((section) => {
    if (section.type === 'heading') {
      let sectionNumber = '';
      
      if (section.level === 1) {
        chapterNum++;
        subSectionNum = 0;
        subSubSectionNum = 0;
        sectionNumber = `${chapterNum}.`;
        
        // Page break before major chapters (except first)
        if (chapterNum > 1) {
          elements.push(
            new Paragraph({
              children: [new PageBreak()],
            })
          );
        }
      } else if (section.level === 2) {
        subSectionNum++;
        subSubSectionNum = 0;
        sectionNumber = `${chapterNum}.${subSectionNum}`;
      } else if (section.level === 3) {
        subSubSectionNum++;
        sectionNumber = `${chapterNum}.${subSectionNum}.${subSubSectionNum}`;
      }

      const size = section.level === 1 ? 48 : section.level === 2 ? 36 : 28;
      const headingColor = section.level === 1 ? COLORS.primary : COLORS.black;
      const spacing = section.level === 1 
        ? { before: 400, after: 300 } 
        : section.level === 2 
          ? { before: 300, after: 200 }
          : { before: 200, after: 150 };

      elements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: sectionNumber + " ",
              bold: true,
              size,
              color: COLORS.primary,
            }),
            new TextRun({
              text: section.text,
              bold: true,
              size,
              color: headingColor,
            }),
          ],
          spacing,
        })
      );

      // Add underline for level 1 headings
      if (section.level === 1) {
        elements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "━".repeat(40),
                size: 16,
                color: COLORS.primary,
              }),
            ],
            spacing: { after: 300 },
          })
        );
      }
    } else {
      // Regular paragraph
      elements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.text,
              size: 22,
              color: COLORS.darkGray,
            }),
          ],
          spacing: { after: 200 },
        })
      );
    }
  });

  // Add images in appendix if present
  if (images.length > 0) {
    elements.push(
      new Paragraph({
        children: [new PageBreak()],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Appendix: ",
            bold: true,
            size: 44,
            color: COLORS.black,
          }),
          new TextRun({
            text: "Document Images",
            bold: true,
            size: 44,
            color: COLORS.primary,
          }),
        ],
        spacing: { after: 400 },
      })
    );

    for (const img of images) {
      try {
        const imageType = img.mimeType.includes('png') ? 'png' : 'jpg';
        elements.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: base64ToUint8Array(img.base64),
                transformation: { width: 500, height: 375 },
                type: imageType as 'png' | 'jpg',
              }),
            ],
            spacing: { before: 300, after: 300 },
            alignment: AlignmentType.CENTER,
          })
        );
      } catch (e) {
        console.log(`[transform-document-design] Could not add image: ${img.id}`);
      }
    }
  }

  return elements;
}

// Main function to transform document to Sentra template
async function transformToTemplate(base64Content: string, settings: BrandSettings): Promise<{ modifiedFile: string; message: string }> {
  console.log('[transform-document-design] Transforming document to Sentra template');
  
  try {
    const extracted = await extractDocxContent(base64Content);
    
    if (extracted.sections.length === 0) {
      return {
        modifiedFile: base64Content,
        message: 'Could not extract content from document. Please try a different file or use the Create Document feature.',
      };
    }

    console.log(`[transform-document-design] Building new document with ${extracted.sections.length} sections`);
    console.log(`[transform-document-design] Document title: "${extracted.title}"`);

    // Build document children
    const docChildren: (Paragraph | Table)[] = [];

    // Cover page
    docChildren.push(...createCoverPage(
      extracted.title || 'Untitled Document',
      extracted.isConfidential
    ));

    // Table of Contents
    docChildren.push(...createTableOfContents(extracted.sections));

    // Content pages
    docChildren.push(...createContentPages(extracted.sections, extracted.images));

    // Create the document
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: "Arial",
              size: 22,
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "sentra",
                      bold: true,
                      size: 20,
                      color: COLORS.black,
                    }),
                    new TextRun({
                      text: "  |  WHITEPAPER",
                      size: 18,
                      color: COLORS.gray,
                    }),
                  ],
                  border: {
                    bottom: {
                      color: COLORS.primary,
                      space: 4,
                      size: 12,
                      style: BorderStyle.SINGLE,
                    },
                  },
                  spacing: { after: 200 },
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "© 2025 Sentra Inc. All rights reserved.",
                      size: 16,
                      color: COLORS.lightGray,
                    }),
                    new TextRun({
                      text: "                    ",
                    }),
                    new TextRun({
                      text: "www.sentra.io",
                      size: 16,
                      color: COLORS.primary,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          children: docChildren,
        },
      ],
    });

    // Generate the DOCX buffer
    const buffer = await Packer.toBuffer(doc);
    const base64Doc = arrayBufferToBase64(buffer);

    console.log('[transform-document-design] Document transformation complete');

    return {
      modifiedFile: base64Doc,
      message: `Document transformed to Sentra template! Title: "${extracted.title}". Extracted ${extracted.sections.length} sections and ${extracted.images.length} images.`,
    };
  } catch (error) {
    console.error('[transform-document-design] Transformation error:', error);
    return {
      modifiedFile: base64Content,
      message: `Transformation failed: ${error.message}. Returning original file.`,
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RequestBody = await req.json();
    const { file, fileName, fileType, settings } = body;

    console.log(`[transform-document-design] Processing file: ${fileName}, type: ${fileType}`);

    let result: { modifiedFile: string; message: string };
    let outputType: 'docx' | 'pdf' = 'docx';

    if (fileType.includes('pdf')) {
      result = {
        modifiedFile: file,
        message: 'PDF transformation requires converting to DOCX first. Please upload a DOCX file for full template transformation.',
      };
      outputType = 'pdf';
    } else if (fileType.includes('word') || fileType.includes('docx') || fileName.endsWith('.docx')) {
      result = await transformToTemplate(file, settings);
      outputType = 'docx';
    } else {
      return new Response(
        JSON.stringify({ error: 'Unsupported file type. Please upload a DOCX file.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[transform-document-design] Successfully processed document');

    return new Response(
      JSON.stringify({
        type: outputType,
        modifiedFile: result.modifiedFile,
        originalFileName: fileName,
        message: result.message,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[transform-document-design] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
