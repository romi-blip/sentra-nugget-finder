import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Loader2, Palette, Save, Wand2, FileText, PlusCircle, FileCode, Layout } from 'lucide-react';
import BrandColorPicker from '@/components/brand/BrandColorPicker';
import FontSelector from '@/components/brand/FontSelector';
import DocumentUploader from '@/components/brand/DocumentUploader';
import TransformedPreview from '@/components/brand/TransformedPreview';
import DocumentMetadataForm from '@/components/brand/DocumentMetadataForm';
import ContentSectionEditor from '@/components/brand/ContentSectionEditor';
import TemplatePreview from '@/components/brand/TemplatePreview';
import { SVGToHTMLConverter } from '@/components/brand/SVGToHTMLConverter';
import { TemplateManager } from '@/components/brand/TemplateManager';
import { brandService, BrandSettings } from '@/services/brandService';
import { documentService } from '@/services/documentService';
import { 
  DocumentMetadata, 
  ContentSection, 
  TOCItem,
  DEFAULT_DOCUMENT_METADATA 
} from '@/lib/documentTemplates';
import SEO from '@/components/SEO';
const BrandDesigner: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transformResult, setTransformResult] = useState<{
    type: 'docx' | 'pdf' | null;
    modifiedFile: string | null;
    message?: string;
  }>({ type: null, modifiedFile: null });
  const [localSettings, setLocalSettings] = useState<Partial<BrandSettings>>({});

  // Document generator state
  const [documentMetadata, setDocumentMetadata] = useState<DocumentMetadata>(DEFAULT_DOCUMENT_METADATA);
  const [contentSections, setContentSections] = useState<ContentSection[]>([]);
  const [tableOfContents, setTableOfContents] = useState<TOCItem[]>([]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['brand-settings'],
    queryFn: brandService.getSettings,
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<BrandSettings>) => {
      if (!settings?.id) throw new Error('No settings found');
      return brandService.updateSettings(settings.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-settings'] });
      toast({
        title: 'Settings saved',
        description: 'Brand settings have been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const transformMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !settings) throw new Error('Missing file or settings');
      return brandService.transformDocument(selectedFile, settings);
    },
    onSuccess: (result) => {
      setTransformResult({
        type: result.type,
        modifiedFile: result.modifiedFile,
        message: result.message,
      });
      toast({
        title: 'Document transformed',
        description: result.message || 'Your document has been styled with the brand settings.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Transformation failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const generateDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!documentMetadata.title) throw new Error('Document title is required');
      
      // Fetch the Sentra logo
      const logoBase64 = await documentService.fetchLogoBase64();
      
      return documentService.generateBrandedDocument({
        metadata: documentMetadata,
        tableOfContents,
        sections: contentSections,
        logoBase64,
      });
    },
    onSuccess: (result) => {
      documentService.downloadDocument(result.document, result.filename);
      toast({
        title: 'Document generated',
        description: `${result.filename} has been downloaded.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Generation failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSaveSettings = () => {
    updateMutation.mutate(localSettings);
  };

  const handleTransform = () => {
    transformMutation.mutate();
  };

  const handleGenerateDocument = () => {
    generateDocumentMutation.mutate();
  };

  const updateColor = (key: keyof BrandSettings, value: string) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Auto-generate TOC from heading sections
  useEffect(() => {
    const headings = contentSections.filter((s) => s.type === 'heading' && s.title);
    const newToc: TOCItem[] = headings.map((h, index) => ({
      id: h.id,
      title: h.chapterNumber ? `${h.chapterNumber} ${h.title}` : h.title || '',
      page: index + 3, // Start from page 3 (after cover and TOC)
      level: 1,
    }));
    setTableOfContents(newToc);
  }, [contentSections]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Brand Designer | Sentra"
        description="Design and transform documents with Sentra brand colors and fonts"
      />
      <div className="container mx-auto py-8 px-4 space-y-8">
        <div className="flex items-center gap-3">
          <Palette className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-poppins font-semibold">Brand Designer</h1>
            <p className="text-muted-foreground">
              Manage brand settings and generate branded documents
            </p>
          </div>
        </div>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="create">
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Document
            </TabsTrigger>
            <TabsTrigger value="transform">
              <Wand2 className="h-4 w-4 mr-2" />
              Transform Document
            </TabsTrigger>
            <TabsTrigger value="templates">
              <Layout className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="convert">
              <FileCode className="h-4 w-4 mr-2" />
              SVG Converter
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Palette className="h-4 w-4 mr-2" />
              Brand Settings
            </TabsTrigger>
          </TabsList>

          {/* Create New Document Tab */}
          <TabsContent value="create" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-poppins flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Create Branded Document
                </CardTitle>
                <CardDescription>
                  Generate a new document using Sentra brand templates. Fill in the metadata
                  and add content sections.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Document Metadata */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Document Information</h3>
                  <DocumentMetadataForm
                    metadata={documentMetadata}
                    onChange={setDocumentMetadata}
                  />
                </div>

                <Separator />

                {/* Content Sections */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Content Sections</h3>
                  <ContentSectionEditor
                    sections={contentSections}
                    onChange={setContentSections}
                  />
                </div>

                <Separator />

                {/* Generate Button */}
                <div className="flex justify-center">
                  <Button
                    onClick={handleGenerateDocument}
                    disabled={generateDocumentMutation.isPending || !documentMetadata.title}
                    size="lg"
                    className="min-w-[200px]"
                  >
                    {generateDocumentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Generate Document
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transform Document Tab */}
          <TabsContent value="transform" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-poppins">Transform Existing Document</CardTitle>
                <CardDescription>
                  Upload a DOCX or PDF file to apply brand styling. The document will be
                  transformed with your configured colors and fonts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <DocumentUploader
                  onFileSelect={setSelectedFile}
                  selectedFile={selectedFile}
                  onClear={() => {
                    setSelectedFile(null);
                    setTransformResult({ type: null, modifiedFile: null });
                  }}
                  isProcessing={transformMutation.isPending}
                />

                {selectedFile && (
                  <div className="flex justify-center">
                    <Button
                      onClick={handleTransform}
                      disabled={transformMutation.isPending}
                      size="lg"
                    >
                      {transformMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4 mr-2" />
                      )}
                      Transform Document
                    </Button>
                  </div>
                )}

                <TransformedPreview
                  type={transformResult.type}
                  modifiedFile={transformResult.modifiedFile}
                  originalFileName={selectedFile?.name || ''}
                  message={transformResult.message}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-poppins flex items-center gap-2">
                  <Layout className="h-5 w-5" />
                  Document Templates
                </CardTitle>
                <CardDescription>
                  Manage HTML templates for document generation. Set default templates for each page type.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TemplateManager />
              </CardContent>
            </Card>
          </TabsContent>

          {/* SVG Converter Tab */}
          <TabsContent value="convert" className="space-y-6">
            <SVGToHTMLConverter />
          </TabsContent>

          {/* Brand Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-poppins">Brand Settings</CardTitle>
                <CardDescription>
                  Configure your brand colors and typography. These settings will be applied
                  when transforming documents.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Colors */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Colors</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <BrandColorPicker
                      label="Neon Green (Primary)"
                      value={localSettings.primary_color || '#39FF14'}
                      onChange={(v) => updateColor('primary_color', v)}
                    />
                    <BrandColorPicker
                      label="Sentra Orange (Secondary)"
                      value={localSettings.secondary_color || '#FF7F00'}
                      onChange={(v) => updateColor('secondary_color', v)}
                    />
                    <BrandColorPicker
                      label="Hot Pink (Accent)"
                      value={localSettings.accent_pink || '#FF00FF'}
                      onChange={(v) => updateColor('accent_pink', v)}
                    />
                    <BrandColorPicker
                      label="Cyan Blue (Accent)"
                      value={localSettings.accent_cyan || '#00FFFF'}
                      onChange={(v) => updateColor('accent_cyan', v)}
                    />
                    <BrandColorPicker
                      label="Background"
                      value={localSettings.background_color || '#000000'}
                      onChange={(v) => updateColor('background_color', v)}
                    />
                    <BrandColorPicker
                      label="Text Color"
                      value={localSettings.text_color || '#FFFFFF'}
                      onChange={(v) => updateColor('text_color', v)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Typography */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Typography</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FontSelector
                      label="Heading Font"
                      fontValue={localSettings.heading_font || 'Poppins'}
                      weightValue={localSettings.heading_weight || '600'}
                      onFontChange={(v) =>
                        setLocalSettings((prev) => ({ ...prev, heading_font: v }))
                      }
                      onWeightChange={(v) =>
                        setLocalSettings((prev) => ({ ...prev, heading_weight: v }))
                      }
                    />
                    <FontSelector
                      label="Body Font"
                      fontValue={localSettings.body_font || 'Poppins'}
                      weightValue={localSettings.body_weight || '400'}
                      onFontChange={(v) =>
                        setLocalSettings((prev) => ({ ...prev, body_font: v }))
                      }
                      onWeightChange={(v) =>
                        setLocalSettings((prev) => ({ ...prev, body_weight: v }))
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <TemplatePreview />
                  <Button
                    onClick={handleSaveSettings}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default BrandDesigner;
