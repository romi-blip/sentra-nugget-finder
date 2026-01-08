import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Star, Eye, FileText, BookOpen, Table, FileStack, Layout } from "lucide-react";
import { useDocumentTemplates, useDeleteTemplate, useSetDefaultTemplate, DocumentTemplate } from "@/hooks/useDocumentTemplates";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_TYPE_ICONS: Record<string, React.ReactNode> = {
  cover: <Layout className="h-4 w-4" />,
  toc: <BookOpen className="h-4 w-4" />,
  text: <FileText className="h-4 w-4" />,
  table: <Table className="h-4 w-4" />,
  appendix: <FileStack className="h-4 w-4" />,
};

const PAGE_TYPE_LABELS: Record<string, string> = {
  cover: 'Cover Page',
  toc: 'Table of Contents',
  text: 'Text/Content',
  table: 'Table',
  appendix: 'Appendix',
};

function TemplateCard({ template }: { template: DocumentTemplate }) {
  const deleteTemplate = useDeleteTemplate();
  const setDefault = useSetDefaultTemplate();
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {PAGE_TYPE_ICONS[template.page_type]}
            <CardTitle className="text-base">{template.name}</CardTitle>
          </div>
          {template.is_default && (
            <Badge variant="secondary" className="text-xs">
              <Star className="h-3 w-3 mr-1 fill-current" />
              Default
            </Badge>
          )}
        </div>
        <CardDescription>
          {PAGE_TYPE_LABELS[template.page_type]}
          {template.placeholders.length > 0 && (
            <span className="ml-2">• {template.placeholders.length} placeholders</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-center gap-2">
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{template.name}</DialogTitle>
                <DialogDescription>
                  Template preview for {PAGE_TYPE_LABELS[template.page_type]}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[70vh]">
                <div className="border rounded-lg p-4 bg-white">
                  {template.css_content && (
                    <style dangerouslySetInnerHTML={{ __html: template.css_content }} />
                  )}
                  <div dangerouslySetInnerHTML={{ __html: template.html_content }} />
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {!template.is_default && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDefault.mutate({ id: template.id, pageType: template.page_type })}
              disabled={setDefault.isPending}
            >
              <Star className="h-4 w-4 mr-1" />
              Set Default
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => deleteTemplate.mutate(template.id)}
            disabled={deleteTemplate.isPending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function TemplateManager() {
  const { data: templates, isLoading, error } = useDocumentTemplates();
  const [activeTab, setActiveTab] = useState('all');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-destructive">
            Failed to load templates: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const filteredTemplates = activeTab === 'all' 
    ? templates 
    : templates?.filter(t => t.page_type === activeTab);

  const templateCounts = {
    all: templates?.length || 0,
    cover: templates?.filter(t => t.page_type === 'cover').length || 0,
    toc: templates?.filter(t => t.page_type === 'toc').length || 0,
    text: templates?.filter(t => t.page_type === 'text').length || 0,
    table: templates?.filter(t => t.page_type === 'table').length || 0,
    appendix: templates?.filter(t => t.page_type === 'appendix').length || 0,
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="all">
            All ({templateCounts.all})
          </TabsTrigger>
          <TabsTrigger value="cover">
            Cover ({templateCounts.cover})
          </TabsTrigger>
          <TabsTrigger value="toc">
            TOC ({templateCounts.toc})
          </TabsTrigger>
          <TabsTrigger value="text">
            Text ({templateCounts.text})
          </TabsTrigger>
          <TabsTrigger value="table">
            Table ({templateCounts.table})
          </TabsTrigger>
          <TabsTrigger value="appendix">
            Appendix ({templateCounts.appendix})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredTemplates && filteredTemplates.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">
                  No templates found. Upload an SVG to create one.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
