import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { toast } from 'sonner';

interface TransformedPreviewProps {
  html: string | null;
  originalFileName: string;
}

const TransformedPreview: React.FC<TransformedPreviewProps> = ({
  html,
  originalFileName,
}) => {
  const getBaseFileName = () => originalFileName.replace(/\.(docx|pdf)$/i, '');

  const handleDownloadHtml = () => {
    if (!html) return;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getBaseFileName()}_styled.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    if (!html) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      // Small delay to ensure content is loaded
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } else {
      toast.error('Please allow popups to download as PDF');
    }
  };

  const handleDownloadDocx = async () => {
    if (!html) return;

    try {
      // Parse HTML to extract content
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const body = doc.body;

      // Extract text content and structure
      const children: Paragraph[] = [];
      
      const processNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          if (text) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text })],
              })
            );
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          const tagName = element.tagName.toLowerCase();
          const text = element.textContent?.trim();

          if (!text) return;

          if (tagName === 'h1') {
            children.push(
              new Paragraph({
                heading: HeadingLevel.HEADING_1,
                children: [new TextRun({ text, bold: true, size: 48 })],
              })
            );
          } else if (tagName === 'h2') {
            children.push(
              new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [new TextRun({ text, bold: true, size: 36 })],
              })
            );
          } else if (tagName === 'h3') {
            children.push(
              new Paragraph({
                heading: HeadingLevel.HEADING_3,
                children: [new TextRun({ text, bold: true, size: 28 })],
              })
            );
          } else if (tagName === 'p' || tagName === 'div') {
            // Check if it has child elements or just text
            if (element.children.length === 0) {
              children.push(
                new Paragraph({
                  children: [new TextRun({ text, size: 24 })],
                })
              );
            } else {
              // Process children
              Array.from(element.childNodes).forEach(processNode);
            }
          } else if (tagName === 'br') {
            children.push(new Paragraph({ children: [] }));
          } else {
            // For other elements, recurse into children
            Array.from(element.childNodes).forEach(processNode);
          }
        }
      };

      // Get the main content container
      const mainContent = body.querySelector('.document-content') || body;
      Array.from(mainContent.childNodes).forEach(processNode);

      // If no content was parsed, add a fallback
      if (children.length === 0) {
        const allText = body.textContent?.trim();
        if (allText) {
          // Split by newlines and create paragraphs
          allText.split('\n').filter(line => line.trim()).forEach(line => {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: line.trim(), size: 24 })],
              })
            );
          });
        }
      }

      const docxDocument = new Document({
        sections: [
          {
            properties: {},
            children: children.length > 0 ? children : [
              new Paragraph({
                children: [new TextRun({ text: 'Document content' })],
              }),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(docxDocument);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${getBaseFileName()}_styled.docx`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('DOCX downloaded successfully');
    } catch (error) {
      console.error('Error generating DOCX:', error);
      toast.error('Failed to generate DOCX file');
    }
  };

  if (!html) {
    return (
      <div className="border rounded-lg p-8 bg-muted/30 text-center">
        <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          Upload and transform a document to see the preview
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <h3 className="font-semibold">Preview</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={handleDownloadHtml}>
              Download as HTML
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadPdf}>
              Download as PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadDocx}>
              Download as DOCX
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Use iframe to isolate the document styles from the app */}
      <iframe
        srcDoc={html}
        className="w-full h-[500px] border-0 bg-white"
        title="Document Preview"
        sandbox="allow-same-origin"
      />
    </div>
  );
};

export default TransformedPreview;
