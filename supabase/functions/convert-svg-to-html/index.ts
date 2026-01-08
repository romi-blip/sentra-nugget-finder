import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SVGDimensions {
  width: number;
  height: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
}

interface TextElement {
  id: string;
  content: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fill: string;
  textAnchor: string;
  isPlaceholder: boolean;
  placeholderName?: string;
}

interface IconElement {
  id: string;
  type: string;
  svgContent: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function getSVGDimensions(svgContent: string): SVGDimensions {
  const viewBoxMatch = svgContent.match(/viewBox=["']([^"']*)["']/);
  let viewBoxWidth = 595, viewBoxHeight = 842;
  
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/\s+/).map(Number);
    viewBoxWidth = parts[2] || 595;
    viewBoxHeight = parts[3] || 842;
  }
  
  const widthMatch = svgContent.match(/width=["'](\d+)/);
  const heightMatch = svgContent.match(/height=["'](\d+)/);
  
  return {
    width: widthMatch ? parseInt(widthMatch[1]) : viewBoxWidth,
    height: heightMatch ? parseInt(heightMatch[1]) : viewBoxHeight,
    viewBoxWidth,
    viewBoxHeight
  };
}

function extractTextElements(svgContent: string, dimensions: SVGDimensions): TextElement[] {
  const textElements: TextElement[] = [];
  
  // Match <text> elements with their content
  const textRegex = /<text([^>]*)>([\s\S]*?)<\/text>/gi;
  let match;
  let idCounter = 0;
  
  while ((match = textRegex.exec(svgContent)) !== null) {
    const attrs = match[1];
    let content = match[2];
    
    // Extract tspan content if present
    const tspanMatch = content.match(/<tspan[^>]*>([\s\S]*?)<\/tspan>/gi);
    if (tspanMatch) {
      content = tspanMatch.map(t => t.replace(/<\/?tspan[^>]*>/gi, '')).join(' ');
    }
    content = content.replace(/<[^>]*>/g, '').trim();
    
    if (!content) continue;
    
    // Parse attributes
    const x = parseFloat(attrs.match(/x=["']([^"']*)["']/)?.[1] || '0');
    const y = parseFloat(attrs.match(/y=["']([^"']*)["']/)?.[1] || '0');
    const fontSize = parseFloat(attrs.match(/font-size=["']([^"']*)["']/)?.[1] || '16');
    const fontFamily = attrs.match(/font-family=["']([^"']*)["']/)?.[1] || 'sans-serif';
    const fontWeight = attrs.match(/font-weight=["']([^"']*)["']/)?.[1] || 'normal';
    const fill = attrs.match(/fill=["']([^"']*)["']/)?.[1] || '#000000';
    const textAnchor = attrs.match(/text-anchor=["']([^"']*)["']/)?.[1] || 'start';
    
    // Check for placeholder patterns
    const placeholderPatterns = [
      /\{\{(\w+)\}\}/,
      /\$\{(\w+)\}/,
      /%(\w+)%/,
      /\[(\w+)\]/,
    ];
    
    let isPlaceholder = false;
    let placeholderName: string | undefined;
    
    for (const pattern of placeholderPatterns) {
      const placeholderMatch = content.match(pattern);
      if (placeholderMatch) {
        isPlaceholder = true;
        placeholderName = placeholderMatch[1];
        break;
      }
    }
    
    textElements.push({
      id: `text-${idCounter++}`,
      content,
      x,
      y,
      fontSize,
      fontFamily,
      fontWeight,
      fill,
      textAnchor,
      isPlaceholder,
      placeholderName
    });
  }
  
  return textElements;
}

function extractIconElements(svgContent: string, dimensions: SVGDimensions): IconElement[] {
  const icons: IconElement[] = [];
  let idCounter = 0;
  
  // Extract image elements
  const imageRegex = /<image([^>]*)\/?>/gi;
  let match;
  
  while ((match = imageRegex.exec(svgContent)) !== null) {
    const attrs = match[1];
    const x = parseFloat(attrs.match(/x=["']([^"']*)["']/)?.[1] || '0');
    const y = parseFloat(attrs.match(/y=["']([^"']*)["']/)?.[1] || '0');
    const width = parseFloat(attrs.match(/width=["']([^"']*)["']/)?.[1] || '50');
    const height = parseFloat(attrs.match(/height=["']([^"']*)["']/)?.[1] || '50');
    
    icons.push({
      id: `icon-${idCounter++}`,
      type: 'image',
      svgContent: match[0],
      x,
      y,
      width,
      height
    });
  }
  
  // Extract circle elements (often used for icons/bullets)
  const circleRegex = /<circle([^>]*)\/?>/gi;
  while ((match = circleRegex.exec(svgContent)) !== null) {
    const attrs = match[1];
    const cx = parseFloat(attrs.match(/cx=["']([^"']*)["']/)?.[1] || '0');
    const cy = parseFloat(attrs.match(/cy=["']([^"']*)["']/)?.[1] || '0');
    const r = parseFloat(attrs.match(/r=["']([^"']*)["']/)?.[1] || '10');
    
    icons.push({
      id: `icon-${idCounter++}`,
      type: 'circle',
      svgContent: match[0],
      x: cx - r,
      y: cy - r,
      width: r * 2,
      height: r * 2
    });
  }
  
  // Extract path elements that look like icons (small, self-contained)
  const pathRegex = /<path([^>]*)\/?>(?:<\/path>)?/gi;
  while ((match = pathRegex.exec(svgContent)) !== null) {
    const attrs = match[1];
    const d = attrs.match(/d=["']([^"']*)["']/)?.[1] || '';
    
    // Try to get bounds from transform or calculate from path
    const transform = attrs.match(/transform=["']([^"']*)["']/)?.[1] || '';
    const translateMatch = transform.match(/translate\(([^,]+),?\s*([^)]*)\)/);
    
    let x = 0, y = 0;
    if (translateMatch) {
      x = parseFloat(translateMatch[1]) || 0;
      y = parseFloat(translateMatch[2]) || 0;
    }
    
    // Estimate size from path data (simplified)
    const numbers = d.match(/[\d.]+/g)?.map(Number) || [];
    const maxX = Math.max(...numbers.filter((_, i) => i % 2 === 0), 50);
    const maxY = Math.max(...numbers.filter((_, i) => i % 2 === 1), 50);
    
    icons.push({
      id: `icon-${idCounter++}`,
      type: 'path',
      svgContent: match[0],
      x,
      y,
      width: Math.min(maxX, 200),
      height: Math.min(maxY, 200)
    });
  }
  
  return icons;
}

function generateHTML(
  svgContent: string,
  textElements: TextElement[],
  iconElements: IconElement[],
  dimensions: SVGDimensions,
  pageType: string
): { html: string; css: string } {
  const { viewBoxWidth, viewBoxHeight } = dimensions;
  
  // Create a version of SVG without text for background
  let backgroundSvg = svgContent;
  // Keep the SVG as-is for now, we'll overlay text on top
  
  // Make SVG responsive
  backgroundSvg = backgroundSvg
    .replace(/<svg([^>]*)\swidth=["'][^"']*["']/g, '<svg$1')
    .replace(/<svg([^>]*)\sheight=["'][^"']*["']/g, '<svg$1')
    .replace(/<svg(?![^>]*preserveAspectRatio)/g, '<svg preserveAspectRatio="xMidYMid meet"')
    .replace(/<svg/, '<svg width="100%" height="100%"');

  // Generate text overlay HTML
  const textOverlays = textElements.map(text => {
    const leftPercent = (text.x / viewBoxWidth) * 100;
    const topPercent = (text.y / viewBoxHeight) * 100;
    const fontSizeVw = (text.fontSize / viewBoxWidth) * 100;
    
    const dataAttrs = text.isPlaceholder 
      ? `data-placeholder="${text.placeholderName}" data-editable="true"`
      : 'data-editable="true"';
    
    const textAlign = text.textAnchor === 'middle' ? 'center' : 
                      text.textAnchor === 'end' ? 'right' : 'left';
    
    return `    <div class="text-element" ${dataAttrs} style="
      position: absolute;
      left: ${leftPercent.toFixed(2)}%;
      top: ${topPercent.toFixed(2)}%;
      font-size: ${fontSizeVw.toFixed(3)}vw;
      font-family: ${text.fontFamily};
      font-weight: ${text.fontWeight};
      color: ${text.fill};
      text-align: ${textAlign};
      transform: translateY(-100%);
      white-space: nowrap;
    ">${text.content}</div>`;
  }).join('\n');

  // Generate icon info (for reference)
  const iconInfo = iconElements.map(icon => {
    const leftPercent = (icon.x / viewBoxWidth) * 100;
    const topPercent = (icon.y / viewBoxHeight) * 100;
    const widthPercent = (icon.width / viewBoxWidth) * 100;
    const heightPercent = (icon.height / viewBoxHeight) * 100;
    
    return `    <!-- Icon: ${icon.id} (${icon.type}) at ${leftPercent.toFixed(1)}%, ${topPercent.toFixed(1)}% size: ${widthPercent.toFixed(1)}% x ${heightPercent.toFixed(1)}% -->`;
  }).join('\n');

  const html = `<div class="page-container page-${pageType}">
  <div class="svg-background">
    ${backgroundSvg}
  </div>
  <div class="content-overlay">
${textOverlays}
  </div>
  <!-- Icon Elements (${iconElements.length} found) -->
${iconInfo}
</div>`;

  const css = `
.page-container {
  position: relative;
  width: 100%;
  max-width: ${viewBoxWidth}px;
  aspect-ratio: ${(viewBoxWidth / viewBoxHeight).toFixed(4)};
  margin: 0 auto;
  overflow: hidden;
  background: white;
  box-sizing: border-box;
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

.text-element {
  pointer-events: auto;
  cursor: text;
  transition: outline 0.2s ease;
}

.text-element:hover {
  outline: 1px dashed rgba(57, 255, 20, 0.5);
}

.text-element[data-editable="true"]:focus {
  outline: 2px solid #39FF14;
  outline-offset: 2px;
}

.text-element[data-placeholder] {
  background: rgba(57, 255, 20, 0.1);
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

  return { html, css };
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
      try {
        svgString = atob(svgContent);
      } catch {
        // Not base64, use as-is
      }
    }

    console.log(`Converting SVG to HTML for page type: ${pageType}`);
    
    const dimensions = getSVGDimensions(svgString);
    console.log(`SVG dimensions: ${dimensions.viewBoxWidth}x${dimensions.viewBoxHeight}`);
    
    const textElements = extractTextElements(svgString, dimensions);
    console.log(`Found ${textElements.length} text elements`);
    
    const iconElements = extractIconElements(svgString, dimensions);
    console.log(`Found ${iconElements.length} icon elements`);
    
    const { html, css } = generateHTML(svgString, textElements, iconElements, dimensions, pageType);
    
    // Collect placeholders from text elements
    const placeholders = textElements
      .filter(t => t.isPlaceholder && t.placeholderName)
      .map(t => t.placeholderName!);

    return new Response(
      JSON.stringify({
        success: true,
        html,
        css,
        placeholders,
        textElements: textElements.length,
        iconElements: iconElements.length,
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