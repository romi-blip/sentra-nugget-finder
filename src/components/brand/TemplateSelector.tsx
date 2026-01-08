import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Layout, Star } from "lucide-react";
import { useDocumentTemplatesByType, DocumentTemplate } from "@/hooks/useDocumentTemplates";

interface TemplateSelectorProps {
  pageType: 'cover' | 'text';
  label: string;
  value: string | null;
  onChange: (templateId: string | null) => void;
}

export function TemplateSelector({ pageType, label, value, onChange }: TemplateSelectorProps) {
  const { data: templates, isLoading } = useDocumentTemplatesByType(pageType);
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplate | null>(null);

  const selectedTemplate = templates?.find(t => t.id === value);

  const handleValueChange = (newValue: string) => {
    if (newValue === "none") {
      onChange(null);
      setPreviewTemplate(null);
    } else {
      onChange(newValue);
      const template = templates?.find(t => t.id === newValue);
      setPreviewTemplate(template || null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          {pageType === 'cover' ? <Layout className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          {label}
        </Label>
        <Select 
          value={value || "none"} 
          onValueChange={handleValueChange}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? "Loading..." : "Select a template"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Use default (PDF-lib)</SelectItem>
            {templates?.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                <div className="flex items-center gap-2">
                  {template.name}
                  {template.is_default && (
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedTemplate && (
        <Card className="bg-muted/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{selectedTemplate.name}</span>
              {selectedTemplate.is_default && (
                <Badge variant="secondary" className="text-xs">Default</Badge>
              )}
            </div>
            
            {selectedTemplate.placeholders && selectedTemplate.placeholders.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Placeholders:</span>
                <div className="flex flex-wrap gap-1">
                  {selectedTemplate.placeholders.map((placeholder, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs font-mono">
                      {`{{${placeholder}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div 
              className="border rounded bg-white p-2 max-h-32 overflow-hidden"
              style={{ fontSize: '6px' }}
            >
              <style dangerouslySetInnerHTML={{ __html: selectedTemplate.css_content || '' }} />
              <div 
                dangerouslySetInnerHTML={{ __html: selectedTemplate.html_content }} 
                style={{ transform: 'scale(0.15)', transformOrigin: 'top left', width: '666%' }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
