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
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        
        <div className="bg-muted/20 rounded-lg p-8 text-center">
          <FileText className="h-20 w-20 mx-auto text-primary mb-4" />
          <h4 className="text-lg font-medium mb-2">
            {getBaseFileName()}_styled.{type}
          </h4>
          <p className="text-sm text-muted-foreground mb-4">
            Your document has been processed with the selected brand fonts and colors.
            {type === 'docx' && ' All images and layout have been preserved.'}
          </p>
          <Button onClick={handleDownload} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download Modified Document
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TransformedPreview;
