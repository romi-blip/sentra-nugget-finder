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

interface CloudConvertJob {
  id: string;
  status: string;
  tasks: Array<{
    id: string;
    name: string;
    operation: string;
    status: string;
    result?: {
      files?: Array<{
        url: string;
        filename: string;
      }>;
    };
  }>;
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

// Wait for CloudConvert job to complete
async function waitForJob(jobId: string, apiKey: string, maxWaitMs = 120000): Promise<CloudConvertJob> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to check job status: ${response.statusText}`);
    }
    
    const { data: job } = await response.json();
    
    if (job.status === 'finished') {
      return job;
    }
    
    if (job.status === 'error') {
      const errorTask = job.tasks?.find((t: any) => t.status === 'error');
      throw new Error(`CloudConvert job failed: ${errorTask?.message || 'Unknown error'}`);
    }
    
    // Wait 2 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('CloudConvert job timed out');
}

// Convert PDF to DOCX using CloudConvert
async function convertPdfToDocx(pdfBase64: string, apiKey: string): Promise<string> {
  console.log('[transform-document-design] Converting PDF to DOCX via CloudConvert');
  
  // Create conversion job
  const jobResponse = await fetch('https://api.cloudconvert.com/v2/jobs', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tasks: {
        'import-pdf': {
          operation: 'import/base64',
          file: pdfBase64,
          filename: 'input.pdf',
        },
        'convert-to-docx': {
          operation: 'convert',
          input: 'import-pdf',
          output_format: 'docx',
        },
        'export-docx': {
          operation: 'export/url',
          input: 'convert-to-docx',
        },
      },
    }),
  });
  
  if (!jobResponse.ok) {
    const error = await jobResponse.text();
    throw new Error(`Failed to create CloudConvert job: ${error}`);
  }
  
  const { data: job } = await jobResponse.json();
  console.log(`[transform-document-design] CloudConvert job created: ${job.id}`);
  
  // Wait for job completion
  const completedJob = await waitForJob(job.id, apiKey);
  
  // Find export task and get download URL
  const exportTask = completedJob.tasks.find(t => t.name === 'export-docx');
  const downloadUrl = exportTask?.result?.files?.[0]?.url;
  
  if (!downloadUrl) {
    throw new Error('No download URL in CloudConvert response');
  }
  
  // Download the DOCX file
  const docxResponse = await fetch(downloadUrl);
  if (!docxResponse.ok) {
    throw new Error(`Failed to download converted DOCX: ${docxResponse.statusText}`);
  }
  
  const docxArrayBuffer = await docxResponse.arrayBuffer();
  const docxBase64 = btoa(String.fromCharCode(...new Uint8Array(docxArrayBuffer)));
  
  console.log('[transform-document-design] PDF to DOCX conversion complete');
  return docxBase64;
}

// Convert DOCX to PDF using CloudConvert
async function convertDocxToPdf(docxBase64: string, apiKey: string): Promise<string> {
  console.log('[transform-document-design] Converting DOCX to PDF via CloudConvert');
  
  // Create conversion job
  const jobResponse = await fetch('https://api.cloudconvert.com/v2/jobs', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tasks: {
        'import-docx': {
          operation: 'import/base64',
          file: docxBase64,
          filename: 'styled.docx',
        },
        'convert-to-pdf': {
          operation: 'convert',
          input: 'import-docx',
          output_format: 'pdf',
        },
        'export-pdf': {
          operation: 'export/url',
          input: 'convert-to-pdf',
        },
      },
    }),
  });
  
  if (!jobResponse.ok) {
    const error = await jobResponse.text();
    throw new Error(`Failed to create CloudConvert job: ${error}`);
  }
  
  const { data: job } = await jobResponse.json();
  console.log(`[transform-document-design] CloudConvert job created: ${job.id}`);
  
  // Wait for job completion
  const completedJob = await waitForJob(job.id, apiKey);
  
  // Find export task and get download URL
  const exportTask = completedJob.tasks.find(t => t.name === 'export-pdf');
  const downloadUrl = exportTask?.result?.files?.[0]?.url;
  
  if (!downloadUrl) {
    throw new Error('No download URL in CloudConvert response');
  }
  
  // Download the PDF file
  const pdfResponse = await fetch(downloadUrl);
  if (!pdfResponse.ok) {
    throw new Error(`Failed to download converted PDF: ${pdfResponse.statusText}`);
  }
  
  const pdfArrayBuffer = await pdfResponse.arrayBuffer();
  const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfArrayBuffer)));
  
  console.log('[transform-document-design] DOCX to PDF conversion complete');
  return pdfBase64;
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
    
    // Update text colors
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

  // Modify theme if it exists
  const themeFile = zip.file('word/theme/theme1.xml');
  if (themeFile) {
    let themeXml = await themeFile.async('string');
    
    const primaryRgb = hexToRgb(settings.primaryColor);
    const secondaryRgb = hexToRgb(settings.secondaryColor);
    
    if (primaryRgb) {
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
    
    // Update major and minor fonts
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

// Process PDF using CloudConvert: PDF → DOCX → Apply Styles → PDF
async function processPdf(base64Content: string, settings: BrandSettings): Promise<{ modifiedFile: string; message: string }> {
  const apiKey = Deno.env.get('CLOUDCONVERT_API_KEY');
  
  if (!apiKey) {
    console.log('[transform-document-design] CloudConvert API key not configured');
    return {
      modifiedFile: base64Content,
      message: 'PDF conversion requires CloudConvert API key. Please configure CLOUDCONVERT_API_KEY in Supabase secrets, or upload the original DOCX file for full brand styling.'
    };
  }
  
  console.log('[transform-document-design] Processing PDF with CloudConvert pipeline');
  
  try {
    // Step 1: Convert PDF to DOCX
    const docxBase64 = await convertPdfToDocx(base64Content, apiKey);
    
    // Step 2: Apply brand styling to DOCX
    const styledDocx = await modifyDocxStyles(docxBase64, settings);
    
    // Step 3: Convert styled DOCX back to PDF
    const styledPdf = await convertDocxToPdf(styledDocx, apiKey);
    
    console.log('[transform-document-design] PDF transformation complete');
    
    return {
      modifiedFile: styledPdf,
      message: 'PDF has been converted and styled with your brand fonts and colors. Document structure and images preserved.'
    };
  } catch (error) {
    console.error('[transform-document-design] CloudConvert error:', error);
    return {
      modifiedFile: base64Content,
      message: `PDF conversion failed: ${error.message}. Returning original file.`
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
      console.log(`[transform-document-design] Modifying DOCX: ${fileName}`);
      const modifiedDocx = await modifyDocxStyles(file, settings);
      
      result = {
        type: 'docx',
        modifiedFile: modifiedDocx,
        originalFileName: fileName,
        message: 'Document fonts and colors have been updated while preserving structure and images.'
      };
    } else if (fileType.includes('pdf')) {
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
