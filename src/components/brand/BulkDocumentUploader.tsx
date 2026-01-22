import React, { useCallback, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BulkDocumentUploaderProps {
  onFilesSelect: (files: File[]) => void;
  isProcessing?: boolean;
}

const BulkDocumentUploader: React.FC<BulkDocumentUploaderProps> = ({
  onFilesSelect,
  isProcessing = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const isValidFile = (file: File): boolean => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const validExtensions = ['.pdf', '.docx'];
    const hasValidType = validTypes.includes(file.type);
    const hasValidExtension = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );
    return hasValidType || hasValidExtension;
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      if (isProcessing) return;

      const files = Array.from(e.dataTransfer.files).filter(isValidFile);
      if (files.length > 0) {
        onFilesSelect(files);
      }
    },
    [isProcessing, onFilesSelect]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isProcessing || !e.target.files) return;

      const files = Array.from(e.target.files).filter(isValidFile);
      if (files.length > 0) {
        onFilesSelect(files);
      }
      // Reset input
      e.target.value = '';
    },
    [isProcessing, onFilesSelect]
  );

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-8 transition-colors ${
        isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-muted-foreground/50'
      } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        multiple
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isProcessing}
      />
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="p-4 bg-muted rounded-full">
          <Upload className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="text-lg font-medium">
            Drop multiple files here or click to browse
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Supports PDF and DOCX files
          </p>
        </div>
      </div>
    </div>
  );
};

export default BulkDocumentUploader;
