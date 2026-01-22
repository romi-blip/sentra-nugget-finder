import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Plus, Save, FileText, Layout, Type, Star, Trash2, Minus, Palette } from 'lucide-react';
import { useDocumentProfiles, usePageLayouts, useProfileTextStyles, useCreateDocumentProfile, useUpdateDocumentProfile, useUpsertPageLayout, useUpsertPageTextStyle, useSetDefaultProfile, useDeleteDocumentProfile, DocumentProfile, PageLayout, PageTextStyle, FooterSectionType } from '@/hooks/useDocumentProfiles';
import { useElementTemplates, ElementTemplate, VISUAL_ELEMENT_TYPES, TEXT_ELEMENT_TYPES, ELEMENT_TYPE_LABELS } from '@/hooks/useElementTemplates';
import { PageLayoutEditor } from './PageLayoutEditor';
import { DocumentPreview } from './DocumentPreview';
import { FooterConfigSection, FooterSectionConfig } from './FooterConfigSection';

const PAGE_TYPES = ['cover', 'toc', 'content'] as const;
const PAGE_TYPE_LABELS: Record<typeof PAGE_TYPES[number], string> = {
  cover: 'Cover Page',
  toc: 'Table of Contents',
  content: 'Content Pages',
};

const TEXT_CONTEXTS = ['title', 'subtitle', 'h1', 'h2', 'h3', 'paragraph', 'bullet', 'toc_entry', 'toc_title'] as const;
const TEXT_CONTEXT_LABELS: Record<typeof TEXT_CONTEXTS[number], string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  paragraph: 'Paragraph',
  bullet: 'Bullet Points',
  toc_entry: 'TOC Entry',
  toc_title: 'TOC Title',
};

export function DocumentComposer() {
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedPageType, setSelectedPageType] = useState<typeof PAGE_TYPES[number]>('cover');
  const [newProfileName, setNewProfileName] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  
  // Data hooks
  const { data: profiles, isLoading: profilesLoading } = useDocumentProfiles();
  const { data: layouts } = usePageLayouts(selectedProfileId);
  const { data: textStyles } = useProfileTextStyles(selectedProfileId);
  const { data: elementTemplates } = useElementTemplates();
  
  // Mutation hooks
  const createProfile = useCreateDocumentProfile();
  const updateProfile = useUpdateDocumentProfile();
  const deleteProfile = useDeleteDocumentProfile();
  const upsertLayout = useUpsertPageLayout();
  const upsertTextStyle = useUpsertPageTextStyle();
  const setDefaultProfile = useSetDefaultProfile();

  // Auto-select default profile
  useEffect(() => {
    if (profiles && profiles.length > 0 && !selectedProfileId) {
      const defaultProfile = profiles.find(p => p.is_default) || profiles[0];
      setSelectedProfileId(defaultProfile.id);
    }
  }, [profiles, selectedProfileId]);

  const selectedProfile = profiles?.find(p => p.id === selectedProfileId);
  const currentLayout = layouts?.find(l => l.page_type === selectedPageType);
  const currentTextStyles = textStyles?.filter(ts => ts.page_layout_id === currentLayout?.id) || [];

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;
    const result = await createProfile.mutateAsync({ name: newProfileName.trim() });
    setSelectedProfileId(result.id);
    setNewProfileName('');
  };

  const handleUpdateMargins = async (field: keyof DocumentProfile, value: number) => {
    if (!selectedProfileId) return;
    await updateProfile.mutateAsync({ id: selectedProfileId, [field]: value });
  };

  const handleLayoutChange = async (field: keyof PageLayout, value: string | number | boolean | null) => {
    if (!selectedProfileId) return;
    await upsertLayout.mutateAsync({
      ...(currentLayout || {}),
      profile_id: selectedProfileId,
      page_type: selectedPageType,
      [field]: value,
    });
  };

  // Batch update multiple layout fields at once to avoid race conditions
  const handleLayoutBatchChange = async (updates: Partial<PageLayout>) => {
    if (!selectedProfileId) return;
    await upsertLayout.mutateAsync({
      ...(currentLayout || {}),
      profile_id: selectedProfileId,
      page_type: selectedPageType,
      ...updates,
    });
  };

  const handleTextStyleChange = async (context: PageTextStyle['context'], elementTemplateId: string | null) => {
    if (!currentLayout?.id) {
      // Create the layout first
      const layout = await upsertLayout.mutateAsync({
        profile_id: selectedProfileId!,
        page_type: selectedPageType,
      });
      await upsertTextStyle.mutateAsync({
        page_layout_id: layout.id,
        context,
        element_template_id: elementTemplateId,
      });
    } else {
      await upsertTextStyle.mutateAsync({
        page_layout_id: currentLayout.id,
        context,
        element_template_id: elementTemplateId,
      });
    }
  };

  const getTextStyleForContext = (context: PageTextStyle['context']) => {
    return currentTextStyles.find(ts => ts.context === context)?.element_template_id || null;
  };

  const visualElements = elementTemplates?.filter(t => VISUAL_ELEMENT_TYPES.includes(t.element_type as any)) || [];
  const textElements = elementTemplates?.filter(t => TEXT_ELEMENT_TYPES.includes(t.element_type as any)) || [];

  if (profilesLoading) {
    return <div className="flex items-center justify-center p-8">Loading profiles...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Profile Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Document Profiles
          </CardTitle>
          <CardDescription>
            Create and manage document design profiles that combine element templates into cohesive layouts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>Select Profile</Label>
              <Select value={selectedProfileId || ''} onValueChange={setSelectedProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles?.map(profile => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name} {profile.is_default && '(Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {selectedProfile && !selectedProfile.is_default && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDefaultProfile.mutate(selectedProfileId!)}
                  title="Set as default"
                >
                  <Star className="h-4 w-4" />
                </Button>
              )}
              {selectedProfile && !selectedProfile.is_default && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    deleteProfile.mutate(selectedProfileId!);
                    setSelectedProfileId(null);
                  }}
                  title="Delete profile"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="New profile name"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
            />
            <Button onClick={handleCreateProfile} disabled={!newProfileName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedProfile && (
        <>
          {/* Document Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Document Settings</CardTitle>
              <CardDescription>Global margins and spacing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>Top Margin (pt)</Label>
                  <Input
                    type="number"
                    value={selectedProfile.page_margin_top}
                    onChange={(e) => handleUpdateMargins('page_margin_top', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Bottom Margin (pt)</Label>
                  <Input
                    type="number"
                    value={selectedProfile.page_margin_bottom}
                    onChange={(e) => handleUpdateMargins('page_margin_bottom', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Left Margin (pt)</Label>
                  <Input
                    type="number"
                    value={selectedProfile.page_margin_left}
                    onChange={(e) => handleUpdateMargins('page_margin_left', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Right Margin (pt)</Label>
                  <Input
                    type="number"
                    value={selectedProfile.page_margin_right}
                    onChange={(e) => handleUpdateMargins('page_margin_right', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <Label>Line Height</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={selectedProfile.default_line_height}
                    onChange={(e) => handleUpdateMargins('default_line_height', parseFloat(e.target.value) || 1.5)}
                  />
                </div>
                <div>
                  <Label>Paragraph Spacing (pt)</Label>
                  <Input
                    type="number"
                    value={selectedProfile.paragraph_spacing}
                    onChange={(e) => handleUpdateMargins('paragraph_spacing', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={selectedProfile.page_break_before_h1}
                    onCheckedChange={(checked) => handleUpdateMargins('page_break_before_h1' as any, checked as any)}
                  />
                  <Label>Page break before H1</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Page Type Tabs */}
          <Tabs value={selectedPageType} onValueChange={(v) => setSelectedPageType(v as typeof PAGE_TYPES[number])}>
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              {PAGE_TYPES.map(type => (
                <TabsTrigger key={type} value={type}>
                  {PAGE_TYPE_LABELS[type]}
                </TabsTrigger>
              ))}
            </TabsList>

            {PAGE_TYPES.map(pageType => (
              <TabsContent key={pageType} value={pageType} className="space-y-4">
                {/* Visual Elements Assignment */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Visual Elements</CardTitle>
                    <CardDescription>Assign visual elements to this page type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pageType === 'cover' && (
                        <div>
                          <Label>Background</Label>
                          <Select
                            value={currentLayout?.background_element_id || 'none'}
                            onValueChange={(v) => handleLayoutChange('background_element_id', v === 'none' ? null : v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select background" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {visualElements
                                .filter(e => e.element_type === 'cover_background')
                                .map(e => (
                                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      
                      {/* Full Page Design - for TOC and content pages */}
                      {(pageType === 'content' || pageType === 'toc') && (
                        <div className="col-span-full border-b pb-4 mb-2">
                          <Label className="text-base font-medium">Full Page Design</Label>
                          <p className="text-sm text-muted-foreground mb-2">
                            Use a pre-designed page that includes header and footer
                          </p>
                          <Select
                            value={currentLayout?.content_page_element_id || 'none'}
                            onValueChange={(v) => handleLayoutChange('content_page_element_id', v === 'none' ? null : v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select full page design" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (use separate header/footer)</SelectItem>
                              {visualElements
                                .filter(e => e.element_type === 'content_page')
                                .map(e => (
                                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Only show header/footer selectors if no full page design is selected */}
                      {!((pageType === 'content' || pageType === 'toc') && currentLayout?.content_page_element_id) && (
                        <>
                          <div>
                            <Label>Header</Label>
                            <Select
                              value={currentLayout?.header_element_id || 'none'}
                              onValueChange={(v) => handleLayoutChange('header_element_id', v === 'none' ? null : v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select header" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {visualElements
                                  .filter(e => e.element_type === 'header')
                                  .map(e => (
                                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label>Footer</Label>
                            <Select
                              value={currentLayout?.footer_element_id || 'none'}
                              onValueChange={(v) => handleLayoutChange('footer_element_id', v === 'none' ? null : v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select footer" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {visualElements
                                  .filter(e => e.element_type === 'footer')
                                  .map(e => (
                                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={currentLayout?.show_logo ?? true}
                            onCheckedChange={(checked) => handleLayoutChange('show_logo', checked)}
                          />
                          <Label>Show Logo</Label>
                        </div>
                        {currentLayout?.show_logo !== false && (
                          <Select
                            value={currentLayout?.logo_element_id || 'none'}
                            onValueChange={(v) => handleLayoutChange('logo_element_id', v === 'none' ? null : v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select logo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {visualElements
                                .filter(e => e.element_type === 'logo')
                                .map(e => (
                                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      
                      {currentLayout?.show_logo !== false && currentLayout?.logo_element_id && (
                        <>
                          <div>
                            <Label>Logo Height (pt)</Label>
                            <Input
                              type="number"
                              defaultValue={currentLayout?.logo_height ?? 24}
                              key={`logo-height-${currentLayout?.id}`}
                              min={8}
                              max={80}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val >= 8 && val <= 80) handleLayoutChange('logo_height', val);
                              }}
                            />
                            <p className="text-xs text-muted-foreground mt-1">8-80pt range</p>
                          </div>
                          <div>
                            <Label>Logo X Position (pt)</Label>
                            <Input
                              type="number"
                              defaultValue={currentLayout?.logo_position_x ?? 15}
                              key={`logo-x-${currentLayout?.id}`}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) handleLayoutChange('logo_position_x', val);
                              }}
                            />
                          </div>
                          <div>
                            <Label>Logo Y Position (pt from top)</Label>
                            <Input
                              type="number"
                              defaultValue={currentLayout?.logo_position_y ?? 12}
                              key={`logo-y-${currentLayout?.id}`}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) handleLayoutChange('logo_position_y', val);
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Cover Page Title Styling - only for cover page */}
                {pageType === 'cover' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Title Styling
                      </CardTitle>
                      <CardDescription>
                        Configure how the cover page title is colored and positioned
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Word highlighting */}
                      <div className="space-y-4">
                        <div>
                          <Label>Highlighted Words</Label>
                          <p className="text-sm text-muted-foreground mb-2">
                            Number of words from the start to display in the highlight color
                          </p>
                          <div className="flex items-center gap-4">
                            <Slider
                              value={[currentLayout?.cover_title_highlight_words ?? 3]}
                              onValueChange={([val]) => handleLayoutChange('cover_title_highlight_words', val)}
                              min={0}
                              max={15}
                              step={1}
                              className="flex-1"
                            />
                            <span className="w-8 text-center font-mono">
                              {currentLayout?.cover_title_highlight_words ?? 3}
                            </span>
                          </div>
                        </div>

                        {/* Preview of title split */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
                          <div className="text-lg font-bold">
                            <span style={{ color: currentLayout?.cover_title_highlight_color || '#39FF14' }}>
                              Highlighted Words Here
                            </span>
                            <span style={{ color: currentLayout?.cover_title_text_color || '#FFFFFF' }}>
                              {' '}Remaining Text
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Color pickers */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Highlight Color</Label>
                          <p className="text-xs text-muted-foreground mb-2">For first N words</p>
                          <div className="flex items-center gap-2">
                            <Input
                              type="color"
                              value={currentLayout?.cover_title_highlight_color || '#39FF14'}
                              onChange={(e) => handleLayoutChange('cover_title_highlight_color', e.target.value)}
                              className="w-12 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              type="text"
                              value={currentLayout?.cover_title_highlight_color || '#39FF14'}
                              onChange={(e) => handleLayoutChange('cover_title_highlight_color', e.target.value)}
                              className="flex-1 font-mono text-sm"
                              placeholder="#39FF14"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Remaining Text Color</Label>
                          <p className="text-xs text-muted-foreground mb-2">For words after highlight</p>
                          <div className="flex items-center gap-2">
                            <Input
                              type="color"
                              value={currentLayout?.cover_title_text_color || '#FFFFFF'}
                              onChange={(e) => handleLayoutChange('cover_title_text_color', e.target.value)}
                              className="w-12 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              type="text"
                              value={currentLayout?.cover_title_text_color || '#FFFFFF'}
                              onChange={(e) => handleLayoutChange('cover_title_text_color', e.target.value)}
                              className="flex-1 font-mono text-sm"
                              placeholder="#FFFFFF"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Vertical position */}
                      <div>
                        <Label>Vertical Position Offset (pt)</Label>
                        <p className="text-sm text-muted-foreground mb-2">
                          Move title up from default position (higher value = higher on page)
                        </p>
                        <div className="flex items-center gap-4">
                          <Slider
                            value={[currentLayout?.cover_title_y_offset ?? 100]}
                            onValueChange={([val]) => handleLayoutChange('cover_title_y_offset', val)}
                            min={0}
                            max={300}
                            step={10}
                            className="flex-1"
                          />
                          <span className="w-12 text-center font-mono">
                            {currentLayout?.cover_title_y_offset ?? 100}pt
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Footer Configuration - only for TOC and Content pages */}
                {(pageType === 'toc' || pageType === 'content') && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Minus className="h-5 w-5" />
                        Footer Configuration
                      </CardTitle>
                      <CardDescription>
                        Configure footer sections with text, page numbers, or images
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Separator Line Options */}
                      <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={currentLayout?.footer_show_separator ?? false}
                            onCheckedChange={(checked) => handleLayoutChange('footer_show_separator', checked)}
                          />
                          <Label>Show separator line</Label>
                        </div>
                        
                        {currentLayout?.footer_show_separator && (
                          <>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">Color:</Label>
                              <Input
                                type="color"
                                value={currentLayout?.footer_separator_color || '#CCCCCC'}
                                onChange={(e) => handleLayoutChange('footer_separator_color', e.target.value)}
                                className="w-12 h-8 p-1 cursor-pointer"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">Thickness:</Label>
                              <Input
                                type="number"
                                min={1}
                                max={5}
                                value={currentLayout?.footer_separator_thickness ?? 1}
                                onChange={(e) => handleLayoutChange('footer_separator_thickness', parseInt(e.target.value) || 1)}
                                className="w-16"
                              />
                              <span className="text-sm text-muted-foreground">pt</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Three-column footer sections */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FooterConfigSection
                          label="Left Section"
                          config={{
                            type: (currentLayout?.footer_left_type as FooterSectionType) || 'none',
                            text: currentLayout?.footer_left_text,
                            imageBase64: currentLayout?.footer_left_image_base64,
                            imageMime: currentLayout?.footer_left_image_mime,
                          }}
                          onChange={(config) => {
                            handleLayoutBatchChange({
                              footer_left_type: config.type,
                              footer_left_text: config.text || null,
                              footer_left_image_base64: config.imageBase64 || null,
                              footer_left_image_mime: config.imageMime || null,
                            } as Partial<PageLayout>);
                          }}
                        />
                        <FooterConfigSection
                          label="Middle Section"
                          config={{
                            type: (currentLayout?.footer_middle_type as FooterSectionType) || 'none',
                            text: currentLayout?.footer_middle_text,
                            imageBase64: currentLayout?.footer_middle_image_base64,
                            imageMime: currentLayout?.footer_middle_image_mime,
                          }}
                          onChange={(config) => {
                            handleLayoutBatchChange({
                              footer_middle_type: config.type,
                              footer_middle_text: config.text || null,
                              footer_middle_image_base64: config.imageBase64 || null,
                              footer_middle_image_mime: config.imageMime || null,
                            } as Partial<PageLayout>);
                          }}
                        />
                        <FooterConfigSection
                          label="Right Section"
                          config={{
                            type: (currentLayout?.footer_right_type as FooterSectionType) || 'none',
                            text: currentLayout?.footer_right_text,
                            imageBase64: currentLayout?.footer_right_image_base64,
                            imageMime: currentLayout?.footer_right_image_mime,
                          }}
                          onChange={(config) => {
                            handleLayoutBatchChange({
                              footer_right_type: config.type,
                              footer_right_text: config.text || null,
                              footer_right_image_base64: config.imageBase64 || null,
                              footer_right_image_mime: config.imageMime || null,
                            } as Partial<PageLayout>);
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Text Styles Assignment */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Type className="h-5 w-5" />
                      Text Styles
                    </CardTitle>
                    <CardDescription>
                      Assign text element templates to different content contexts for this page type
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {TEXT_CONTEXTS.map(context => {
                        // Filter which contexts make sense for each page type
                        if (pageType === 'cover' && !['title', 'subtitle'].includes(context)) return null;
                        if (pageType === 'toc' && !['toc_title', 'toc_entry'].includes(context)) return null;
                        if (pageType === 'content' && ['title', 'subtitle', 'toc_title', 'toc_entry'].includes(context)) return null;
                        
                        return (
                          <div key={context}>
                            <Label>{TEXT_CONTEXT_LABELS[context]}</Label>
                            <Select
                              value={getTextStyleForContext(context) || 'none'}
                              onValueChange={(v) => handleTextStyleChange(context, v === 'none' ? null : v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={`Select ${TEXT_CONTEXT_LABELS[context]} style`} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Default</SelectItem>
                                {textElements.map(e => (
                                  <SelectItem key={e.id} value={e.id}>
                                    {e.name} ({ELEMENT_TYPE_LABELS[e.element_type as keyof typeof ELEMENT_TYPE_LABELS]})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* Preview Button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={() => setShowPreview(true)}
              className="gap-2"
            >
              <FileText className="h-5 w-5" />
              Preview Document
            </Button>
          </div>

          {/* Preview Dialog */}
          {showPreview && (
            <DocumentPreview
              profileId={selectedProfileId}
              onClose={() => setShowPreview(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
