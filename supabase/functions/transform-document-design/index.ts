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
} from "npm:docx@8.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sentra brand colors (matching the template)
const COLORS = {
  primary: "39FF14", // Neon Green
  primaryDark: "32CD32",
  orange: "FFA500",
  pink: "FF1493",
  cyan: "00FFFF",
  black: "050505",
  white: "FFFFFF",
  gray: "6B7280",
  lightGray: "9CA3AF",
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
  sections: ExtractedSection[];
  images: ExtractedImage[];
  isConfidential: boolean;
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
    const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    const styleRegex = /<w:pStyle w:val="([^"]*)"/;
    
    let match;
    let foundTitle = false;
    
    while ((match = paragraphRegex.exec(documentXml)) !== null) {
      const paragraphContent = match[1];
      
      // Extract all text from this paragraph
      let paragraphText = '';
      let textMatch;
      const textMatches = paragraphContent.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      for (const tm of textMatches) {
        paragraphText += tm[1];
      }
      
      paragraphText = paragraphText.trim();
      if (!paragraphText) continue;
      
      // Check if it's a heading
      const styleMatch = styleRegex.exec(paragraphContent);
      const styleName = styleMatch ? styleMatch[1] : '';
      
      let isHeading = false;
      let headingLevel = 0;
      
      if (styleName.match(/Heading1|Title/i) || paragraphContent.includes('w:outlineLvl w:val="0"')) {
        isHeading = true;
        headingLevel = 1;
        if (!foundTitle && paragraphText.length > 3) {
          title = paragraphText;
          foundTitle = true;
        }
      } else if (styleName.match(/Heading2/i) || paragraphContent.includes('w:outlineLvl w:val="1"')) {
        isHeading = true;
        headingLevel = 2;
      } else if (styleName.match(/Heading3/i) || paragraphContent.includes('w:outlineLvl w:val="2"')) {
        isHeading = true;
        headingLevel = 3;
      }
      
      // Skip very short text that's likely formatting artifacts
      if (paragraphText.length < 2) continue;
      
      // Skip page numbers and common artifacts
      if (/^\d+$/.test(paragraphText) || paragraphText.toLowerCase() === 'sentra') continue;
      
      sections.push({
        type: isHeading ? 'heading' : 'paragraph',
        text: paragraphText,
        level: isHeading ? headingLevel : undefined,
      });
    }
  }

  console.log(`[transform-document-design] Extracted ${sections.length} sections, title: "${title}"`);
  
  return { title, sections, images, isConfidential };
}

// Generate cover page
function createCoverPage(title: string, isConfidential: boolean, logoBase64: string | null): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Logo placeholder (will use text if no image)
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "sentra",
          bold: true,
          size: 48,
          color: COLORS.black,
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Confidential badge (only if confidential)
  if (isConfidential) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "CONFIDENTIAL",
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
        spacing: { after: 600 },
      })
    );
  }

  // Spacer
  paragraphs.push(
    new Paragraph({
      children: [],
      spacing: { before: 2000 },
    })
  );

  // Category badge
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "● ",
          color: COLORS.primary,
          size: 16,
        }),
        new TextRun({
          text: "TECHNICAL WHITEPAPER",
          color: COLORS.primary,
          bold: true,
          size: 22,
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Title
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 72,
          color: COLORS.black,
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Metadata
  const today = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  paragraphs.push(
    new Paragraph({
      children: [],
      spacing: { before: 1500 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "AUTHOR",
          size: 18,
          color: COLORS.gray,
        }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Sentra, Inc",
          size: 24,
          bold: true,
          color: COLORS.black,
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "DATE",
          size: 18,
          color: COLORS.gray,
        }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: today,
          size: 24,
          bold: true,
          color: COLORS.black,
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Page break after cover
  paragraphs.push(
    new Paragraph({
      children: [new PageBreak()],
    })
  );

  return paragraphs;
}

// Generate Table of Contents from headings
function createTableOfContents(sections: ExtractedSection[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  
  const headings = sections.filter(s => s.type === 'heading' && s.level === 1 || s.level === 2);
  
  if (headings.length === 0) {
    return paragraphs;
  }

  // TOC Title
  paragraphs.push(
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
      alignment: AlignmentType.CENTER,
    })
  );

  let pageNum = 3; // Start content from page 3
  headings.forEach((heading) => {
    const indent = heading.level === 2 ? 400 : 0;
    const size = heading.level === 1 ? 26 : 22;
    const isBold = heading.level === 1;

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "● ",
            color: COLORS.primary,
            size: 14,
          }),
          new TextRun({
            text: heading.text,
            size,
            bold: isBold,
            color: COLORS.black,
          }),
          new TextRun({
            text: " ",
            size,
          }),
          new TextRun({
            text: ".".repeat(40),
            size: 14,
            color: COLORS.lightGray,
          }),
          new TextRun({
            text: ` ${pageNum}`,
            size,
            color: COLORS.gray,
          }),
        ],
        indent: { left: indent },
        spacing: { after: 120 },
      })
    );
    
    if (heading.level === 1) pageNum++;
  });

  // Page break after TOC
  paragraphs.push(
    new Paragraph({
      children: [new PageBreak()],
    })
  );

  return paragraphs;
}

// Generate content pages with Sentra styling
function createContentPages(sections: ExtractedSection[], images: ExtractedImage[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let imageIndex = 0;

  sections.forEach((section) => {
    if (section.type === 'heading') {
      const size = section.level === 1 ? 48 : section.level === 2 ? 36 : 28;
      const color = section.level === 1 ? COLORS.primary : COLORS.black;
      const spacing = section.level === 1 ? { before: 400, after: 200 } : { before: 300, after: 150 };

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.text,
              bold: true,
              size,
              color,
            }),
          ],
          spacing,
        })
      );
    } else {
      // Regular paragraph
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.text,
              size: 24,
              color: COLORS.black,
            }),
          ],
          spacing: { after: 200 },
        })
      );
    }
  });

  // Add images at the end (or we could try to place them contextually)
  if (images.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [new PageBreak()],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Appendix: Document Images",
            bold: true,
            size: 36,
            color: COLORS.primary,
          }),
        ],
        spacing: { after: 400 },
      })
    );

    for (const img of images) {
      try {
        const imageType = img.mimeType.includes('png') ? 'png' : 'jpg';
        paragraphs.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: base64ToUint8Array(img.base64),
                transformation: { width: 400, height: 300 },
                type: imageType as 'png' | 'jpg',
              }),
            ],
            spacing: { before: 200, after: 200 },
            alignment: AlignmentType.CENTER,
          })
        );
      } catch (e) {
        console.log(`[transform-document-design] Could not add image: ${img.id}`);
      }
    }
  }

  return paragraphs;
}

// Main function to transform document to Sentra template
async function transformToTemplate(base64Content: string, settings: BrandSettings): Promise<{ modifiedFile: string; message: string }> {
  console.log('[transform-document-design] Transforming document to Sentra template');
  
  try {
    // Step 1: Extract content from the uploaded document
    const extracted = await extractDocxContent(base64Content);
    
    if (extracted.sections.length === 0) {
      return {
        modifiedFile: base64Content,
        message: 'Could not extract content from document. Please try a different file or use the Create Document feature.',
      };
    }

    console.log(`[transform-document-design] Building new document with ${extracted.sections.length} sections`);

    // Step 2: Build new document with Sentra template
    const docChildren: Paragraph[] = [];

    // Cover page
    docChildren.push(...createCoverPage(
      extracted.title || 'Document',
      extracted.isConfidential,
      null // Logo will be text-based for now
    ));

    // Table of Contents
    docChildren.push(...createTableOfContents(extracted.sections));

    // Content pages
    docChildren.push(...createContentPages(extracted.sections, extracted.images));

    // Create the document with Sentra styling
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: settings.headingFont || "Poppins",
              size: 24,
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440,
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
                      text: "  |  " + (extracted.title || 'Document'),
                      size: 18,
                      color: COLORS.gray,
                    }),
                  ],
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
                  ],
                  alignment: AlignmentType.LEFT,
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
      message: `Document transformed to Sentra template! Extracted ${extracted.sections.length} sections and ${extracted.images.length} images. ${extracted.isConfidential ? 'Marked as confidential.' : ''}`,
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
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

    // Parse request body
    const body: RequestBody = await req.json();
    const { file, fileName, fileType, settings } = body;

    console.log(`[transform-document-design] Processing file: ${fileName}, type: ${fileType}`);

    let result: { modifiedFile: string; message: string };
    let outputType: 'docx' | 'pdf' = 'docx';

    // Process based on file type
    if (fileType.includes('pdf')) {
      // For PDFs, we can't easily extract content without conversion
      result = {
        modifiedFile: file,
        message: 'PDF transformation requires converting to DOCX first. Please upload a DOCX file for full template transformation, or use the Create Document feature.',
      };
      outputType = 'pdf';
    } else if (fileType.includes('word') || fileType.includes('docx') || fileName.endsWith('.docx')) {
      // Transform DOCX to Sentra template
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
