import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SVGElement {
  tag: string;
  attrs: Record<string, string>;
  content?: string;
  children?: SVGElement[];
}

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /(\w+(?:-\w+)*)=["']([^"']*)["']/g;
  let match;
  while ((match = regex.exec(attrString)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function extractSVGElements(svgContent: string): SVGElement[] {
  const elements: SVGElement[] = [];
  
  // Extract rect elements
  const rectRegex = /<rect\s+([^>]*)(?:\/>|>)/g;
  let match;
  while ((match = rectRegex.exec(svgContent)) !== null) {
    elements.push({ tag: 'rect', attrs: parseAttributes(match[1]) });
  }
  
  // Extract text elements with content
  const textRegex = /<text\s+([^>]*)>([^<]*)<\/text>/g;
  while ((match = textRegex.exec(svgContent)) !== null) {
    elements.push({ tag: 'text', attrs: parseAttributes(match[1]), content: match[2] });
  }
  
  // Extract tspan elements (nested text)
  const tspanRegex = /<tspan\s+([^>]*)>([^<]*)<\/tspan>/g;
  while ((match = tspanRegex.exec(svgContent)) !== null) {
    elements.push({ tag: 'tspan', attrs: parseAttributes(match[1]), content: match[2] });
  }
  
  // Extract path elements (for logos, icons)
  const pathRegex = /<path\s+([^>]*)(?:\/>|>)/g;
  while ((match = pathRegex.exec(svgContent)) !== null) {
    elements.push({ tag: 'path', attrs: parseAttributes(match[1]) });
  }
  
  // Extract image elements
  const imageRegex = /<image\s+([^>]*)(?:\/>|>)/g;
  while ((match = imageRegex.exec(svgContent)) !== null) {
    elements.push({ tag: 'image', attrs: parseAttributes(match[1]) });
  }
  
  // Extract circle elements
  const circleRegex = /<circle\s+([^>]*)(?:\/>|>)/g;
  while ((match = circleRegex.exec(svgContent)) !== null) {
    elements.push({ tag: 'circle', attrs: parseAttributes(match[1]) });
  }
  
  // Extract line elements
  const lineRegex = /<line\s+([^>]*)(?:\/>|>)/g;
  while ((match = lineRegex.exec(svgContent)) !== null) {
    elements.push({ tag: 'line', attrs: parseAttributes(match[1]) });
  }
  
  // Extract g groups with their content
  const gRegex = /<g\s+([^>]*)>([\s\S]*?)<\/g>/g;
  while ((match = gRegex.exec(svgContent)) !== null) {
    const groupContent = match[2];
    const groupElements = extractSVGElements(groupContent);
    elements.push({ tag: 'g', attrs: parseAttributes(match[1]), children: groupElements });
  }
  
  return elements;
}

function getSVGViewBox(svgContent: string): { width: number; height: number } {
  const viewBoxMatch = svgContent.match(/viewBox=["']([^"']*)["']/);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/\s+/).map(Number);
    return { width: parts[2] || 612, height: parts[3] || 792 };
  }
  
  const widthMatch = svgContent.match(/width=["'](\d+)/);
  const heightMatch = svgContent.match(/height=["'](\d+)/);
  
  return {
    width: widthMatch ? parseInt(widthMatch[1]) : 612,
    height: heightMatch ? parseInt(heightMatch[1]) : 792
  };
}

function convertToCSS(element: SVGElement, viewBox: { width: number; height: number }): string {
  const { tag, attrs } = element;
  const styles: string[] = [];
  
  // Position
  if (attrs.x) styles.push(`left: ${(parseFloat(attrs.x) / viewBox.width * 100).toFixed(2)}%`);
  if (attrs.y) styles.push(`top: ${(parseFloat(attrs.y) / viewBox.height * 100).toFixed(2)}%`);
  
  // Dimensions
  if (attrs.width) styles.push(`width: ${(parseFloat(attrs.width) / viewBox.width * 100).toFixed(2)}%`);
  if (attrs.height) styles.push(`height: ${(parseFloat(attrs.height) / viewBox.height * 100).toFixed(2)}%`);
  
  // Colors
  if (attrs.fill && attrs.fill !== 'none') styles.push(`background-color: ${attrs.fill}`);
  if (attrs.stroke) styles.push(`border-color: ${attrs.stroke}`);
  if (attrs['stroke-width']) styles.push(`border-width: ${attrs['stroke-width']}px`);
  
  // Text styles
  if (attrs['font-family']) styles.push(`font-family: ${attrs['font-family']}`);
  if (attrs['font-size']) styles.push(`font-size: ${attrs['font-size']}`);
  if (attrs['font-weight']) styles.push(`font-weight: ${attrs['font-weight']}`);
  if (attrs['text-anchor']) {
    const anchor = attrs['text-anchor'];
    if (anchor === 'middle') styles.push('text-align: center');
    else if (anchor === 'end') styles.push('text-align: right');
    else styles.push('text-align: left');
  }
  
  // Opacity
  if (attrs.opacity) styles.push(`opacity: ${attrs.opacity}`);
  if (attrs['fill-opacity']) styles.push(`opacity: ${attrs['fill-opacity']}`);
  
  return styles.join('; ');
}

function detectPlaceholders(content: string): string[] {
  const placeholders: string[] = [];
  
  // Look for placeholder patterns
  const patterns = [
    /\{\{(\w+)\}\}/g,           // {{placeholder}}
    /\$\{(\w+)\}/g,             // ${placeholder}
    /%(\w+)%/g,                  // %placeholder%
    /\[(\w+)\]/g,                // [placeholder]
  ];
  
  // Also detect common placeholder text
  const commonPlaceholders = [
    'title', 'subtitle', 'date', 'author', 'version', 'content',
    'page_number', 'total_pages', 'prepared_for', 'category',
    'toc_items', 'confidential', 'chapter_title', 'section_content'
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

function elementToHTML(element: SVGElement, viewBox: { width: number; height: number }): string {
  const { tag, attrs, content, children } = element;
  const css = convertToCSS(element, viewBox);
  
  switch (tag) {
    case 'rect':
      return `<div class="svg-rect" style="position: absolute; ${css}"></div>`;
    
    case 'text':
    case 'tspan':
      const textContent = content || '{{content}}';
      const colorStyle = attrs.fill ? `color: ${attrs.fill};` : '';
      return `<div class="svg-text" style="position: absolute; ${css}; ${colorStyle}">${textContent}</div>`;
    
    case 'path':
      // Keep paths as inline SVG for complex shapes
      const pathAttrs = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
      return `<svg class="svg-path" style="position: absolute; ${css}"><path ${pathAttrs}/></svg>`;
    
    case 'image':
      const src = attrs['xlink:href'] || attrs.href || '';
      return `<img class="svg-image" src="${src}" style="position: absolute; ${css}" />`;
    
    case 'circle':
      const cx = parseFloat(attrs.cx || '0');
      const cy = parseFloat(attrs.cy || '0');
      const r = parseFloat(attrs.r || '0');
      return `<div class="svg-circle" style="position: absolute; left: ${((cx - r) / viewBox.width * 100).toFixed(2)}%; top: ${((cy - r) / viewBox.height * 100).toFixed(2)}%; width: ${(r * 2 / viewBox.width * 100).toFixed(2)}%; height: ${(r * 2 / viewBox.height * 100).toFixed(2)}%; border-radius: 50%; background-color: ${attrs.fill || 'transparent'}; border: ${attrs.stroke ? `${attrs['stroke-width'] || 1}px solid ${attrs.stroke}` : 'none'};"></div>`;
    
    case 'g':
      const groupContent = children?.map(child => elementToHTML(child, viewBox)).join('\n') || '';
      return `<div class="svg-group" style="${css}">${groupContent}</div>`;
    
    default:
      return '';
  }
}

function convertSVGToHTML(svgContent: string, pageType: string): { html: string; css: string; placeholders: string[] } {
  const viewBox = getSVGViewBox(svgContent);
  const elements = extractSVGElements(svgContent);
  const placeholders = detectPlaceholders(svgContent);
  
  // Generate CSS
  const css = `
.page-container {
  position: relative;
  width: 100%;
  max-width: 612px;
  aspect-ratio: 612 / 792;
  margin: 0 auto;
  overflow: hidden;
  background: white;
  box-sizing: border-box;
}

.svg-rect, .svg-text, .svg-path, .svg-image, .svg-circle, .svg-group {
  box-sizing: border-box;
}

.svg-text {
  white-space: nowrap;
  overflow: visible;
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

  // Generate HTML elements
  const htmlElements = elements.map(el => elementToHTML(el, viewBox)).join('\n  ');
  
  const html = `<div class="page-container page-${pageType}">
  ${htmlElements}
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
