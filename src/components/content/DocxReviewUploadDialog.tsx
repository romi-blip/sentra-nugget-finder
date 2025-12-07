import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileUp, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  FileText,
  X,
  Sparkles,
  BookOpen
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProcessingResult {
  success: boolean;
  commentsProcessed: number;
  patternsCreated: number;
  revisionsApplied: boolean;
  summary: {
    comments: Array<{
      category: string;
      severity: string;
      issue: string;
      instruction: string;
    }>;
    patternsAdded: Array<{
      type: string;
      pattern: string;
    }>;
  };
}

interface DocxReviewUploadDialogProps {
  open: boolean;
  onClose: () => void;
  contentItemId: string;
  onSuccess: () => void;
  uploadDocxReview: (params: { contentItemId: string; file: File }) => void;
  isUploading: boolean;
}

export const DocxReviewUploadDialog: React.FC<DocxReviewUploadDialogProps> = ({
  open,
  onClose,
  contentItemId,
  onSuccess,
  uploadDocxReview,
  isUploading,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const { toast } = useToast();

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.docx')) {
      setSelectedFile(file);
      setResult(null);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a .docx file",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.docx')) {
      setSelectedFile(file);
      setResult(null);
    } else if (file) {
      toast({
        title: "Invalid file type",
        description: "Please upload a .docx file",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleUpload = () => {
    if (!selectedFile) return;
    uploadDocxReview({ contentItemId, file: selectedFile });
  };

  const handleClose = () => {
    setSelectedFile(null);
    setResult(null);
    onClose();
  };

  const severityColors: Record<string, string> = {
    critical: "bg-destructive/10 text-destructive",
    major: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    minor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    suggestion: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Upload DOCX Review
          </DialogTitle>
          <DialogDescription>
            Upload a Word document with reviewer comments. The system will extract feedback, update the content, and train the AI reviewer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!result ? (
            <>
              {/* Drop zone */}
              <div
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                  ${selectedFile ? 'bg-muted/50' : ''}
                `}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('docx-file-input')?.click()}
              >
                <input
                  id="docx-file-input"
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">Drop .docx file here</p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                  </>
                )}
              </div>

              {/* Info */}
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  The document should contain Word comments from a human reviewer. Track changes are also supported.
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpload} 
                  disabled={!selectedFile || isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Process Review
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            /* Results view */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">DOCX Review Processed</span>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{result.commentsProcessed}</p>
                  <p className="text-xs text-muted-foreground">Comments</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{result.summary.comments.length}</p>
                  <p className="text-xs text-muted-foreground">Revisions</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{result.patternsCreated}</p>
                  <p className="text-xs text-muted-foreground">Patterns Added</p>
                </div>
              </div>

              <ScrollArea className="h-[250px]">
                <div className="space-y-4 pr-4">
                  {/* Comments processed */}
                  {result.summary.comments.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Revisions Made
                      </h4>
                      <div className="space-y-2">
                        {result.summary.comments.map((c, i) => (
                          <div key={i} className="text-sm border rounded p-2">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={severityColors[c.severity]}>
                                {c.severity}
                              </Badge>
                              <span className="text-muted-foreground capitalize">{c.category}</span>
                            </div>
                            <p className="text-muted-foreground">{c.issue}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Patterns learned */}
                  {result.summary.patternsAdded.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Patterns Learned
                      </h4>
                      <div className="space-y-2">
                        {result.summary.patternsAdded.map((p, i) => (
                          <div key={i} className="text-sm bg-muted/50 rounded p-2">
                            <Badge variant="outline" className="mb-1">{p.type}</Badge>
                            <p className="text-muted-foreground">{p.pattern}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex justify-end">
                <Button onClick={() => { handleClose(); onSuccess(); }}>
                  View Updated Content
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
