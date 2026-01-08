import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
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

  const handleDownload = async () => {
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
      a.download = `${getBaseFileName()}_branded.${type}`;
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

  const isSuccess = message?.includes('has been') || message?.includes('transformed') || message?.includes('successfully');
  const isWarning = message?.includes('requires') || message?.includes('failed') || message?.includes('cannot');

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
        
        <div className="bg-muted/20 rounded-lg p-8 text-center">
          <FileText className={`h-20 w-20 mx-auto mb-4 ${isSuccess ? 'text-green-500' : type === 'pdf' ? 'text-red-500' : 'text-primary'}`} />
          <h4 className="text-lg font-medium mb-2">
            {getBaseFileName()}_branded.{type}
          </h4>
          <p className="text-sm text-muted-foreground mb-4">
            {type === 'pdf' ? (
              <>Your document has been transformed into a branded PDF with Sentra styling.</>
            ) : (
              <>Your DOCX document has been styled with brand colors and fonts.</>
            )}
          </p>
          <Button onClick={handleDownload} variant="default">
            <Download className="h-4 w-4 mr-2" />
            Download {type?.toUpperCase()}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TransformedPreview;
