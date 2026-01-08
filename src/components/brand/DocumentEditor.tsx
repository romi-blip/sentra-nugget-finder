import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Download, 
  X, 
  Trash2, 
  GripVertical,
  ChevronUp,
  ChevronDown,
  Plus,
  Loader2,
  Edit3,
  Type,
  List,
  Image as ImageIcon,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface StructuredSection {
  id: string;
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet-list' | 'page-break' | 'image';
  content?: string;
  items?: string[];
  imageBase64?: string;
  imageMimeType?: string;
}

export interface ExtractedDocument {
  title: string;
  subtitle: string;
  sections: StructuredSection[];
  isConfidential: boolean;
}

interface DocumentEditorProps {
  extractedContent: ExtractedDocument;
  previewPdf: string | null;
  originalFileName: string;
  onSave: (editedContent: ExtractedDocument) => void;
  onCancel: () => void;
  isGenerating: boolean;
}

// Sortable section item component
function SortableSectionItem({ 
  section, 
  index,
  isSelected,
  onSelect,
  onDelete,
}: { 
  section: StructuredSection;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getSectionIcon = () => {
    switch (section.type) {
      case 'h1': return <Heading1 className="h-4 w-4" />;
      case 'h2': return <Heading2 className="h-4 w-4" />;
      case 'h3': return <Heading3 className="h-4 w-4" />;
      case 'paragraph': return <AlignLeft className="h-4 w-4" />;
      case 'bullet-list': return <List className="h-4 w-4" />;
      case 'image': return <ImageIcon className="h-4 w-4" />;
      case 'page-break': return <Separator className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getSectionLabel = () => {
    if (section.type === 'page-break') return 'Page Break';
    if (section.type === 'image') return 'Image';
    if (section.type === 'bullet-list') return `List (${section.items?.length || 0} items)`;
    const text = section.content || '';
    return text.length > 40 ? text.substring(0, 40) + '...' : text || `${section.type.toUpperCase()}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      }`}
      onClick={onSelect}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-muted-foreground">{getSectionIcon()}</span>
        <Badge variant="outline" className="text-xs shrink-0">
          {section.type}
        </Badge>
        <span className="truncate text-sm">{getSectionLabel()}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="h-3 w-3 text-destructive" />
      </Button>
    </div>
  );
}

// Section editor panel
function SectionEditorPanel({
  section,
  onChange,
}: {
  section: StructuredSection;
  onChange: (updated: StructuredSection) => void;
}) {
  if (section.type === 'page-break') {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <Separator className="my-4" />
        <p className="text-sm">Page break - no editable content</p>
      </div>
    );
  }

  if (section.type === 'image') {
    return (
      <div className="space-y-4">
        <Label>Image</Label>
        {section.imageBase64 ? (
          <div className="border rounded-lg p-4 bg-muted/30">
            <img
              src={`data:${section.imageMimeType || 'image/jpeg'};base64,${section.imageBase64}`}
              alt="Document image"
              className="max-w-full max-h-[300px] mx-auto rounded"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No image data</p>
        )}
      </div>
    );
  }

  if (section.type === 'bullet-list') {
    const items = section.items || [];
    
    const updateItem = (index: number, value: string) => {
      const newItems = [...items];
      newItems[index] = value;
      onChange({ ...section, items: newItems });
    };

    const addItem = () => {
      onChange({ ...section, items: [...items, ''] });
    };

    const removeItem = (index: number) => {
      onChange({ ...section, items: items.filter((_, i) => i !== index) });
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>List Items</Label>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-3 w-3 mr-1" />
            Add Item
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <span className="text-muted-foreground mt-2">•</span>
              <Input
                value={item}
                onChange={(e) => updateItem(index, e.target.value)}
                placeholder="List item..."
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeItem(index)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No items. Click "Add Item" to create one.</p>
          )}
        </div>
      </div>
    );
  }

  // Text sections (h1, h2, h3, paragraph)
  const isHeading = section.type.startsWith('h');

  return (
    <div className="space-y-4">
      <Label>
        {section.type === 'h1' && 'Heading 1'}
        {section.type === 'h2' && 'Heading 2'}
        {section.type === 'h3' && 'Heading 3'}
        {section.type === 'paragraph' && 'Paragraph'}
      </Label>
      {isHeading ? (
        <Input
          value={section.content || ''}
          onChange={(e) => onChange({ ...section, content: e.target.value })}
          placeholder={`Enter ${section.type} text...`}
          className="font-semibold"
        />
      ) : (
        <Textarea
          value={section.content || ''}
          onChange={(e) => onChange({ ...section, content: e.target.value })}
          placeholder="Enter paragraph text..."
          rows={6}
        />
      )}
    </div>
  );
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({
  extractedContent,
  previewPdf,
  originalFileName,
  onSave,
  onCancel,
  isGenerating,
}) => {
  const [editedContent, setEditedContent] = useState<ExtractedDocument>(() => ({
    ...extractedContent,
    sections: extractedContent.sections.map((s, i) => ({
      ...s,
      id: s.id || `section-${i}`,
    })),
  }));
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setEditedContent((prev) => {
        const oldIndex = prev.sections.findIndex((s) => s.id === active.id);
        const newIndex = prev.sections.findIndex((s) => s.id === over.id);
        return {
          ...prev,
          sections: arrayMove(prev.sections, oldIndex, newIndex),
        };
      });
    }
  }, []);

  const handleDeleteSection = useCallback((id: string) => {
    setEditedContent((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== id),
    }));
    if (selectedSectionId === id) {
      setSelectedSectionId(null);
    }
  }, [selectedSectionId]);

  const handleUpdateSection = useCallback((updated: StructuredSection) => {
    setEditedContent((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === updated.id ? updated : s)),
    }));
  }, []);

  const selectedSection = editedContent.sections.find((s) => s.id === selectedSectionId);

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Edit Document Before Download
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onCancel} disabled={isGenerating}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={() => onSave(editedContent)} disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Generate Final PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar - Section list */}
          <div className="w-80 border-r flex flex-col">
            <div className="p-4 border-b bg-muted/30">
              <h3 className="font-semibold text-sm">Document Sections</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Drag to reorder, click to edit
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {/* Title and subtitle */}
                <div className="space-y-2 mb-4 pb-4 border-b">
                  <div>
                    <Label className="text-xs">Document Title</Label>
                    <Input
                      value={editedContent.title}
                      onChange={(e) => setEditedContent((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Document title..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Subtitle</Label>
                    <Input
                      value={editedContent.subtitle}
                      onChange={(e) => setEditedContent((prev) => ({ ...prev, subtitle: e.target.value }))}
                      placeholder="Subtitle..."
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Sections */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={editedContent.sections.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {editedContent.sections.map((section, index) => (
                      <SortableSectionItem
                        key={section.id}
                        section={section}
                        index={index}
                        isSelected={selectedSectionId === section.id}
                        onSelect={() => setSelectedSectionId(section.id)}
                        onDelete={() => handleDeleteSection(section.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {editedContent.sections.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No sections. All content has been removed.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Center - Preview */}
          <div className="flex-1 flex flex-col bg-muted/10">
            <div className="p-4 border-b bg-background">
              <h3 className="font-semibold text-sm">Preview</h3>
              <p className="text-xs text-muted-foreground">
                {originalFileName}
              </p>
            </div>
            <div className="flex-1 p-4 overflow-auto">
              {previewPdf ? (
                <embed
                  src={`data:application/pdf;base64,${previewPdf}`}
                  type="application/pdf"
                  className="w-full h-full min-h-[600px] rounded-lg border"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Preview will be generated with the final PDF</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar - Section editor */}
          <div className="w-80 border-l flex flex-col">
            <div className="p-4 border-b bg-muted/30">
              <h3 className="font-semibold text-sm">Edit Section</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedSection ? `Editing ${selectedSection.type}` : 'Select a section to edit'}
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                {selectedSection ? (
                  <SectionEditorPanel
                    section={selectedSection}
                    onChange={handleUpdateSection}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Type className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Click a section on the left to edit its content</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentEditor;
