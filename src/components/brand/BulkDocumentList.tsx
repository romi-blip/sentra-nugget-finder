import React from 'react';
import { Trash2, Download, FileText, Loader2, CheckCircle, XCircle, AlertCircle, Edit3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TransformResult } from '@/services/brandService';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Output format is PDF only (DOCX has design limitations)
export type OutputFormat = 'pdf';

export interface BulkDocumentItem {
  id: string;
  file: File;
  coverTitleHighlightWords: number;
  outputFormat: OutputFormat;
  useAiStructuring: boolean; // Enable AI-powered content structuring
  status: 'pending' | 'processing' | 'complete' | 'error';
  result?: TransformResult;
  errorMessage?: string;
}

interface BulkDocumentListProps {
  documents: BulkDocumentItem[];
  onRemove: (id: string) => void;
  onHighlightWordsChange: (id: string, words: number) => void;
  onAiStructuringChange: (id: string, enabled: boolean) => void;
  onDownload: (item: BulkDocumentItem) => void;
  onEdit: (item: BulkDocumentItem) => void;
  onClearAll: () => void;
  isProcessing: boolean;
}

const BulkDocumentList: React.FC<BulkDocumentListProps> = ({
  documents,
  onRemove,
  onHighlightWordsChange,
  onAiStructuringChange,
  onDownload,
  onEdit,
  onClearAll,
  isProcessing,
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: BulkDocumentItem['status']) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="default" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case 'complete':
        return (
          <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle className="h-3 w-3" />
            Complete
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Error
          </Badge>
        );
    }
  };

  if (documents.length === 0) {
    return null;
  }

  const completedCount = documents.filter((d) => d.status === 'complete').length;
  const processingCount = documents.filter((d) => d.status === 'processing').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {documents.length} document{documents.length !== 1 ? 's' : ''} queued
          {completedCount > 0 && ` • ${completedCount} complete`}
          {processingCount > 0 && ` • ${processingCount} processing`}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onClearAll}
          disabled={isProcessing}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear All
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[240px]">Document</TableHead>
              <TableHead className="w-[70px]">Size</TableHead>
              <TableHead className="w-[130px]">Highlight Words</TableHead>
              <TableHead className="w-[100px]">AI Structure</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[130px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate max-w-[200px]" title={doc.file.name}>
                      {doc.file.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatFileSize(doc.file.size)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[doc.coverTitleHighlightWords]}
                      onValueChange={([val]) => onHighlightWordsChange(doc.id, val)}
                      min={0}
                      max={15}
                      step={1}
                      disabled={isProcessing || doc.status !== 'pending'}
                      className="w-20"
                    />
                    <span className="w-5 text-center font-mono text-sm text-muted-foreground">
                      {doc.coverTitleHighlightWords}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={doc.useAiStructuring}
                            onCheckedChange={(checked) => onAiStructuringChange(doc.id, checked)}
                            disabled={isProcessing || doc.status !== 'pending'}
                          />
                          {doc.useAiStructuring && (
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[250px]">
                        <p className="text-xs">
                          AI structuring preserves exact content while identifying headings, lists, and tables.
                          Enable for documents requiring content fidelity.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {getStatusBadge(doc.status)}
                    {doc.errorMessage && (
                      <span className="text-xs text-destructive truncate max-w-[100px]" title={doc.errorMessage}>
                        {doc.errorMessage}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {doc.status === 'complete' && doc.result?.extractedContent && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(doc)}
                        title="Edit Before Download"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    )}
                    {doc.status === 'complete' && doc.result?.modifiedFile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDownload(doc)}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(doc.id)}
                      disabled={isProcessing && doc.status === 'processing'}
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default BulkDocumentList;
