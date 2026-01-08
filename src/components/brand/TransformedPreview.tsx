import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, CheckCircle, AlertCircle, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { convertHtmlToPdf } from '@/services/htmlToPdfService';

interface TransformedPreviewProps {
  type: 'docx' | 'pdf' | 'html' | null;
  modifiedFile: string | null; // base64
  originalFileName: string;
  message?: string;
  html?: string;
}

const TransformedPreview: React.FC<TransformedPreviewProps> = ({
  type,
  modifiedFile,
  originalFileName,
  message,
  html,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const getBaseFileName = () => originalFileName.replace(/\.(docx|pdf)$/i, '');

  const handleDownload = async () => {
    // Handle HTML to PDF conversion
    if (type === 'html' && html) {
      setIsDownloading(true);
      try {
        const filename = `${getBaseFileName()}_branded.pdf`;
        await convertHtmlToPdf(html, filename);
        toast.success('PDF downloaded successfully');
      } catch (error) {
        console.error('PDF conversion error:', error);
        toast.error('Failed to generate PDF');
      } finally {
        setIsDownloading(false);
      }
      return;
    }
    
    // Handle base64 file download
    if (!modifiedFile || !type) return;

    try {
      const binaryString = atob(modifiedFile);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const mimeType = type === 'pdf' 
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${getBaseFileName()}_styled.${type}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`${type.toUpperCase()} downloaded successfully`);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  if (!modifiedFile && !html) {
    return (
      <div className="border rounded-lg p-8 bg-muted/30 text-center">
        <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          Upload and transform a document to see the preview
        </p>
      </div>
    );
  }

  // Determine if this was a successful transformation
  const isSuccess = message?.includes('has been') || message?.includes('transformed') || (type === 'html' && html);
  const isWarning = message?.includes('requires') || message?.includes('failed') || message?.includes('cannot');

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <h3 className="font-semibold">Transformed Document</h3>
        <div className="flex gap-2">
          {type === 'html' && html && (
            <Button size="sm" variant="outline" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? 'Hide' : 'Show'} Preview
            </Button>
          )}
          <Button size="sm" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download {type === 'html' ? 'PDF' : type?.toUpperCase()}
          </Button>
        </div>
      </div>
      
      <div className="p-6">
        {message && (
          <Alert className={`mb-4 ${isWarning ? 'border-amber-500/50 bg-amber-500/10' : isSuccess ? 'border-green-500/50 bg-green-500/10' : ''}`}>
            {isSuccess ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className={`h-4 w-4 ${isWarning ? 'text-amber-500' : ''}`} />
            )}
            <AlertDescription className={isWarning ? 'text-amber-700 dark:text-amber-300' : isSuccess ? 'text-green-700 dark:text-green-300' : ''}>
              {message}
            </AlertDescription>
          </Alert>
        )}
        
        {/* HTML Preview */}
        {showPreview && type === 'html' && html && (
          <div className="mb-4 border rounded-lg overflow-hidden bg-white">
            <iframe
              srcDoc={html}
              title="Document Preview"
              className="w-full h-[600px] border-0"
              sandbox="allow-same-origin"
            />
          </div>
        )}
        
        <div className="bg-muted/20 rounded-lg p-8 text-center">
          <FileText className={`h-20 w-20 mx-auto mb-4 ${isSuccess ? 'text-green-500' : type === 'pdf' ? 'text-red-500' : 'text-primary'}`} />
          <h4 className="text-lg font-medium mb-2">
            {getBaseFileName()}_branded.{type === 'html' ? 'pdf' : type}
          </h4>
          <p className="text-sm text-muted-foreground mb-4">
            {type === 'html' ? (
              <>Your document has been transformed using your templates. Click Download PDF to save.</>
            ) : type === 'pdf' ? (
              <>Your document has been transformed into a branded PDF with Sentra styling.</>
            ) : (
              <>Your DOCX document has been styled with brand colors and fonts.</>
            )}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={handleDownload} variant="default" disabled={isDownloading}>
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download {type === 'html' ? 'PDF' : type?.toUpperCase()}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransformedPreview;
