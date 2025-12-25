import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";

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

// For PDF, we'll return a message about limitations since modifying embedded fonts in PDFs
// is extremely complex. We could use pdf-lib but it can only add content, not easily modify existing text.
async function processPdf(base64Content: string, settings: BrandSettings): Promise<{ modifiedFile: string | null; message: string }> {
  console.log('[transform-document-design] PDF processing - preserving original structure');
  
  // PDFs have fonts embedded and text already rendered - modifying them properly
  // requires re-rendering the entire document which is beyond simple processing.
  // We return the original file with a note about limitations.
  
  return {
    modifiedFile: base64Content, // Return original for now
    message: 'PDF files have embedded fonts and rendered text. For best results with brand fonts and colors, please use the original source document (DOCX) if available. The PDF structure and images are preserved.'
  };
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
