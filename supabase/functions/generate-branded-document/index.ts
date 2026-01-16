import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  AlignmentType,
  HeadingLevel,
  Table,
  TableCell,
  TableRow,
  WidthType,
  BorderStyle,
  ShadingType,
  PageBreak,
} from "https://esm.sh/docx@8.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brand colors from exact SVG template
const COLORS = {
  // Primary neon green from template #66FF66
  primary: "66FF66",
  primaryDark: "32CD32",
  // Orange accent from logo #FFAE1A
  orange: "FFAE1A",
  // Footer bar colors
  pink: "FF1493",
  cyan: "00FFFF",
  yellow: "FFD700",
  // Backgrounds and text
  black: "000000",
  white: "FFFFFF",
  // Light text from template #F0F0F0
  lightText: "F0F0F0",
  gray: "6B7280",
  lightGray: "9CA3AF",
  darkGray: "1F2937",
  textGray: "374151",
};

interface DocumentMetadata {
  title: string;
  subtitle?: string;
  category: string;
  preparedFor: string;
  version: string;
  author: string;
  date: string;
  confidential: boolean;
}

interface TOCItem {
  id: string;
  title: string;
  page: number;
  level: 1 | 2 | 3;
  subsections?: TOCItem[];
}

interface ContentSection {
  id: string;
  type: "heading" | "text" | "text-image";
  chapterNumber?: string;
  title?: string;
  subtitle?: string;
  content: string;
  imageBase64?: string;
  imageMimeType?: string;
  imageCaption?: string;
}

interface FooterConfig {
  showSeparator: boolean;
  separatorColor: string;
  separatorThickness: number;
  leftType: 'none' | 'text' | 'page_number' | 'image';
  leftText?: string | null;
  leftImageBase64?: string | null;
  leftImageMime?: string | null;
  middleType: 'none' | 'text' | 'page_number' | 'image';
  middleText?: string | null;
  middleImageBase64?: string | null;
  middleImageMime?: string | null;
  rightType: 'none' | 'text' | 'page_number' | 'image';
  rightText?: string | null;
  rightImageBase64?: string | null;
  rightImageMime?: string | null;
}

interface RequestBody {
  metadata: DocumentMetadata;
  tableOfContents: TOCItem[];
  sections: ContentSection[];
  logoBase64: string;
  tocFooterConfig?: FooterConfig;
  contentFooterConfig?: FooterConfig;
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

// Create the cover page with BLACK background styling
function createCoverPage(metadata: DocumentMetadata, logoBase64: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Logo
  if (logoBase64) {
    try {
      paragraphs.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: base64ToUint8Array(logoBase64),
              transformation: { width: 150, height: 60 },
              type: "jpg",
            }),
          ],
          spacing: { after: 400 },
        })
      );
    } catch (e) {
      console.error("Error adding logo:", e);
    }
  }

  // Confidential badge (only if confidential)
  if (metadata.confidential) {
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
            text: " - Internal Use Only",
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

  // Category badge with green bullet
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "● ",
          color: COLORS.primary,
          size: 16,
        }),
        new TextRun({
          text: metadata.category.toUpperCase(),
          color: COLORS.primary,
          bold: true,
          size: 22,
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Title in neon green
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: metadata.title,
          bold: true,
          size: 72,
          color: COLORS.primary,
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Subtitle
  if (metadata.subtitle) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: metadata.subtitle,
            size: 32,
            color: COLORS.gray,
          }),
        ],
        spacing: { after: 800 },
      })
    );
  }

  // Spacer before metadata
  paragraphs.push(
    new Paragraph({
      children: [],
      spacing: { before: 1000 },
    })
  );

  // Metadata grid
  const metadataItems = [
    { label: "Prepared For", value: metadata.preparedFor },
    { label: "Version", value: metadata.version },
    { label: "Author", value: metadata.author },
    { label: "Date", value: metadata.date },
  ];

  metadataItems.forEach((item) => {
    if (item.value) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: item.label.toUpperCase(),
              size: 18,
              color: COLORS.gray,
            }),
          ],
          spacing: { after: 40 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: item.value,
              size: 24,
              bold: true,
              color: COLORS.black,
            }),
          ],
          spacing: { after: 200 },
        })
      );
    }
  });

  // Page break after cover
  paragraphs.push(
    new Paragraph({
      children: [new PageBreak()],
    })
  );

  return paragraphs;
}

// Create Table of Contents
function createTableOfContents(items: TOCItem[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // TOC Title with "Contents" in green
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

  // TOC Items
  items.forEach((item) => {
    const indent = item.level === 1 ? 0 : item.level === 2 ? 400 : 800;
    const size = item.level === 1 ? 26 : 22;
    const isBold = item.level === 1;

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "● ",
            color: COLORS.primary,
            size: 14,
          }),
          new TextRun({
            text: item.title,
            size,
            bold: isBold,
            color: COLORS.black,
          }),
          new TextRun({
            text: " ",
            size,
          }),
          new TextRun({
            text: ".".repeat(50),
            size: 14,
            color: COLORS.lightGray,
          }),
          new TextRun({
            text: ` ${item.page}`,
            size,
            color: COLORS.gray,
          }),
        ],
        indent: { left: indent },
        spacing: { after: 120 },
      })
    );

    // Subsections
    if (item.subsections) {
      item.subsections.forEach((sub) => {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: sub.title,
                size: 20,
                color: COLORS.gray,
              }),
              new TextRun({
                text: " ",
                size: 20,
              }),
              new TextRun({
                text: ".".repeat(40),
                size: 12,
                color: COLORS.lightGray,
              }),
              new TextRun({
                text: ` ${sub.page}`,
                size: 20,
                color: COLORS.gray,
              }),
            ],
            indent: { left: 800 },
            spacing: { after: 80 },
          })
        );
      });
    }
  });

  // Page break after TOC
  paragraphs.push(
    new Paragraph({
      children: [new PageBreak()],
    })
  );

  return paragraphs;
}

// Create content sections
function createContentSections(sections: ContentSection[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  sections.forEach((section) => {
    if (section.type === "heading") {
      // Chapter number and title in neon green
      if (section.chapterNumber) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.chapterNumber + " ",
                bold: true,
                size: 48,
                color: COLORS.primary,
              }),
              new TextRun({
                text: section.title || "",
                bold: true,
                size: 48,
                color: COLORS.primary,
              }),
            ],
            spacing: { before: 400, after: 200 },
          })
        );
      } else if (section.title) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.title,
                bold: true,
                size: 48,
                color: COLORS.primary,
              }),
            ],
            spacing: { before: 400, after: 200 },
          })
        );
      }

      // Subtitle
      if (section.subtitle) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.subtitle,
                size: 32,
                color: COLORS.gray,
              }),
            ],
            spacing: { after: 400 },
          })
        );
      }
    }

    // Content paragraphs in dark gray text
    if (section.content) {
      const contentParagraphs = section.content.split("\n\n");
      contentParagraphs.forEach((para) => {
        if (para.trim()) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: para.trim(),
                  size: 24,
                  color: COLORS.textGray,
                }),
              ],
              spacing: { after: 200 },
            })
          );
        }
      });
    }

    // Image (if text-image type and has image)
    if (section.type === "text-image" && section.imageBase64) {
      try {
        const imageType = section.imageMimeType?.includes("png") ? "png" : "jpg";
        paragraphs.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: base64ToUint8Array(section.imageBase64),
                transformation: { width: 400, height: 300 },
                type: imageType as "png" | "jpg",
              }),
            ],
            spacing: { before: 200, after: 100 },
            alignment: AlignmentType.CENTER,
          })
        );

        if (section.imageCaption) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: section.imageCaption,
                  size: 18,
                  italics: true,
                  color: COLORS.gray,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
            })
          );
        }
      } catch (e) {
        console.error("Error adding image:", e);
      }
    }
  });

  return paragraphs;
}

// Create configurable footer
function createConfigurableFooter(config: FooterConfig | undefined): Footer {
  if (!config) {
    // Default footer
    return new Footer({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: "(c) 2025 Sentra Inc. All rights reserved.",
              size: 16,
              color: COLORS.lightGray,
            }),
          ],
          alignment: AlignmentType.LEFT,
        }),
      ],
    });
  }

  const createFooterCell = (
    type: string,
    text?: string | null,
    imageBase64?: string | null,
    imageMime?: string | null,
    alignment: AlignmentType = AlignmentType.LEFT
  ): TableCell => {
    const children: (TextRun | ImageRun)[] = [];

    if (type === 'text' && text) {
      children.push(
        new TextRun({
          text: text,
          size: 16,
          color: COLORS.gray,
        })
      );
    } else if (type === 'page_number') {
      children.push(
        new TextRun({
          text: "Page ",
          size: 16,
          color: COLORS.gray,
        }),
        new TextRun({
          children: [PageNumber.CURRENT],
          size: 16,
          color: COLORS.gray,
        }),
        new TextRun({
          text: " of ",
          size: 16,
          color: COLORS.gray,
        }),
        new TextRun({
          children: [PageNumber.TOTAL_PAGES],
          size: 16,
          color: COLORS.gray,
        })
      );
    } else if (type === 'image' && imageBase64) {
      try {
        const imageType = imageMime?.includes("png") ? "png" : "jpg";
        children.push(
          new ImageRun({
            data: base64ToUint8Array(imageBase64),
            transformation: { width: 60, height: 24 },
            type: imageType as "png" | "jpg",
          })
        );
      } catch (e) {
        console.error("Error adding footer image:", e);
      }
    }

    return new TableCell({
      children: [
        new Paragraph({
          children: children.length > 0 ? children : [new TextRun({ text: "" })],
          alignment,
        }),
      ],
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      },
      width: { size: 33.33, type: WidthType.PERCENTAGE },
    });
  };

  const tableRows: TableRow[] = [];

  // Add separator line row if enabled
  if (config.showSeparator) {
    const separatorColor = config.separatorColor?.replace('#', '') || 'CCCCCC';
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [] })],
            columnSpan: 3,
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { 
                style: BorderStyle.SINGLE, 
                size: (config.separatorThickness || 1) * 8, 
                color: separatorColor 
              },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
          }),
        ],
      })
    );
  }

  // Add content row
  tableRows.push(
    new TableRow({
      children: [
        createFooterCell(config.leftType, config.leftText, config.leftImageBase64, config.leftImageMime, AlignmentType.LEFT),
        createFooterCell(config.middleType, config.middleText, config.middleImageBase64, config.middleImageMime, AlignmentType.CENTER),
        createFooterCell(config.rightType, config.rightText, config.rightImageBase64, config.rightImageMime, AlignmentType.RIGHT),
      ],
    })
  );

  return new Footer({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
      }),
    ],
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { metadata, tableOfContents, sections, logoBase64, tocFooterConfig, contentFooterConfig } = body;

    console.log("Generating document:", metadata.title);
    console.log("Confidential:", metadata.confidential);
    console.log("Sections:", sections.length);
    console.log("TOC Footer Config:", tocFooterConfig ? "provided" : "default");
    console.log("Content Footer Config:", contentFooterConfig ? "provided" : "default");

    // Build document sections
    const coverChildren: Paragraph[] = [];
    const tocChildren: Paragraph[] = [];
    const contentChildren: Paragraph[] = [];

    // Cover page
    coverChildren.push(...createCoverPage(metadata, logoBase64));

    // Table of Contents (if provided)
    if (tableOfContents && tableOfContents.length > 0) {
      tocChildren.push(...createTableOfContents(tableOfContents));
    }

    // Content sections
    if (sections && sections.length > 0) {
      contentChildren.push(...createContentSections(sections));
    }

    // Create document sections array
    const documentSections = [];

    // Cover page section (no footer)
    if (coverChildren.length > 0) {
      documentSections.push({
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
        children: coverChildren,
      });
    }

    // TOC section with configurable footer
    if (tocChildren.length > 0) {
      documentSections.push({
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
                    text: " | TABLE OF CONTENTS",
                    size: 18,
                    color: COLORS.gray,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: createConfigurableFooter(tocFooterConfig),
        },
        children: tocChildren,
      });
    }

    // Content section with configurable footer
    if (contentChildren.length > 0) {
      documentSections.push({
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
                    text: " | WHITEPAPER",
                    size: 18,
                    color: COLORS.gray,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: createConfigurableFooter(contentFooterConfig),
        },
        children: contentChildren,
      });
    }

    // Create the document
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: "Helvetica",
              size: 24,
            },
          },
        },
      },
      sections: documentSections,
    });

    // Generate the DOCX buffer
    const buffer = await Packer.toBuffer(doc);
    const base64Doc = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    console.log("Document generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        document: base64Doc,
        filename: `${metadata.title.replace(/[^a-zA-Z0-9]/g, "_")}.docx`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating document:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
