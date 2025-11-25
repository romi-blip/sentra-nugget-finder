import React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Download } from "lucide-react";
import { ContentPlanItem } from "@/services/contentService";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { normalizeAiContent } from "@/lib/normalizeAiContent";

interface ContentDetailSheetProps {
  open: boolean;
  onClose: () => void;
  item: ContentPlanItem | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  researched: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  researched: "Researched",
  in_progress: "In Progress",
  completed: "Completed",
};

export const ContentDetailSheet: React.FC<ContentDetailSheetProps> = ({
  open,
  onClose,
  item,
}) => {
  const { toast } = useToast();

  if (!item) return null;

  const handleCopyContent = async () => {
    const textToCopy = item.content || item.outline || '';
    await navigator.clipboard.writeText(textToCopy);
    toast({ title: "Content copied to clipboard" });
  };

  const handleExport = (format: 'md' | 'txt') => {
    const content = item.content || item.outline || '';
    const filename = `${item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${format}`;
    
    let exportContent = '';
    if (format === 'md') {
      exportContent = `# ${item.title}\n\n`;
      exportContent += `**Status:** ${statusLabels[item.status]}\n\n`;
      if (item.target_keywords) {
        exportContent += `**Keywords:** ${item.target_keywords}\n\n`;
      }
      exportContent += `**Strategic Purpose:** ${item.strategic_purpose}\n\n`;
      if (item.outline) {
        exportContent += `## Outline\n\n${item.outline}\n\n`;
      }
      if (item.content) {
        exportContent += `## Content\n\n${item.content}`;
      }
    } else {
      exportContent = `${item.title}\n${'='.repeat(item.title.length)}\n\n`;
      exportContent += `Status: ${statusLabels[item.status]}\n`;
      if (item.target_keywords) {
        exportContent += `Keywords: ${item.target_keywords}\n`;
      }
      exportContent += `Strategic Purpose: ${item.strategic_purpose}\n\n`;
      if (item.outline) {
        exportContent += `Outline:\n${item.outline}\n\n`;
      }
      if (item.content) {
        exportContent += `Content:\n${item.content}`;
      }
    }

    const blob = new Blob([exportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported as ${filename}` });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="pr-8">{item.title}</SheetTitle>
          <SheetDescription>
            <Badge className={statusColors[item.status]}>
              {statusLabels[item.status]}
            </Badge>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)] mt-6">
          <div className="space-y-6 pr-4">
            {item.content ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{normalizeAiContent(item.content)}</ReactMarkdown>
              </div>
            ) : item.research_notes ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{normalizeAiContent(item.research_notes)}</ReactMarkdown>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Strategic Purpose</h4>
                  <p className="text-sm text-muted-foreground">{item.strategic_purpose}</p>
                </div>
                {item.target_keywords && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Target Keywords</h4>
                    <p className="text-sm text-muted-foreground">{item.target_keywords}</p>
                  </div>
                )}
                {item.outline && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Outline</h4>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-4 rounded-lg">
                      {item.outline}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={handleCopyContent}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Content
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('md')}>
            <Download className="h-4 w-4 mr-2" />
            Export as Markdown
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('txt')}>
            <Download className="h-4 w-4 mr-2" />
            Export as Text
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
