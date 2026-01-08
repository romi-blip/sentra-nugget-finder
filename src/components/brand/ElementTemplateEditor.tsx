import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { 
  Layout, 
  Type, 
  Upload, 
  Trash2, 
  Star, 
  Loader2, 
  ImageIcon,
  FileText,
  Pencil,
  Code
} from 'lucide-react';
import {
  useElementTemplates,
  useCreateElementTemplate,
  useUpdateElementTemplate,
  useDeleteElementTemplate,
  useSetDefaultElementTemplate,
  ElementTemplate,
  ElementType,
  VISUAL_ELEMENT_TYPES,
  TEXT_ELEMENT_TYPES,
  ELEMENT_TYPE_LABELS,
} from '@/hooks/useElementTemplates';

// Render SVG to PNG using canvas
async function renderSvgToPng(svgContent: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Parse the SVG to extract/set dimensions
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = svgDoc.documentElement;
      
      // Check for parsing errors
      const parserError = svgDoc.querySelector('parsererror');
      if (parserError) {
        reject(new Error('Invalid SVG: ' + parserError.textContent));
        return;
      }

      // Get or set dimensions
      let width = parseFloat(svgElement.getAttribute('width') || '0');
      let height = parseFloat(svgElement.getAttribute('height') || '0');
      
      // If no dimensions, try viewBox
      if (!width || !height) {
        const viewBox = svgElement.getAttribute('viewBox');
        if (viewBox) {
          const parts = viewBox.split(/\s+|,/).map(Number);
          if (parts.length >= 4) {
            width = parts[2];
            height = parts[3];
          }
        }
      }
      
      // Default dimensions if still not found
      if (!width || !height) {
        width = 595;
        height = 100;
      }

      // Ensure SVG has proper namespace and dimensions
      svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svgElement.setAttribute('width', String(width));
      svgElement.setAttribute('height', String(height));
      
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgElement);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const img = new Image();
      // Use base64 encoding to avoid blob URL issues
      const base64 = btoa(unescape(encodeURIComponent(svgString)));
      const dataUrl = `data:image/svg+xml;base64,${base64}`;

      img.onload = () => {
        canvas.width = img.width || width;
        canvas.height = img.height || height;
        ctx.drawImage(img, 0, 0);
        const pngDataUrl = canvas.toDataURL('image/png');
        resolve(pngDataUrl);
      };

      img.onerror = (e) => {
        console.error('SVG load error:', e);
        reject(new Error('Failed to load SVG - check if it is valid'));
      };

      img.src = dataUrl;
    } catch (error) {
      console.error('SVG parsing error:', error);
      reject(error);
    }
  });
}

interface EditDialogProps {
  template: ElementTemplate;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<ElementTemplate>) => void;
  isSaving: boolean;
}

const FONT_OPTIONS = [
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Georgia', label: 'Georgia' },
];

function EditDialog({ template, isOpen, onClose, onSave, isSaving }: EditDialogProps) {
  const isVisual = VISUAL_ELEMENT_TYPES.includes(template.element_type);
  
  const [name, setName] = useState(template.name);
  const [imageHeight, setImageHeight] = useState(template.image_height || 40);
  const [imageWidth, setImageWidth] = useState(template.image_width || 595);
  const [fontFamily, setFontFamily] = useState(template.font_family || 'Helvetica');
  const [fontSize, setFontSize] = useState(template.font_size || 12);
  const [fontWeight, setFontWeight] = useState<'normal' | 'bold'>((template.font_weight as 'normal' | 'bold') || 'normal');
  const [fontColor, setFontColor] = useState(template.font_color || '#000000');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>((template.text_align as 'left' | 'center' | 'right') || 'left');
  const [marginTop, setMarginTop] = useState(template.margin_top || 0);
  const [marginBottom, setMarginBottom] = useState(template.margin_bottom || 8);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [svgCode, setSvgCode] = useState(template.svg_content || '');

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
        const svgContent = await file.text();
        const pngDataUrl = await renderSvgToPng(svgContent);
        setUploadedImage(pngDataUrl);
        toast({ title: 'SVG converted to PNG successfully' });
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setUploadedImage(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      toast({ title: 'Failed to process image', variant: 'destructive' });
    }
  }, []);

  const handleSvgPaste = async () => {
    if (!svgCode.trim()) {
      toast({ title: 'Please paste SVG code', variant: 'destructive' });
      return;
    }
    try {
      const pngDataUrl = await renderSvgToPng(svgCode);
      setUploadedImage(pngDataUrl);
      // Keep svgCode so it gets saved
      toast({ title: 'SVG converted to PNG successfully' });
    } catch (error) {
      toast({ title: 'Failed to convert SVG', variant: 'destructive' });
    }
  };

  const handleSave = () => {
    const updates: Partial<ElementTemplate> = { name };
    
    if (isVisual) {
      updates.image_height = imageHeight;
      updates.image_width = imageWidth;
      updates.svg_content = svgCode || null;
      if (uploadedImage) {
        updates.image_base64 = uploadedImage;
      }
    } else {
      updates.font_family = fontFamily;
      updates.font_size = fontSize;
      updates.font_weight = fontWeight;
      updates.font_color = fontColor;
      updates.text_align = textAlign;
      updates.margin_top = marginTop;
      updates.margin_bottom = marginBottom;
    }
    
    onSave(updates);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {ELEMENT_TYPE_LABELS[template.element_type]}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Template Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {isVisual ? (
            <>
              <div className="space-y-2">
                <Label>Current Image</Label>
                {(uploadedImage || template.image_base64) && (
                  <div className="border rounded p-2 bg-muted/50">
                    <img 
                      src={uploadedImage || template.image_base64 || ''} 
                      alt="Preview" 
                      className="max-h-32 object-contain"
                    />
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Upload New Image (SVG or PNG)</Label>
                <Input 
                  type="file" 
                  accept=".svg,.png,image/svg+xml,image/png"
                  onChange={handleFileUpload}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Or Paste SVG Code
                </Label>
                <Textarea 
                  value={svgCode}
                  onChange={(e) => setSvgCode(e.target.value)}
                  placeholder="<svg>...</svg>"
                  className="font-mono text-xs h-24"
                />
                <Button variant="outline" size="sm" onClick={handleSvgPaste} disabled={!svgCode.trim()}>
                  Convert SVG to PNG
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Height (px)</Label>
                  <Input 
                    type="number"
                    value={imageHeight}
                    onChange={(e) => setImageHeight(parseInt(e.target.value) || 40)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Width (px)</Label>
                  <Input 
                    type="number"
                    value={imageWidth}
                    onChange={(e) => setImageWidth(parseInt(e.target.value) || 595)}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map(font => (
                      <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                        {font.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Font Size (px)</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[fontSize]}
                      onValueChange={([v]) => setFontSize(v)}
                      min={8}
                      max={48}
                      step={1}
                      className="flex-1"
                    />
                    <span className="w-12 text-sm text-right">{fontSize}px</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Font Weight</Label>
                  <Select value={fontWeight} onValueChange={(v) => setFontWeight(v as 'normal' | 'bold')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="bold">Bold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Text Color</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="color"
                      value={fontColor}
                      onChange={(e) => setFontColor(e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input 
                      value={fontColor}
                      onChange={(e) => setFontColor(e.target.value)}
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Text Align</Label>
                  <Select value={textAlign} onValueChange={(v) => setTextAlign(v as 'left' | 'center' | 'right')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Margin Top (px)</Label>
                  <Input 
                    type="number"
                    value={marginTop}
                    onChange={(e) => setMarginTop(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Margin Bottom (px)</Label>
                  <Input 
                    type="number"
                    value={marginBottom}
                    onChange={(e) => setMarginBottom(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Preview</Label>
                <div 
                  className="p-4 border rounded bg-white"
                  style={{
                    fontFamily: fontFamily,
                    fontSize: `${fontSize}px`,
                    fontWeight: fontWeight === 'bold' ? 700 : 400,
                    color: fontColor,
                    textAlign: textAlign,
                  }}
                >
                  Sample text preview
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ElementCardProps {
  template: ElementTemplate;
  onSetDefault: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

function ElementCard({ template, onSetDefault, onDelete, onEdit }: ElementCardProps) {
  const isVisual = VISUAL_ELEMENT_TYPES.includes(template.element_type);
  
  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{template.name}</CardTitle>
            {template.is_default && (
              <Badge variant="secondary" className="text-xs">
                <Star className="h-3 w-3 mr-1 fill-yellow-500 text-yellow-500" />
                Default
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            {!template.is_default && (
              <Button variant="ghost" size="sm" onClick={onSetDefault}>
                <Star className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
        <CardDescription>
          {ELEMENT_TYPE_LABELS[template.element_type]}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isVisual ? (
          <div className="space-y-3">
            {template.image_base64 ? (
              <div className="border rounded overflow-hidden bg-muted/50">
                <img 
                  src={template.image_base64} 
                  alt={template.name}
                  className="w-full h-24 object-contain object-top"
                />
              </div>
            ) : (
              <div className="border rounded h-24 flex items-center justify-center bg-muted/50">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>Height: {template.image_height || 'Auto'}px</span>
              <span>Width: {template.image_width || 'Auto'}px</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div 
              className="p-3 border rounded"
              style={{
                fontFamily: template.font_family || 'Helvetica',
                fontSize: `${Math.min(template.font_size || 12, 18)}px`,
                fontWeight: template.font_weight === 'bold' ? 700 : 400,
                color: template.font_color || '#000000',
                textAlign: (template.text_align as 'left' | 'center' | 'right') || 'left',
              }}
            >
              Sample text preview
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>Font: {template.font_family}</span>
              <span>Size: {template.font_size}px</span>
              <span>Weight: {template.font_weight}</span>
              <span>Color: {template.font_color}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ElementTemplateEditor() {
  const { data: templates, isLoading } = useElementTemplates();
  const createMutation = useCreateElementTemplate();
  const updateMutation = useUpdateElementTemplate();
  const deleteMutation = useDeleteElementTemplate();
  const setDefaultMutation = useSetDefaultElementTemplate();

  const [activeTab, setActiveTab] = useState<'visual' | 'text'>('visual');
  const [selectedType, setSelectedType] = useState<ElementType>('header');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<ElementTemplate | null>(null);
  
  // New template form state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageHeight, setImageHeight] = useState<number>(40);
  const [imageWidth, setImageWidth] = useState<number>(595);
  const [svgCode, setSvgCode] = useState('');
  
  // Text style state
  const [fontFamily, setFontFamily] = useState<string>('Poppins');
  const [fontSize, setFontSize] = useState<number>(12);
  const [fontWeight, setFontWeight] = useState<'normal' | 'bold'>('normal');
  const [fontColor, setFontColor] = useState('#000000');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [marginTop, setMarginTop] = useState<number>(0);
  const [marginBottom, setMarginBottom] = useState<number>(8);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
        const svgContent = await file.text();
        const pngDataUrl = await renderSvgToPng(svgContent);
        setUploadedImage(pngDataUrl);
        toast({ title: 'SVG converted to PNG successfully' });
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setUploadedImage(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        toast({ title: 'Invalid file type', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Failed to process image', variant: 'destructive' });
    }
  }, []);

  const handleSvgPaste = async () => {
    if (!svgCode.trim()) {
      toast({ title: 'Please paste SVG code', variant: 'destructive' });
      return;
    }
    try {
      const pngDataUrl = await renderSvgToPng(svgCode);
      setUploadedImage(pngDataUrl);
      // Keep svgCode so it gets saved with the template
      toast({ title: 'SVG converted to PNG successfully' });
    } catch (error) {
      toast({ title: 'Failed to convert SVG', variant: 'destructive' });
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName) {
      toast({ title: 'Please enter a template name', variant: 'destructive' });
      return;
    }

    const isVisual = VISUAL_ELEMENT_TYPES.includes(selectedType);

    try {
      await createMutation.mutateAsync({
        name: newTemplateName,
        element_type: selectedType,
        image_base64: isVisual ? uploadedImage : null,
        image_height: isVisual ? imageHeight : null,
        image_width: isVisual ? imageWidth : null,
        svg_content: isVisual ? svgCode || null : null,
        font_family: !isVisual ? fontFamily : null,
        font_size: !isVisual ? fontSize : null,
        font_weight: !isVisual ? fontWeight : null,
        font_color: !isVisual ? fontColor : null,
        line_height: !isVisual ? 1.5 : null,
        margin_top: !isVisual ? marginTop : null,
        margin_bottom: !isVisual ? marginBottom : null,
        margin_left: null,
        text_align: !isVisual ? textAlign : null,
        bullet_character: selectedType === 'bullet' ? '•' : null,
        bullet_indent: selectedType === 'bullet' ? 20 : null,
        position_x: null,
        position_y: null,
        is_default: false,
      });

      toast({ title: 'Template created successfully' });
      setNewTemplateName('');
      setUploadedImage(null);
      setSvgCode('');
    } catch (error) {
      toast({ title: 'Failed to create template', variant: 'destructive' });
    }
  };

  const handleSetDefault = async (template: ElementTemplate) => {
    try {
      await setDefaultMutation.mutateAsync({ 
        id: template.id, 
        element_type: template.element_type 
      });
      toast({ title: `${template.name} set as default` });
    } catch (error) {
      toast({ title: 'Failed to set default', variant: 'destructive' });
    }
  };

  const handleDelete = async (template: ElementTemplate) => {
    try {
      await deleteMutation.mutateAsync(template.id);
      toast({ title: 'Template deleted' });
    } catch (error) {
      toast({ title: 'Failed to delete template', variant: 'destructive' });
    }
  };

  const handleUpdateTemplate = async (updates: Partial<ElementTemplate>) => {
    if (!editingTemplate) return;
    
    try {
      await updateMutation.mutateAsync({ id: editingTemplate.id, ...updates });
      toast({ title: 'Template updated successfully' });
      setEditingTemplate(null);
    } catch (error) {
      toast({ title: 'Failed to update template', variant: 'destructive' });
    }
  };

  const filteredTemplates = templates?.filter(t => 
    activeTab === 'visual' 
      ? VISUAL_ELEMENT_TYPES.includes(t.element_type)
      : TEXT_ELEMENT_TYPES.includes(t.element_type)
  ) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {editingTemplate && (
        <EditDialog
          template={editingTemplate}
          isOpen={!!editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={handleUpdateTemplate}
          isSaving={updateMutation.isPending}
        />
      )}

      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v as 'visual' | 'text');
        setSelectedType(v === 'visual' ? 'header' : 'h1');
      }}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="visual" className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            Visual Elements
          </TabsTrigger>
          <TabsTrigger value="text" className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Text Styles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add Visual Element</CardTitle>
              <CardDescription>
                Upload an SVG or PNG image for headers, footers, logos, or cover backgrounds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Element Type</Label>
                  <Select 
                    value={selectedType} 
                    onValueChange={(v) => setSelectedType(v as ElementType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISUAL_ELEMENT_TYPES.map(type => (
                        <SelectItem key={type} value={type}>
                          {ELEMENT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input 
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="e.g., Modern Header"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Upload Image (SVG or PNG)</Label>
                <div className="flex items-center gap-4">
                  <Input 
                    type="file" 
                    accept=".svg,.png,image/svg+xml,image/png"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Or Paste SVG Code
                </Label>
                <Textarea 
                  value={svgCode}
                  onChange={(e) => setSvgCode(e.target.value)}
                  placeholder="<svg>...</svg>"
                  className="font-mono text-xs h-24"
                />
                <Button variant="outline" size="sm" onClick={handleSvgPaste} disabled={!svgCode.trim()}>
                  Convert SVG to PNG
                </Button>
              </div>

              {uploadedImage && (
                <div className="border rounded p-2 bg-muted/50">
                  <img 
                    src={uploadedImage} 
                    alt="Preview" 
                    className="max-h-32 object-contain"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Height (px)</Label>
                  <Input 
                    type="number"
                    value={imageHeight}
                    onChange={(e) => setImageHeight(parseInt(e.target.value) || 40)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Width (px)</Label>
                  <Input 
                    type="number"
                    value={imageWidth}
                    onChange={(e) => setImageWidth(parseInt(e.target.value) || 595)}
                  />
                </div>
              </div>

              <Button 
                onClick={handleCreateTemplate}
                disabled={createMutation.isPending || !newTemplateName}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Upload className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </CardContent>
          </Card>

          <Separator />

          <div>
            <h3 className="text-lg font-semibold mb-4">Existing Visual Templates</h3>
            {filteredTemplates.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No visual templates yet. Create one above.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map(template => (
                  <ElementCard
                    key={template.id}
                    template={template}
                    onSetDefault={() => handleSetDefault(template)}
                    onDelete={() => handleDelete(template)}
                    onEdit={() => setEditingTemplate(template)}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="text" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add Text Style</CardTitle>
              <CardDescription>
                Define font styles for different text elements in your documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Element Type</Label>
                  <Select 
                    value={selectedType} 
                    onValueChange={(v) => setSelectedType(v as ElementType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_ELEMENT_TYPES.map(type => (
                        <SelectItem key={type} value={type}>
                          {ELEMENT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input 
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="e.g., Bold Title"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Font Family</Label>
                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map(font => (
                      <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                        {font.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Font Size (px)</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[fontSize]}
                      onValueChange={([v]) => setFontSize(v)}
                      min={8}
                      max={48}
                      step={1}
                      className="flex-1"
                    />
                    <span className="w-12 text-sm text-right">{fontSize}px</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Font Weight</Label>
                  <Select 
                    value={fontWeight} 
                    onValueChange={(v) => setFontWeight(v as 'normal' | 'bold')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="bold">Bold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Text Color</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="color"
                      value={fontColor}
                      onChange={(e) => setFontColor(e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input 
                      value={fontColor}
                      onChange={(e) => setFontColor(e.target.value)}
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Text Align</Label>
                  <Select 
                    value={textAlign} 
                    onValueChange={(v) => setTextAlign(v as 'left' | 'center' | 'right')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Margin Top (px)</Label>
                  <Input 
                    type="number"
                    value={marginTop}
                    onChange={(e) => setMarginTop(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Margin Bottom (px)</Label>
                  <Input 
                    type="number"
                    value={marginBottom}
                    onChange={(e) => setMarginBottom(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Live Preview */}
              <div className="space-y-2">
                <Label>Preview</Label>
                <div 
                  className="p-4 border rounded bg-white"
                  style={{
                    fontFamily: fontFamily,
                    fontSize: `${fontSize}px`,
                    fontWeight: fontWeight === 'bold' ? 700 : 400,
                    color: fontColor,
                    textAlign: textAlign,
                    marginTop: `${marginTop}px`,
                    marginBottom: `${marginBottom}px`,
                  }}
                >
                  Sample text for {ELEMENT_TYPE_LABELS[selectedType]}
                </div>
              </div>

              <Button 
                onClick={handleCreateTemplate}
                disabled={createMutation.isPending || !newTemplateName}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <FileText className="h-4 w-4 mr-2" />
                Create Text Style
              </Button>
            </CardContent>
          </Card>

          <Separator />

          <div>
            <h3 className="text-lg font-semibold mb-4">Existing Text Styles</h3>
            {filteredTemplates.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No text styles yet. Create one above.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map(template => (
                  <ElementCard
                    key={template.id}
                    template={template}
                    onSetDefault={() => handleSetDefault(template)}
                    onDelete={() => handleDelete(template)}
                    onEdit={() => setEditingTemplate(template)}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}