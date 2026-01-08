// Client-side HTML to PDF conversion service
import html2pdf from 'html2pdf.js';

export interface TemplateRenderOptions {
  coverTemplateHtml?: string;
  coverTemplateCss?: string;
  textTemplateHtml?: string;
  textTemplateCss?: string;
  metadata: {
    title: string;
    subtitle?: string;
    date?: string;
    author?: string;
    version?: string;
    isConfidential?: boolean;
  };
  sections: Array<{
    type: string;
    content?: string;
    items?: string[];
  }>;
}

/**
 * Replace placeholders in HTML template with actual values
 */
function replacePlaceholders(html: string, data: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(data)) {
    // Support multiple placeholder formats
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), value);
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'gi'), value);
    result = result.replace(new RegExp(`%${key}%`, 'gi'), value);
    result = result.replace(new RegExp(`\\[${key}\\]`, 'gi'), value);
  }
  return result;
}

/**
 * Generate content HTML from sections
 */
function generateContentHtml(sections: TemplateRenderOptions['sections']): string {
  return sections.map(section => {
    switch (section.type) {
      case 'h1':
        return `<h1 class="section-heading">${section.content || ''}</h1>`;
      case 'h2':
        return `<h2 class="subsection-heading">${section.content || ''}</h2>`;
      case 'h3':
        return `<h3 class="subsubsection-heading">${section.content || ''}</h3>`;
      case 'paragraph':
        return `<p class="body-text">${section.content || ''}</p>`;
      case 'bullet-list':
        if (section.items && section.items.length > 0) {
          return `<ul class="bullet-list">${section.items.map(item => `<li>${item}</li>`).join('')}</ul>`;
        }
        return '';
      case 'page-break':
        return '<div class="page-break"></div>';
      default:
        return section.content ? `<p>${section.content}</p>` : '';
    }
  }).join('\n');
}

/**
 * Combine templates and render to HTML document
 */
export function renderTemplateToHtml(options: TemplateRenderOptions): string {
  const { coverTemplateHtml, coverTemplateCss, textTemplateHtml, textTemplateCss, metadata, sections } = options;
  
  const placeholderData: Record<string, string> = {
    title: metadata.title || 'Untitled Document',
    subtitle: metadata.subtitle || '',
    date: metadata.date || new Date().toLocaleDateString(),
    author: metadata.author || '',
    version: metadata.version || '1.0',
    year: new Date().getFullYear().toString(),
    confidential: metadata.isConfidential ? 'Confidential' : '',
  };

  // Generate content from sections
  const contentHtml = generateContentHtml(sections);
  placeholderData.content = contentHtml;

  // Build combined HTML document
  let combinedHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    }
    .page {
      width: 595px;
      min-height: 842px;
      page-break-after: always;
      position: relative;
      overflow: hidden;
    }
    .page:last-child {
      page-break-after: auto;
    }
    .page-break {
      page-break-after: always;
      height: 0;
    }
    .section-heading {
      font-size: 22px;
      font-weight: bold;
      color: #000;
      margin: 0 0 16px 0;
    }
    .subsection-heading {
      font-size: 16px;
      font-weight: bold;
      color: #000;
      margin: 16px 0 12px 0;
    }
    .subsubsection-heading {
      font-size: 13px;
      font-weight: bold;
      color: #374151;
      margin: 12px 0 8px 0;
    }
    .body-text {
      font-size: 10px;
      line-height: 1.5;
      color: #374151;
      margin: 0 0 10px 0;
    }
    .bullet-list {
      margin: 8px 0;
      padding-left: 24px;
    }
    .bullet-list li {
      font-size: 10px;
      color: #374151;
      margin-bottom: 4px;
    }
    ${coverTemplateCss || ''}
    ${textTemplateCss || ''}
  </style>
</head>
<body>
`;

  // Add cover page if template provided
  if (coverTemplateHtml) {
    const coverHtml = replacePlaceholders(coverTemplateHtml, placeholderData);
    combinedHtml += `<div class="page cover-page">${coverHtml}</div>\n`;
  }

  // Add content pages
  if (textTemplateHtml) {
    // For template-based content, inject content into template
    let textHtml = replacePlaceholders(textTemplateHtml, placeholderData);
    combinedHtml += `<div class="page text-page">${textHtml}</div>\n`;
  } else if (sections.length > 0) {
    // Fallback: render content directly
    combinedHtml += `<div class="page text-page" style="padding: 60px 40px;">${contentHtml}</div>\n`;
  }

  combinedHtml += `
</body>
</html>
`;

  return combinedHtml;
}

/**
 * Convert HTML to PDF using html2pdf.js
 * Note: Complex SVGs with patterns and clip-paths may not render correctly
 */
export async function convertHtmlToPdf(html: string, filename: string): Promise<void> {
  console.log('[htmlToPdfService] Starting PDF conversion, HTML length:', html.length);
  
  // Create a container for rendering
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '595px';
  container.style.backgroundColor = 'white';
  container.style.zIndex = '-9999';
  container.style.overflow = 'visible';
  document.body.appendChild(container);

  try {
    // Parse the HTML and extract body content
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract styles from head and inject them
    const styles = doc.querySelectorAll('style');
    const styleContent = Array.from(styles).map(s => s.textContent).join('\n');
    
    // Create style element
    const styleEl = document.createElement('style');
    styleEl.textContent = styleContent;
    container.appendChild(styleEl);
    
    // Clone body content
    const bodyContent = doc.body.innerHTML;
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = bodyContent;
    container.appendChild(contentDiv);
    
    console.log('[htmlToPdfService] Content injected, pages found:', container.querySelectorAll('.page').length);

    // Wait for content and SVGs to render
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if we have visible content
    const pages = container.querySelectorAll('.page');
    console.log('[htmlToPdfService] Rendering', pages.length, 'pages');
    
    if (pages.length === 0) {
      console.warn('[htmlToPdfService] No .page elements found, rendering entire container');
    }
    
    const opt = {
      margin: 0,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 595,
        windowWidth: 595,
        // Ignore SVG backgrounds that may cause issues
        ignoreElements: (element: Element) => {
          // Skip complex SVG backgrounds but keep content
          if (element.classList?.contains('svg-background')) {
            console.log('[htmlToPdfService] Skipping svg-background for canvas rendering');
            return true;
          }
          return false;
        }
      },
      jsPDF: { 
        unit: 'pt', 
        format: 'a4', 
        orientation: 'portrait' 
      },
      pagebreak: { mode: ['css', 'legacy'] },
    };

    await html2pdf().set(opt).from(container).save();
    console.log('[htmlToPdfService] PDF saved successfully');
  } catch (error) {
    console.error('[htmlToPdfService] PDF conversion error:', error);
    throw error;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Get PDF as blob instead of downloading
 */
export async function getHtmlAsPdfBlob(html: string): Promise<Blob> {
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  try {
    const opt = {
      margin: 0,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        letterRendering: true,
      },
      jsPDF: { 
        unit: 'pt', 
        format: 'a4', 
        orientation: 'portrait' 
      },
      pagebreak: { mode: ['css', 'legacy'] },
    };

    const pdfBlob = await html2pdf().set(opt).from(container).outputPdf('blob');
    return pdfBlob;
  } finally {
    document.body.removeChild(container);
  }
}
