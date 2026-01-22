import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import JSZip from 'jszip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { Loader2, Palette, Save, Wand2, FileText, PlusCircle, Layout, Layers, Download } from 'lucide-react';
import BrandColorPicker from '@/components/brand/BrandColorPicker';
import FontSelector from '@/components/brand/FontSelector';
import DocumentUploader from '@/components/brand/DocumentUploader';
import BulkDocumentUploader from '@/components/brand/BulkDocumentUploader';
import BulkDocumentList, { BulkDocumentItem, OutputFormat } from '@/components/brand/BulkDocumentList';
import TransformedPreview from '@/components/brand/TransformedPreview';
import DocumentMetadataForm from '@/components/brand/DocumentMetadataForm';
import ContentSectionEditor from '@/components/brand/ContentSectionEditor';
import { ElementTemplateEditor } from '@/components/brand/ElementTemplateEditor';
import { DocumentComposer } from '@/components/brand/DocumentComposer';
import DocumentEditor, { ExtractedDocument as EditorExtractedDoc } from '@/components/brand/DocumentEditor';
import { brandService, BrandSettings, TransformResult, ExtractedDocument } from '@/services/brandService';
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
    extractedContent?: ExtractedDocument;
    pageCount?: number;
  }>({ type: null, modifiedFile: null });
  const [localSettings, setLocalSettings] = useState<Partial<BrandSettings>>({});
  const [isEditing, setIsEditing] = useState(false);

  // Bulk mode state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkDocuments, setBulkDocuments] = useState<BulkDocumentItem[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [editingBulkDoc, setEditingBulkDoc] = useState<BulkDocumentItem | null>(null);

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
    onSuccess: async (result) => {
      setTransformResult({
        type: result.type,
        modifiedFile: result.modifiedFile,
        message: result.message,
        extractedContent: result.extractedContent,
        pageCount: result.pageCount,
      });
      toast({
        title: 'Document transformed',
        description: 'Click "Edit Before Download" to review and modify the content.',
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

  const generateFromEditMutation = useMutation({
    mutationFn: async (editedContent: ExtractedDocument) => {
      return brandService.generateFromContent(editedContent, selectedFile?.name || 'document.pdf');
    },
    onSuccess: (result) => {
      setTransformResult({
        type: result.type,
        modifiedFile: result.modifiedFile,
        message: result.message,
      });
      setIsEditing(false);
      
      // Auto-download the final PDF
      if (result.modifiedFile && result.type === 'pdf') {
        const binaryString = atob(result.modifiedFile);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.originalFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      
      toast({
        title: 'Document generated',
        description: 'Your edited document has been downloaded.',
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

  const generateDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!documentMetadata.title) throw new Error('Document title is required');
      
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

  // Bulk processing handlers
  const handleBulkFilesSelect = useCallback((files: File[]) => {
    const newItems: BulkDocumentItem[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      file,
      coverTitleHighlightWords: 3,
      outputFormat: 'pdf' as OutputFormat,
      status: 'pending' as const,
    }));
    setBulkDocuments((prev) => [...prev, ...newItems]);
  }, []);

  const handleBulkRemove = useCallback((id: string) => {
    setBulkDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  const handleBulkHighlightWordsChange = useCallback((id: string, words: number) => {
    setBulkDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, coverTitleHighlightWords: words } : doc))
    );
  }, []);

  const handleBulkOutputFormatChange = useCallback((id: string, format: OutputFormat) => {
    setBulkDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, outputFormat: format } : doc))
    );
  }, []);

  const handleBulkClearAll = useCallback(() => {
    setBulkDocuments([]);
    setBulkProgress({ current: 0, total: 0 });
  }, []);

  const handleBulkDownload = useCallback((item: BulkDocumentItem) => {
    if (!item.result?.modifiedFile) return;

    const binaryString = atob(item.result.modifiedFile);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const isDocx = item.outputFormat === 'docx' && item.result.type === 'docx';
    const mimeType = isDocx 
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf';
    const extension = isDocx ? 'docx' : 'pdf';
    
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = item.file.name.replace(/\.(docx|pdf)$/i, '');
    a.download = `${baseName}_branded.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleBulkDownloadAll = useCallback(async () => {
    const completedDocs = bulkDocuments.filter(
      (doc) => doc.status === 'complete' && doc.result?.modifiedFile
    );

    if (completedDocs.length === 0) {
      toast({
        title: 'No documents to download',
        description: 'There are no completed documents to download.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const zip = new JSZip();

      // Add each document to the ZIP archive
      completedDocs.forEach((item) => {
        const baseName = item.file.name.replace(/\.(docx|pdf)$/i, '');
        const isDocx = item.outputFormat === 'docx' && item.result?.type === 'docx';
        const extension = isDocx ? 'docx' : 'pdf';
        const fileName = `${baseName}_branded.${extension}`;
        
        // Convert base64 to binary data
        const binaryString = atob(item.result!.modifiedFile!);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        zip.file(fileName, bytes);
      });

      // Generate the ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download the ZIP
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `branded_documents_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download complete',
        description: `Downloaded ${completedDocs.length} documents as a ZIP file.`,
      });
    } catch (error) {
      console.error('Error creating ZIP:', error);
      toast({
        title: 'Download failed',
        description: 'Failed to create ZIP file. Please try downloading individually.',
        variant: 'destructive',
      });
    }
  }, [bulkDocuments]);

  const handleBulkEdit = useCallback((item: BulkDocumentItem) => {
    setEditingBulkDoc(item);
  }, []);

  const handleBulkEditSave = useCallback(async (editedContent: ExtractedDocument) => {
    if (!editingBulkDoc) return;
    
    try {
      const result = await brandService.generateFromContent(
        editedContent,
        editingBulkDoc.file.name,
        { coverTitleHighlightWords: editingBulkDoc.coverTitleHighlightWords }
      );
      
      // Update the document in the list with new result
      setBulkDocuments((prev) =>
        prev.map((doc) =>
          doc.id === editingBulkDoc.id
            ? { 
                ...doc, 
                result: { 
                  ...doc.result!, 
                  modifiedFile: result.modifiedFile,
                  extractedContent: editedContent,
                } 
              }
            : doc
        )
      );
      
      setEditingBulkDoc(null);
      toast({ title: 'Document updated', description: 'Your edits have been applied.' });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [editingBulkDoc, toast]);

  const processBulkTransform = useCallback(async () => {
    if (!settings) return;

    const pendingDocs = bulkDocuments.filter((doc) => doc.status === 'pending');
    if (pendingDocs.length === 0) {
      toast({
        title: 'No documents to process',
        description: 'All documents have already been processed.',
      });
      return;
    }

    setIsBulkProcessing(true);
    setBulkProgress({ current: 0, total: pendingDocs.length });

    for (let i = 0; i < pendingDocs.length; i++) {
      const doc = pendingDocs[i];
      
      // Update status to processing
      setBulkDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, status: 'processing' as const } : d))
      );
      setBulkProgress({ current: i + 1, total: pendingDocs.length });

      try {
        const result = await brandService.transformDocument(
          doc.file,
          settings as BrandSettings,
          'extract',
          { 
            coverTitleHighlightWords: doc.coverTitleHighlightWords,
            outputFormat: doc.outputFormat,
          }
        );

        setBulkDocuments((prev) =>
          prev.map((d) =>
            d.id === doc.id ? { ...d, status: 'complete' as const, result } : d
          )
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setBulkDocuments((prev) =>
          prev.map((d) =>
            d.id === doc.id
              ? { ...d, status: 'error' as const, errorMessage }
              : d
          )
        );
      }
    }

    setIsBulkProcessing(false);
    
    const successCount = bulkDocuments.filter((d) => d.status === 'complete').length + 
      pendingDocs.filter((d) => !d.errorMessage).length;
    
    toast({
      title: 'Bulk transformation complete',
      description: `Processed ${pendingDocs.length} documents.`,
    });
  }, [bulkDocuments, settings]);

  // Auto-generate TOC from heading sections
  useEffect(() => {
    const headings = contentSections.filter((s) => s.type === 'heading' && s.title);
    const newToc: TOCItem[] = headings.map((h, index) => ({
      id: h.id,
      title: h.chapterNumber ? `${h.chapterNumber} ${h.title}` : h.title || '',
      page: index + 3,
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

        <Tabs defaultValue="transform" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="transform">
              <Wand2 className="h-4 w-4 mr-2" />
              Transform
            </TabsTrigger>
            <TabsTrigger value="elements">
              <Layout className="h-4 w-4 mr-2" />
              Elements
            </TabsTrigger>
            <TabsTrigger value="composer">
              <Layers className="h-4 w-4 mr-2" />
              Composer
            </TabsTrigger>
            <TabsTrigger value="create">
              <PlusCircle className="h-4 w-4 mr-2" />
              Create
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Palette className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Transform Document Tab */}
          <TabsContent value="transform" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-poppins">Transform Documents</CardTitle>
                    <CardDescription>
                      {bulkMode 
                        ? 'Upload multiple documents to transform in bulk with per-document cover title color settings.'
                        : 'Upload a DOCX or PDF file to apply brand styling using your configured element templates.'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="bulk-mode" className="text-sm">Bulk Mode</Label>
                    <Switch
                      id="bulk-mode"
                      checked={bulkMode}
                      onCheckedChange={(checked) => {
                        setBulkMode(checked);
                        if (!checked) {
                          setBulkDocuments([]);
                          setBulkProgress({ current: 0, total: 0 });
                        }
                      }}
                      disabled={isBulkProcessing || transformMutation.isPending}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {bulkMode ? (
                  <>
                    <BulkDocumentUploader
                      onFilesSelect={handleBulkFilesSelect}
                      isProcessing={isBulkProcessing}
                    />

                    <BulkDocumentList
                      documents={bulkDocuments}
                      onRemove={handleBulkRemove}
                      onHighlightWordsChange={handleBulkHighlightWordsChange}
                      onOutputFormatChange={handleBulkOutputFormatChange}
                      onDownload={handleBulkDownload}
                      onEdit={handleBulkEdit}
                      onClearAll={handleBulkClearAll}
                      isProcessing={isBulkProcessing}
                    />

                    {bulkDocuments.length > 0 && (
                      <div className="space-y-4">
                        {isBulkProcessing && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <span>Processing documents...</span>
                              <span>{bulkProgress.current} of {bulkProgress.total}</span>
                            </div>
                            <Progress 
                              value={(bulkProgress.current / bulkProgress.total) * 100} 
                              className="h-2"
                            />
                          </div>
                        )}
                        
                        <div className="flex justify-center gap-3">
                          <Button
                            onClick={processBulkTransform}
                            disabled={isBulkProcessing || bulkDocuments.every(d => d.status !== 'pending')}
                            size="lg"
                          >
                            {isBulkProcessing ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Wand2 className="h-4 w-4 mr-2" />
                            )}
                            Transform All
                          </Button>
                          
                          {bulkDocuments.some(d => d.status === 'complete') && (
                            <Button
                              onClick={handleBulkDownloadAll}
                              variant="outline"
                              size="lg"
                              disabled={isBulkProcessing}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download All
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
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
                      extractedContent={transformResult.extractedContent}
                      onEditClick={() => setIsEditing(true)}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Element Templates Tab */}
          <TabsContent value="elements" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-poppins flex items-center gap-2">
                  <Layout className="h-5 w-5" />
                  Element Templates
                </CardTitle>
                <CardDescription>
                  Configure visual elements (headers, footers, covers) and text styles for document generation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ElementTemplateEditor />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Document Composer Tab */}
          <TabsContent value="composer" className="space-y-6">
            <DocumentComposer />
          </TabsContent>

          {/* Create New Document Tab */}
          <TabsContent value="create" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-poppins flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Create Branded Document
                </CardTitle>
                <CardDescription>
                  Generate a new document using Sentra brand templates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Document Information</h3>
                  <DocumentMetadataForm
                    metadata={documentMetadata}
                    onChange={setDocumentMetadata}
                  />
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-semibold mb-4">Content Sections</h3>
                  <ContentSectionEditor
                    sections={contentSections}
                    onChange={setContentSections}
                  />
                </div>

                <Separator />

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

          {/* Brand Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-poppins">Brand Settings</CardTitle>
                <CardDescription>
                  Configure your brand colors and typography.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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
                      fontValue={localSettings.body_font || 'Inter'}
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

                <Separator />

                <div className="flex justify-end">
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

        {/* Document Editor Modal - Single mode */}
        {isEditing && transformResult.extractedContent && (
          <DocumentEditor
            extractedContent={transformResult.extractedContent as EditorExtractedDoc}
            previewPdf={transformResult.modifiedFile}
            originalFileName={selectedFile?.name || 'document.pdf'}
            onSave={(editedContent) => generateFromEditMutation.mutate(editedContent)}
            onCancel={() => setIsEditing(false)}
            isGenerating={generateFromEditMutation.isPending}
          />
        )}

        {/* Document Editor Modal - Bulk mode */}
        {editingBulkDoc && editingBulkDoc.result?.extractedContent && (
          <DocumentEditor
            extractedContent={editingBulkDoc.result.extractedContent as EditorExtractedDoc}
            previewPdf={editingBulkDoc.result.modifiedFile}
            originalFileName={editingBulkDoc.file.name}
            onSave={handleBulkEditSave}
            onCancel={() => setEditingBulkDoc(null)}
            isGenerating={false}
          />
        )}
      </div>
    </>
  );
};

export default BrandDesigner;
