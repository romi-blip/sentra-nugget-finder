import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TransformedPreviewProps {
  type: 'docx' | 'pdf' | null;
  modifiedFile: string | null; // base64
  originalFileName: string;
  message?: string;
}

const TransformedPreview: React.FC<TransformedPreviewProps> = ({
  type,
  modifiedFile,
  originalFileName,
  message,
}) => {
  const getBaseFileName = () => originalFileName.replace(/\.(docx|pdf)$/i, '');

  const handleDownload = () => {
    if (!modifiedFile || !type) return;

    try {
      // Convert base64 to blob
      const binaryString = atob(modifiedFile);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const mimeType = type === 'docx' 
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';
      
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

  if (!modifiedFile) {
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
        <h3 className="font-semibold">Transformed Document</h3>
        <Button size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download {type?.toUpperCase()}
        </Button>
      </div>
      
      <div className="p-6">
        {message && (
          <Alert className={type === 'pdf' ? 'mb-4 border-amber-500/50 bg-amber-500/10' : 'mb-4'}>
            <AlertCircle className={`h-4 w-4 ${type === 'pdf' ? 'text-amber-500' : ''}`} />
            <AlertDescription className={type === 'pdf' ? 'text-amber-700 dark:text-amber-300' : ''}>
              {message}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="bg-muted/20 rounded-lg p-8 text-center">
          <FileText className={`h-20 w-20 mx-auto mb-4 ${type === 'docx' ? 'text-primary' : 'text-amber-500'}`} />
          <h4 className="text-lg font-medium mb-2">
            {getBaseFileName()}_styled.{type}
          </h4>
          <p className="text-sm text-muted-foreground mb-4">
            {type === 'docx' ? (
              <>Your DOCX document fonts and colors have been updated. All images and layout preserved.</>
            ) : (
              <>PDF metadata updated. Structure and images preserved. For full brand styling, use the source DOCX.</>
            )}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={handleDownload} variant={type === 'docx' ? 'default' : 'outline'}>
              <Download className="h-4 w-4 mr-2" />
              Download {type?.toUpperCase()}
            </Button>
          </div>
          {type === 'pdf' && (
            <p className="text-xs text-muted-foreground mt-4">
              💡 Tip: For complete font and color changes, transform the original DOCX file instead.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransformedPreview;
