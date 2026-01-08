import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getSVGDimensions(svgContent: string): { width: number; height: number } {
  const viewBoxMatch = svgContent.match(/viewBox=["']([^"']*)["']/);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/\s+/).map(Number);
    return { width: parts[2] || 595, height: parts[3] || 842 };
  }
  
  const widthMatch = svgContent.match(/width=["'](\d+)/);
  const heightMatch = svgContent.match(/height=["'](\d+)/);
  
  return {
    width: widthMatch ? parseInt(widthMatch[1]) : 595,
    height: heightMatch ? parseInt(heightMatch[1]) : 842
  };
}

function detectPlaceholders(content: string): string[] {
  const placeholders: string[] = [];
  
  // Look for placeholder patterns in text content
  const patterns = [
    /\{\{(\w+)\}\}/g,           // {{placeholder}}
    /\$\{(\w+)\}/g,             // ${placeholder}
    /%(\w+)%/g,                  // %placeholder%
    /\[(\w+)\]/g,                // [placeholder]
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (!placeholders.includes(match[1])) {
        placeholders.push(match[1]);
      }
    }
  });
  
  return placeholders;
}

function convertSVGToHTML(svgContent: string, pageType: string): { html: string; css: string; placeholders: string[] } {
  const dimensions = getSVGDimensions(svgContent);
  const placeholders = detectPlaceholders(svgContent);
  const aspectRatio = dimensions.width / dimensions.height;
  
  // Clean up SVG for embedding - make it responsive
  let responsiveSvg = svgContent
    // Remove fixed width/height from root SVG, keep viewBox
    .replace(/<svg([^>]*)\swidth=["'][^"']*["']/g, '<svg$1')
    .replace(/<svg([^>]*)\sheight=["'][^"']*["']/g, '<svg$1')
    // Add preserveAspectRatio if not present
    .replace(/<svg(?![^>]*preserveAspectRatio)/g, '<svg preserveAspectRatio="xMidYMid meet"');
  
  // Ensure SVG has width/height 100%
  responsiveSvg = responsiveSvg.replace(/<svg/, '<svg width="100%" height="100%"');
  
  // Encode SVG for safe embedding
  const encodedSvg = responsiveSvg
    .replace(/"/g, "'")
    .replace(/#/g, '%23')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E');

  // Generate CSS
  const css = `
.page-container {
  position: relative;
  width: 100%;
  max-width: ${dimensions.width}px;
  aspect-ratio: ${aspectRatio.toFixed(4)};
  margin: 0 auto;
  overflow: hidden;
  background: white;
  box-sizing: border-box;
}

.page-container.page-${pageType} {
  /* Page type specific styles */
}

.svg-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.svg-background svg {
  width: 100%;
  height: 100%;
  display: block;
}

.content-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
}

.content-overlay > * {
  pointer-events: auto;
}

@media print {
  .page-container {
    width: 8.5in;
    height: 11in;
    max-width: none;
    aspect-ratio: auto;
    page-break-after: always;
  }
}
`;

  // Generate HTML with embedded SVG
  const html = `<div class="page-container page-${pageType}">
  <div class="svg-background">
    ${responsiveSvg}
  </div>
  <div class="content-overlay">
    <!-- Add dynamic content placeholders here -->
  </div>
</div>`;

  return { html, css, placeholders };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { svgContent, pageType = 'text', name } = await req.json();

    if (!svgContent) {
      return new Response(
        JSON.stringify({ error: 'SVG content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode base64 if provided
    let svgString = svgContent;
    if (svgContent.startsWith('data:')) {
      const base64Part = svgContent.split(',')[1];
      svgString = atob(base64Part);
    } else if (!svgContent.includes('<svg')) {
      // Assume it's base64 without data URL prefix
      try {
        svgString = atob(svgContent);
      } catch {
        // Not base64, use as-is
      }
    }

    console.log(`Converting SVG to HTML for page type: ${pageType}`);
    console.log(`SVG dimensions detected, content length: ${svgString.length}`);
    
    const result = convertSVGToHTML(svgString, pageType);

    return new Response(
      JSON.stringify({
        success: true,
        html: result.html,
        css: result.css,
        placeholders: result.placeholders,
        pageType,
        name: name || `Template - ${pageType}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error converting SVG to HTML:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
