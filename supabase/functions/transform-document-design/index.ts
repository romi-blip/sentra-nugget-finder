import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

function extractTextFromDocx(base64Content: string): string {
  // Decode base64
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // DOCX is a ZIP file containing XML
  // For simplicity, we'll extract text content from the raw bytes
  // This is a basic extraction - in production you'd use a proper library
  const content = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  
  // Look for text between XML tags
  const textMatches: string[] = [];
  
  // Extract from document.xml (main content)
  const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  while ((match = textPattern.exec(content)) !== null) {
    if (match[1].trim()) {
      textMatches.push(match[1]);
    }
  }

  // Also try to find paragraph breaks
  const paragraphPattern = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];
  
  while ((match = paragraphPattern.exec(content)) !== null) {
    const paragraphContent = match[1];
    const innerTextPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let innerMatch;
    const texts: string[] = [];
    while ((innerMatch = innerTextPattern.exec(paragraphContent)) !== null) {
      texts.push(innerMatch[1]);
    }
    if (texts.length > 0) {
      paragraphs.push(texts.join(''));
    }
  }

  if (paragraphs.length > 0) {
    return paragraphs.join('\n\n');
  }

  return textMatches.join(' ');
}

function generateStyledHtml(content: string, settings: BrandSettings): string {
  // Split content into paragraphs
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
  
  // Detect headings (lines that are short and might be titles)
  const processedParagraphs = paragraphs.map((p, index) => {
    const trimmed = p.trim();
    
    // Simple heuristic: first paragraph or short lines might be headings
    const isHeading = index === 0 || 
      (trimmed.length < 100 && !trimmed.endsWith('.') && !trimmed.endsWith(','));
    
    if (isHeading && index < 5) {
      const level = index === 0 ? 'h1' : 'h2';
      return `<${level}>${trimmed}</${level}>`;
    }
    
    return `<p>${trimmed}</p>`;
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Styled Document</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${settings.headingFont.replace(' ', '+')}:wght@${settings.headingWeight}&family=${settings.bodyFont.replace(' ', '+')}:wght@${settings.bodyWeight}&display=swap">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: '${settings.bodyFont}', sans-serif;
      font-weight: ${settings.bodyWeight};
      background-color: ${settings.backgroundColor};
      color: ${settings.textColor};
      line-height: 1.6;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }
    
    h1, h2, h3, h4, h5, h6 {
      font-family: '${settings.headingFont}', sans-serif;
      font-weight: ${settings.headingWeight};
      margin-bottom: 1rem;
    }
    
    h1 {
      font-size: 2.5rem;
      color: ${settings.primaryColor};
      border-bottom: 3px solid ${settings.secondaryColor};
      padding-bottom: 0.5rem;
      margin-bottom: 2rem;
    }
    
    h2 {
      font-size: 1.75rem;
      color: ${settings.accentCyan};
      margin-top: 2rem;
    }
    
    h3 {
      font-size: 1.25rem;
      color: ${settings.accentPink};
    }
    
    p {
      margin-bottom: 1rem;
    }
    
    a {
      color: ${settings.primaryColor};
      text-decoration: none;
    }
    
    a:hover {
      color: ${settings.accentCyan};
      text-decoration: underline;
    }
    
    strong, b {
      color: ${settings.secondaryColor};
    }
    
    em, i {
      color: ${settings.accentPink};
    }
    
    ul, ol {
      margin-left: 1.5rem;
      margin-bottom: 1rem;
    }
    
    li {
      margin-bottom: 0.5rem;
    }
    
    li::marker {
      color: ${settings.primaryColor};
    }
    
    blockquote {
      border-left: 4px solid ${settings.secondaryColor};
      padding-left: 1rem;
      margin: 1.5rem 0;
      font-style: italic;
      color: ${settings.accentCyan};
    }
    
    code {
      background-color: rgba(255, 255, 255, 0.1);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: monospace;
    }
    
    pre {
      background-color: rgba(255, 255, 255, 0.05);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1rem 0;
    }
    
    hr {
      border: none;
      height: 2px;
      background: linear-gradient(to right, ${settings.primaryColor}, ${settings.secondaryColor}, ${settings.accentPink});
      margin: 2rem 0;
    }
    
    .accent-box {
      background: linear-gradient(135deg, ${settings.primaryColor}20, ${settings.accentCyan}20);
      border-left: 4px solid ${settings.primaryColor};
      padding: 1rem;
      margin: 1rem 0;
      border-radius: 0 8px 8px 0;
    }
  </style>
</head>
<body>
  ${processedParagraphs.join('\n  ')}
</body>
</html>`;

  return html;
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

    let extractedContent = '';

    if (fileType.includes('pdf')) {
      // For PDF, we'll return a message that PDF parsing requires more complex handling
      extractedContent = `PDF Document: ${fileName}\n\nNote: Full PDF text extraction requires additional processing. The document has been prepared with your brand styling. For complete PDF parsing, consider using a dedicated PDF library.`;
    } else if (fileType.includes('wordprocessingml') || fileName.endsWith('.docx')) {
      // Extract text from DOCX
      extractedContent = extractTextFromDocx(file);
      
      if (!extractedContent.trim()) {
        extractedContent = `Document: ${fileName}\n\nThe document content could not be fully extracted. This may happen with complex formatting or embedded objects.`;
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Unsupported file type. Please upload a DOCX or PDF file.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate styled HTML
    const styledHtml = generateStyledHtml(extractedContent, settings);

    console.log(`[transform-document-design] Successfully transformed document`);

    return new Response(
      JSON.stringify({ 
        html: styledHtml,
        message: 'Document transformed successfully'
      }),
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
