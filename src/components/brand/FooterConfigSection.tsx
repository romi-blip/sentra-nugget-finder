import React, { useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

export type FooterSectionType = 'none' | 'text' | 'page_number' | 'image';
export type PageNumberFormat = 'full' | 'number_only';

export interface FooterSectionConfig {
  type: FooterSectionType;
  text?: string | null;
  imageBase64?: string | null;
  imageMime?: string | null;
  pageNumberFormat?: PageNumberFormat;
}

interface FooterConfigSectionProps {
  label: string;
  config: FooterSectionConfig;
  onChange: (config: FooterSectionConfig) => void;
}

export function FooterConfigSection({ label, config, onChange }: FooterConfigSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTypeChange = (type: FooterSectionType) => {
    onChange({
      ...config,
      type,
      // Clear other fields when changing type
      text: type === 'text' ? (config.text || '') : null,
      imageBase64: type === 'image' ? config.imageBase64 : null,
      imageMime: type === 'image' ? config.imageMime : null,
      pageNumberFormat: type === 'page_number' ? (config.pageNumberFormat || 'full') : undefined,
    });
  };

  const handleTextChange = (text: string) => {
    onChange({ ...config, text });
  };

  const handleFormatChange = (format: PageNumberFormat) => {
    onChange({ ...config, pageNumberFormat: format });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      onChange({
        ...config,
        imageBase64: base64,
        imageMime: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    onChange({
      ...config,
      imageBase64: null,
      imageMime: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getPageNumberPreview = () => {
    return config.pageNumberFormat === 'number_only' ? '1' : 'Page 1 of 10';
  };

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
      <Label className="font-medium">{label}</Label>
      
      <Select value={config.type} onValueChange={handleTypeChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select content type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          <SelectItem value="text">Free Text</SelectItem>
          <SelectItem value="page_number">Page Number</SelectItem>
          <SelectItem value="image">Image</SelectItem>
        </SelectContent>
      </Select>

      {config.type === 'text' && (
        <Input
          placeholder="Enter footer text..."
          value={config.text || ''}
          onChange={(e) => handleTextChange(e.target.value)}
        />
      )}

      {config.type === 'page_number' && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Format</Label>
          <Select value={config.pageNumberFormat || 'full'} onValueChange={handleFormatChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full (Page X of Y)</SelectItem>
              <SelectItem value="number_only">Number Only (X)</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground bg-background p-2 rounded border">
            Preview: <span className="font-mono">{getPageNumberPreview()}</span>
          </div>
        </div>
      )}

      {config.type === 'image' && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          
          {config.imageBase64 ? (
            <div className="flex items-center gap-2">
              <div className="relative w-16 h-10 bg-background rounded border overflow-hidden">
                <img
                  src={`data:${config.imageMime || 'image/png'};base64,${config.imageBase64}`}
                  alt="Footer image"
                  className="w-full h-full object-contain"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Change
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload Image
            </Button>
          )}
        </div>
      )}
    </div>
  );
}