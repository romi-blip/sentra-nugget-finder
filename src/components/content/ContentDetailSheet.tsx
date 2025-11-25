import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Download, Edit, Save, X } from "lucide-react";
import { ContentPlanItem } from "@/services/contentService";
import { contentService } from "@/services/contentService";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { normalizeAiContent } from "@/lib/normalizeAiContent";
import { RichTextEditor } from "./RichTextEditor";
import { marked } from "marked";
import TurndownService from "turndown";

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

// Convert markdown to HTML for the editor
const markdownToHtml = (markdown: string): string => {
  try {
    const normalized = normalizeAiContent(markdown);
    return marked.parse(normalized, { async: false }) as string;
  } catch (error) {
    console.error('Error converting markdown to HTML:', error);
    return markdown;
  }
};

// Convert HTML back to markdown for storage
const htmlToMarkdown = (html: string): string => {
  try {
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
    });
    return turndownService.turndown(html);
  } catch (error) {
    console.error('Error converting HTML to markdown:', error);
    return html;
  }
};

export const ContentDetailSheet: React.FC<ContentDetailSheetProps> = ({
  open,
  onClose,
  item,
}) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedHtml, setEditedHtml] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset edit state when item changes or sheet closes
  useEffect(() => {
    if (item && open) {
      const content = item.content || item.research_notes || '';
      setEditedHtml(markdownToHtml(content));
      setIsEditing(false);
    }
  }, [item, open]);

  if (!item) return null;

  const handleEdit = () => {
    const content = item.content || item.research_notes || '';
    setEditedHtml(markdownToHtml(content));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    const content = item.content || item.research_notes || '';
    setEditedHtml(markdownToHtml(content));
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const markdownContent = htmlToMarkdown(editedHtml);
      const updateField = item.content ? 'content' : 'research_notes';
      await contentService.update(item.id, { [updateField]: markdownContent });
      toast({ title: "Content updated successfully" });
      setIsEditing(false);
      // Update the local item to reflect changes
      if (item.content) {
        item.content = markdownContent;
      } else {
        item.research_notes = markdownContent;
      }
    } catch (error) {
      console.error('Error saving content:', error);
      toast({ 
        title: "Failed to save content", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

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

  const proseClasses = "prose prose-sm dark:prose-invert max-w-none prose-p:text-sm prose-p:leading-relaxed prose-p:font-normal prose-li:text-sm prose-headings:mt-6 prose-headings:mb-3 prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-h4:text-sm prose-lead:text-sm prose-lead:font-normal prose-strong:font-semibold [&>p:first-of-type]:text-sm [&>p:first-of-type]:font-normal";

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className={`w-full ${isEditing ? 'sm:max-w-4xl' : 'sm:max-w-2xl'}`}>
        <SheetHeader>
          <SheetTitle className="pr-8">{item.title}</SheetTitle>
          <SheetDescription>
            <Badge className={statusColors[item.status]}>
              {statusLabels[item.status]}
            </Badge>
          </SheetDescription>
        </SheetHeader>

        {isEditing ? (
          <div className="mt-6 h-[calc(100vh-200px)]">
            <RichTextEditor
              content={editedHtml}
              onChange={setEditedHtml}
              placeholder="Start writing your content..."
            />
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-200px)] mt-6">
            <div className="space-y-6 pr-4">
              {(item.content || item.research_notes) ? (
                <div className={proseClasses}>
                  <ReactMarkdown>{normalizeAiContent(item.content || item.research_notes || '')}</ReactMarkdown>
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
        )}

        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t">
          {isEditing ? (
            <>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          ) : (
            <>
              {(item.content || item.research_notes) && (
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Content
                </Button>
              )}
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
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};