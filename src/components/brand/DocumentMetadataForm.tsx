import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DocumentMetadata } from '@/lib/documentTemplates';
import { Lock, Globe } from 'lucide-react';

interface DocumentMetadataFormProps {
  metadata: DocumentMetadata;
  onChange: (metadata: DocumentMetadata) => void;
}

const DocumentMetadataForm: React.FC<DocumentMetadataFormProps> = ({
  metadata,
  onChange,
}) => {
  const updateField = <K extends keyof DocumentMetadata>(
    key: K,
    value: DocumentMetadata[K]
  ) => {
    onChange({ ...metadata, [key]: value });
  };

  return (
    <div className="space-y-6">
      {/* Confidentiality Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
        <div className="flex items-center gap-3">
          {metadata.confidential ? (
            <Lock className="h-5 w-5 text-destructive" />
          ) : (
            <Globe className="h-5 w-5 text-primary" />
          )}
          <div>
            <Label htmlFor="confidential" className="text-base font-medium">
              {metadata.confidential ? 'Confidential Document' : 'Public Document'}
            </Label>
            <p className="text-sm text-muted-foreground">
              {metadata.confidential
                ? 'Marked for internal use only'
                : 'Can be shared externally'}
            </p>
          </div>
        </div>
        <Switch
          id="confidential"
          checked={metadata.confidential}
          onCheckedChange={(checked) => updateField('confidential', checked)}
        />
      </div>

      {/* Title and Subtitle */}
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Document Title *</Label>
          <Input
            id="title"
            value={metadata.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="e.g., Data Security Posture Management"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subtitle">Subtitle</Label>
          <Input
            id="subtitle"
            value={metadata.subtitle || ''}
            onChange={(e) => updateField('subtitle', e.target.value)}
            placeholder="e.g., A comprehensive guide to securing sensitive information"
          />
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          value={metadata.category}
          onChange={(e) => updateField('category', e.target.value)}
          placeholder="e.g., Security Architecture"
        />
      </div>

      {/* Prepared For and Version */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="preparedFor">Prepared For</Label>
          <Input
            id="preparedFor"
            value={metadata.preparedFor}
            onChange={(e) => updateField('preparedFor', e.target.value)}
            placeholder="e.g., Global Enterprise Team"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="version">Version</Label>
          <Input
            id="version"
            value={metadata.version}
            onChange={(e) => updateField('version', e.target.value)}
            placeholder="e.g., v2.4 — Q1 2025"
          />
        </div>
      </div>

      {/* Author and Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="author">Author</Label>
          <Input
            id="author"
            value={metadata.author}
            onChange={(e) => updateField('author', e.target.value)}
            placeholder="e.g., Product Strategy"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            value={metadata.date}
            onChange={(e) => updateField('date', e.target.value)}
            placeholder="e.g., December 14, 2025"
          />
        </div>
      </div>
    </div>
  );
};

export default DocumentMetadataForm;
