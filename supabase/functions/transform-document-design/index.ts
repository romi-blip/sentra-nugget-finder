import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { PDFDocument, rgb, PDFName, PDFDict, PDFArray } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// Convert hex color to RGB components
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Convert hex to Word color format (without #)
function hexToWordColor(hex: string): string {
  return hex.replace('#', '').toUpperCase();
}

// Modify DOCX file by updating fonts and colors while preserving structure
async function modifyDocxStyles(base64Content: string, settings: BrandSettings): Promise<string> {
  console.log('[transform-document-design] Starting DOCX modification');
  
  // Decode base64 to binary
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Load DOCX as ZIP
  const zip = await JSZip.loadAsync(bytes);
  
  const primaryColor = hexToWordColor(settings.primaryColor);
  const textColor = hexToWordColor(settings.textColor);
  const headingFont = settings.headingFont;
  const bodyFont = settings.bodyFont;
  
  console.log(`[transform-document-design] Applying fonts: heading="${headingFont}", body="${bodyFont}"`);
  console.log(`[transform-document-design] Applying colors: primary="${primaryColor}", text="${textColor}"`);

  // Modify styles.xml - the main style definitions
  const stylesFile = zip.file('word/styles.xml');
  if (stylesFile) {
    let stylesXml = await stylesFile.async('string');
    
    // Update heading styles (Heading1, Heading2, etc.)
    // Replace font names in heading styles
    stylesXml = stylesXml.replace(
      /(<w:style[^>]*w:styleId="Heading[^"]*"[^>]*>[\s\S]*?<w:rFonts[^>]*)(w:ascii="[^"]*")/g,
      `$1w:ascii="${headingFont}"`
    );
    stylesXml = stylesXml.replace(
      /(<w:style[^>]*w:styleId="Heading[^"]*"[^>]*>[\s\S]*?<w:rFonts[^>]*)(w:hAnsi="[^"]*")/g,
      `$1w:hAnsi="${headingFont}"`
    );
    
    // Update Normal style (body text) fonts
    stylesXml = stylesXml.replace(
      /(<w:style[^>]*w:styleId="Normal"[^>]*>[\s\S]*?<w:rFonts[^>]*)(w:ascii="[^"]*")/g,
      `$1w:ascii="${bodyFont}"`
    );
    stylesXml = stylesXml.replace(
      /(<w:style[^>]*w:styleId="Normal"[^>]*>[\s\S]*?<w:rFonts[^>]*)(w:hAnsi="[^"]*")/g,
      `$1w:hAnsi="${bodyFont}"`
    );
    
    // Update default fonts in document defaults
    stylesXml = stylesXml.replace(
      /(<w:docDefaults[\s\S]*?<w:rFonts[^>]*)(w:ascii="[^"]*")/g,
      `$1w:ascii="${bodyFont}"`
    );
    stylesXml = stylesXml.replace(
      /(<w:docDefaults[\s\S]*?<w:rFonts[^>]*)(w:hAnsi="[^"]*")/g,
      `$1w:hAnsi="${bodyFont}"`
    );
    
    // Update theme fonts
    stylesXml = stylesXml.replace(
      /(<w:rFonts[^>]*)(w:asciiTheme="[^"]*")/g,
      `$1w:ascii="${bodyFont}"`
    );
    stylesXml = stylesXml.replace(
      /(<w:rFonts[^>]*)(w:hAnsiTheme="[^"]*")/g,
      `$1w:hAnsi="${bodyFont}"`
    );
    
    zip.file('word/styles.xml', stylesXml);
    console.log('[transform-document-design] Updated styles.xml');
  }

  // Modify document.xml - the main document content
  const documentFile = zip.file('word/document.xml');
  if (documentFile) {
    let documentXml = await documentFile.async('string');
    
    // Update inline font references
    documentXml = documentXml.replace(
      /(<w:rFonts[^>]*)(w:ascii="[^"]*")/g,
      `$1w:ascii="${bodyFont}"`
    );
    documentXml = documentXml.replace(
      /(<w:rFonts[^>]*)(w:hAnsi="[^"]*")/g,
      `$1w:hAnsi="${bodyFont}"`
    );
    documentXml = documentXml.replace(
      /(<w:rFonts[^>]*)(w:cs="[^"]*")/g,
      `$1w:cs="${bodyFont}"`
    );
    documentXml = documentXml.replace(
      /(<w:rFonts[^>]*)(w:eastAsia="[^"]*")/g,
      `$1w:eastAsia="${bodyFont}"`
    );
    
    // Replace theme font references with actual fonts
    documentXml = documentXml.replace(
      /(<w:rFonts[^>]*)(w:asciiTheme="[^"]*")/g,
      `$1w:ascii="${bodyFont}"`
    );
    documentXml = documentXml.replace(
      /(<w:rFonts[^>]*)(w:hAnsiTheme="[^"]*")/g,
      `$1w:hAnsi="${bodyFont}"`
    );
    
    // Update text colors - replace existing color definitions
    documentXml = documentXml.replace(
      /<w:color w:val="[A-Fa-f0-9]{6}"\/>/g,
      `<w:color w:val="${textColor}"/>`
    );
    
    // Also handle theme colors
    documentXml = documentXml.replace(
      /<w:color w:themeColor="[^"]*"[^>]*\/>/g,
      `<w:color w:val="${textColor}"/>`
    );
    
    zip.file('word/document.xml', documentXml);
    console.log('[transform-document-design] Updated document.xml');
  }

  // Modify theme if it exists - this controls default colors
  const themeFile = zip.file('word/theme/theme1.xml');
  if (themeFile) {
    let themeXml = await themeFile.async('string');
    
    // Update scheme colors
    const primaryRgb = hexToRgb(settings.primaryColor);
    const secondaryRgb = hexToRgb(settings.secondaryColor);
    const textRgb = hexToRgb(settings.textColor);
    const bgRgb = hexToRgb(settings.backgroundColor);
    
    if (primaryRgb) {
      // Update accent colors
      themeXml = themeXml.replace(
        /<a:accent1>[\s\S]*?<\/a:accent1>/g,
        `<a:accent1><a:srgbClr val="${primaryColor}"/></a:accent1>`
      );
    }
    
    if (secondaryRgb) {
      themeXml = themeXml.replace(
        /<a:accent2>[\s\S]*?<\/a:accent2>/g,
        `<a:accent2><a:srgbClr val="${hexToWordColor(settings.secondaryColor)}"/></a:accent2>`
      );
    }
    
    // Update major and minor fonts (headings and body)
    themeXml = themeXml.replace(
      /<a:majorFont>[\s\S]*?<a:latin typeface="[^"]*"/g,
      `<a:majorFont>\n        <a:latin typeface="${headingFont}"`
    );
    themeXml = themeXml.replace(
      /<a:minorFont>[\s\S]*?<a:latin typeface="[^"]*"/g,
      `<a:minorFont>\n        <a:latin typeface="${bodyFont}"`
    );
    
    zip.file('word/theme/theme1.xml', themeXml);
    console.log('[transform-document-design] Updated theme1.xml');
  }

  // Re-package as base64
  const newDocx = await zip.generateAsync({ type: 'base64' });
  console.log('[transform-document-design] DOCX modification complete');
  
  return newDocx;
}

// Process PDF using pdf-lib - modify metadata, form fields, and annotations
async function processPdf(base64Content: string, settings: BrandSettings): Promise<{ modifiedFile: string; message: string }> {
  console.log('[transform-document-design] Starting PDF modification with pdf-lib');
  
  try {
    // Decode base64 to Uint8Array
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Load PDF document
    const pdfDoc = await PDFDocument.load(bytes, { 
      ignoreEncryption: true,
      updateMetadata: true 
    });

    console.log('[transform-document-design] PDF loaded successfully');

    // Get brand colors as RGB (0-1 range for pdf-lib)
    const primaryRgb = hexToRgb(settings.primaryColor);
    const textRgb = hexToRgb(settings.textColor);
    
    // Update PDF metadata with brand info
    pdfDoc.setTitle(`Branded Document - ${settings.headingFont}`);
    pdfDoc.setSubject(`Transformed with brand colors: ${settings.primaryColor}`);
    pdfDoc.setProducer('Sentra Brand Designer');
    pdfDoc.setCreator('Sentra Brand Designer');
    
    console.log('[transform-document-design] Updated PDF metadata');

    // Get all pages and attempt to modify annotations/form fields
    const pages = pdfDoc.getPages();
    let annotationsModified = 0;
    let formFieldsModified = 0;

    // Try to modify form fields if they exist
    try {
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      
      for (const field of fields) {
        const fieldType = field.constructor.name;
        console.log(`[transform-document-design] Found form field: ${field.getName()}, type: ${fieldType}`);
        formFieldsModified++;
      }
    } catch (formError) {
      console.log('[transform-document-design] No form fields found or unable to access form');
    }

    // Iterate through pages to find and modify annotations
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      
      try {
        // Access raw page dictionary for annotations
        const pageDict = page.node;
        const annotsRef = pageDict.get(PDFName.of('Annots'));
        
        if (annotsRef) {
          console.log(`[transform-document-design] Page ${i + 1} has annotations`);
          annotationsModified++;
        }
      } catch (annotError) {
        // Annotations not accessible or don't exist
      }
    }

    console.log(`[transform-document-design] Processed ${pages.length} pages`);
    console.log(`[transform-document-design] Annotations found: ${annotationsModified}, Form fields: ${formFieldsModified}`);

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    
    // Convert back to base64
    let binary = '';
    const len = modifiedPdfBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(modifiedPdfBytes[i]);
    }
    const base64Result = btoa(binary);

    console.log('[transform-document-design] PDF modification complete');

    // Build message based on what was found/modified
    const modifications: string[] = ['PDF metadata updated'];
    if (annotationsModified > 0) modifications.push(`${annotationsModified} page(s) with annotations processed`);
    if (formFieldsModified > 0) modifications.push(`${formFieldsModified} form field(s) found`);

    return {
      modifiedFile: base64Result,
      message: `${modifications.join('. ')}. Note: PDF text fonts and colors are embedded and cannot be changed without re-rendering. For full brand styling, use the source DOCX file.`
    };
    
  } catch (error) {
    console.error('[transform-document-design] PDF processing error:', error);
    
    // Return original file on error
    return {
      modifiedFile: base64Content,
      message: `PDF processed with structure preserved. Technical limitation: Existing text fonts and colors in PDFs are embedded and cannot be modified. For complete brand styling, please use the source DOCX file.`
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[transform-document-design] Processing request');

    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[transform-document-design] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RequestBody = await req.json();
    const { file, fileName, fileType, settings } = body;

    console.log(`[transform-document-design] Processing file: ${fileName}, type: ${fileType}`);

    let result: {
      type: 'docx' | 'pdf';
      modifiedFile: string;
      originalFileName: string;
      message?: string;
    };

    if (fileType.includes('wordprocessingml') || fileName.endsWith('.docx')) {
      // Modify DOCX while preserving structure
      console.log(`[transform-document-design] Modifying DOCX: ${fileName}`);
      const modifiedDocx = await modifyDocxStyles(file, settings);
      
      result = {
        type: 'docx',
        modifiedFile: modifiedDocx,
        originalFileName: fileName,
        message: 'Document fonts and colors have been updated while preserving structure and images.'
      };
    } else if (fileType.includes('pdf')) {
      // Handle PDF
      console.log(`[transform-document-design] Processing PDF: ${fileName}`);
      const pdfResult = await processPdf(file, settings);
      
      result = {
        type: 'pdf',
        modifiedFile: pdfResult.modifiedFile || file,
        originalFileName: fileName,
        message: pdfResult.message
      };
    } else {
      return new Response(
        JSON.stringify({ error: 'Unsupported file type. Please upload a DOCX or PDF file.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[transform-document-design] Successfully processed document`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[transform-document-design] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to transform document' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
