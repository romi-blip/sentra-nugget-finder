import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
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
  Copy,
  MoveUp,
  MoveDown,
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import PageThumbnail, { DocumentPage, PageSection } from './PageThumbnail';
import VisualPagePreview from './VisualPagePreview';

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

// Convert flat sections to pages
function sectionsToPages(sections: StructuredSection[]): DocumentPage[] {
  const pages: DocumentPage[] = [
    { id: 'page-cover', pageNumber: 1, pageType: 'cover', sections: [] as PageSection[] },
    { id: 'page-toc', pageNumber: 2, pageType: 'toc', sections: [] as PageSection[] },
  ];

  let currentPage: DocumentPage = {
    id: `page-${pages.length + 1}`,
    pageNumber: pages.length + 1,
    pageType: 'content',
    sections: [] as PageSection[],
  };

  sections.forEach((section) => {
    if (section.type === 'h1' || section.type === 'page-break') {
      // Start a new page if current page has content
      if (currentPage.sections.length > 0) {
        pages.push(currentPage);
        currentPage = {
          id: `page-${pages.length + 1}`,
          pageNumber: pages.length + 1,
          pageType: 'content',
          sections: [] as PageSection[],
        };
      }
    }
    
    if (section.type !== 'page-break') {
      currentPage.sections.push(section);
    }
  });

  // Push the last page if it has content
  if (currentPage.sections.length > 0) {
    pages.push(currentPage);
  }

  // Ensure page numbers are correct
  return pages.map((page, idx) => ({
    ...page,
    pageNumber: idx + 1,
  }));
}

// Convert pages back to flat sections
function pagesToSections(pages: DocumentPage[]): StructuredSection[] {
  const sections: StructuredSection[] = [];
  
  pages.forEach((page, pageIdx) => {
    if (page.pageType === 'content') {
      // Add page break before each content page after the first
      if (pageIdx > 2 && sections.length > 0) {
        sections.push({
          id: `page-break-${pageIdx}`,
          type: 'page-break',
        });
      }
      // Cast PageSection to StructuredSection (they have compatible types)
      sections.push(...(page.sections as StructuredSection[]));
    }
  });

  return sections;
}

// Section editor panel
function SectionEditorPanel({
  section,
  onChange,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  section: StructuredSection;
  onChange: (updated: StructuredSection) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const getSectionIcon = () => {
    switch (section.type) {
      case 'h1': return <Heading1 className="h-4 w-4" />;
      case 'h2': return <Heading2 className="h-4 w-4" />;
      case 'h3': return <Heading3 className="h-4 w-4" />;
      case 'paragraph': return <AlignLeft className="h-4 w-4" />;
      case 'bullet-list': return <List className="h-4 w-4" />;
      case 'image': return <ImageIcon className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Section type badge and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getSectionIcon()}
          <Badge variant="outline">{section.type}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={!canMoveUp}>
            <MoveUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={!canMoveDown}>
            <MoveDown className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Content editor based on type */}
      {section.type === 'page-break' && (
        <div className="text-center p-4 text-muted-foreground">
          <Separator className="my-4" />
          <p className="text-sm">Page break - starts a new page</p>
        </div>
      )}

      {section.type === 'image' && (
        <div className="space-y-4">
          <Label>Image</Label>
          {section.imageBase64 ? (
            <div className="border rounded-lg p-4 bg-muted/30">
              <img
                src={`data:${section.imageMimeType || 'image/jpeg'};base64,${section.imageBase64}`}
                alt="Document image"
                className="max-w-full max-h-[200px] mx-auto rounded"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No image data</p>
          )}
        </div>
      )}

      {section.type === 'bullet-list' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>List Items</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange({ ...section, items: [...(section.items || []), ''] })}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Item
            </Button>
          </div>
          <div className="space-y-2">
            {(section.items || []).map((item, index) => (
              <div key={index} className="flex gap-2">
                <span className="text-muted-foreground mt-2">•</span>
                <Input
                  value={item}
                  onChange={(e) => {
                    const newItems = [...(section.items || [])];
                    newItems[index] = e.target.value;
                    onChange({ ...section, items: newItems });
                  }}
                  placeholder="List item..."
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    onChange({ ...section, items: (section.items || []).filter((_, i) => i !== index) });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {(!section.items || section.items.length === 0) && (
              <p className="text-sm text-muted-foreground">No items yet.</p>
            )}
          </div>
        </div>
      )}

      {(section.type === 'h1' || section.type === 'h2' || section.type === 'h3') && (
        <div className="space-y-2">
          <Label>
            {section.type === 'h1' && 'Heading 1'}
            {section.type === 'h2' && 'Heading 2'}
            {section.type === 'h3' && 'Heading 3'}
          </Label>
          <Input
            value={section.content || ''}
            onChange={(e) => onChange({ ...section, content: e.target.value })}
            placeholder={`Enter ${section.type} text...`}
            className="font-semibold"
          />
        </div>
      )}

      {section.type === 'paragraph' && (
        <div className="space-y-2">
          <Label>Paragraph</Label>
          <Textarea
            value={section.content || ''}
            onChange={(e) => onChange({ ...section, content: e.target.value })}
            placeholder="Enter paragraph text..."
            rows={8}
          />
        </div>
      )}
    </div>
  );
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({
  extractedContent,
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
  const [selectedPageId, setSelectedPageId] = useState<string>('page-cover');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Convert sections to pages
  const pages = useMemo(() => sectionsToPages(editedContent.sections), [editedContent.sections]);
  const currentPage = pages.find((p) => p.id === selectedPageId) || pages[0];
  const selectedSection = editedContent.sections.find((s) => s.id === selectedSectionId);

  // Page management
  const handlePageDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    
    // Don't allow moving cover or toc pages
    if (oldIndex < 2 || newIndex < 2) return;

    const reorderedPages = arrayMove(pages, oldIndex, newIndex);
    const newSections = pagesToSections(reorderedPages);
    setEditedContent((prev) => ({ ...prev, sections: newSections }));
  }, [pages]);

  const handleDuplicatePage = useCallback((pageId: string) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page || page.pageType !== 'content') return;

    const duplicatedSections = page.sections.map((s) => ({
      ...s,
      id: `${s.id}-copy-${Date.now()}`,
    }));

    const pageIndex = pages.findIndex((p) => p.id === pageId);
    const insertIndex = editedContent.sections.findIndex(
      (s) => s.id === pages[pageIndex + 1]?.sections[0]?.id
    );

    const newSections = [...editedContent.sections];
    if (insertIndex === -1) {
      newSections.push({ id: `page-break-${Date.now()}`, type: 'page-break' }, ...duplicatedSections);
    } else {
      newSections.splice(insertIndex, 0, { id: `page-break-${Date.now()}`, type: 'page-break' }, ...duplicatedSections);
    }

    setEditedContent((prev) => ({ ...prev, sections: newSections }));
  }, [pages, editedContent.sections]);

  const handleDeletePage = useCallback((pageId: string) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page || page.pageType !== 'content') return;

    const sectionIdsToRemove = new Set(page.sections.map((s) => s.id));
    const newSections = editedContent.sections.filter((s) => !sectionIdsToRemove.has(s.id));
    
    setEditedContent((prev) => ({ ...prev, sections: newSections }));
    setSelectedPageId(pages[0].id);
    setSelectedSectionId(null);
  }, [pages, editedContent.sections]);

  const handleAddPage = useCallback(() => {
    const newSection: StructuredSection = {
      id: `section-new-${Date.now()}`,
      type: 'h1',
      content: 'New Section',
    };
    setEditedContent((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
  }, []);

  // Section management
  const handleUpdateSection = useCallback((updated: StructuredSection) => {
    setEditedContent((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === updated.id ? updated : s)),
    }));
  }, []);

  const handleDeleteSection = useCallback((sectionId: string) => {
    setEditedContent((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    }));
    setSelectedSectionId(null);
  }, []);

  const handleDuplicateSection = useCallback((sectionId: string) => {
    const section = editedContent.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const sectionIndex = editedContent.sections.findIndex((s) => s.id === sectionId);
    const duplicated: StructuredSection = {
      ...section,
      id: `${section.id}-copy-${Date.now()}`,
    };

    const newSections = [...editedContent.sections];
    newSections.splice(sectionIndex + 1, 0, duplicated);
    setEditedContent((prev) => ({ ...prev, sections: newSections }));
  }, [editedContent.sections]);

  const handleMoveSection = useCallback((sectionId: string, direction: 'up' | 'down') => {
    const sectionIndex = editedContent.sections.findIndex((s) => s.id === sectionId);
    if (sectionIndex === -1) return;

    const newIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1;
    if (newIndex < 0 || newIndex >= editedContent.sections.length) return;

    const newSections = arrayMove(editedContent.sections, sectionIndex, newIndex);
    setEditedContent((prev) => ({ ...prev, sections: newSections }));
  }, [editedContent.sections]);

  const handleSectionClick = useCallback((sectionId: string) => {
    setSelectedSectionId(sectionId);
  }, []);

  const navigatePage = useCallback((direction: 'prev' | 'next') => {
    const currentIndex = pages.findIndex((p) => p.id === selectedPageId);
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < pages.length) {
      setSelectedPageId(pages[newIndex].id);
      setSelectedSectionId(null);
    }
  }, [pages, selectedPageId]);

  const currentSectionIndex = selectedSectionId 
    ? editedContent.sections.findIndex((s) => s.id === selectedSectionId)
    : -1;

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
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

        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left sidebar - Page thumbnails */}
          <div className="w-48 border-r flex flex-col shrink-0">
            <div className="p-3 border-b bg-muted/30">
              <h3 className="font-semibold text-sm">Pages</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pages.length} pages
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-3">
                {/* Document metadata */}
                <div className="space-y-2 pb-3 border-b">
                  <div>
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={editedContent.title}
                      onChange={(e) => setEditedContent((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Title..."
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Subtitle</Label>
                    <Input
                      value={editedContent.subtitle}
                      onChange={(e) => setEditedContent((prev) => ({ ...prev, subtitle: e.target.value }))}
                      placeholder="Subtitle..."
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Page thumbnails */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handlePageDragEnd}
                >
                  <SortableContext
                    items={pages.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {pages.map((page) => (
                      <PageThumbnail
                        key={page.id}
                        page={page}
                        isSelected={selectedPageId === page.id}
                        onSelect={() => {
                          setSelectedPageId(page.id);
                          setSelectedSectionId(null);
                        }}
                        onDuplicate={() => handleDuplicatePage(page.id)}
                        onDelete={() => handleDeletePage(page.id)}
                        documentTitle={editedContent.title}
                        documentSubtitle={editedContent.subtitle}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {/* Add page button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleAddPage}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Page
                </Button>
              </div>
            </ScrollArea>
          </div>

          {/* Center - Visual page preview */}
          <div className="flex-1 flex flex-col min-w-0 bg-muted/10">
            <VisualPagePreview
              page={currentPage}
              totalPages={pages.length}
              documentTitle={editedContent.title}
              documentSubtitle={editedContent.subtitle}
              selectedSectionId={selectedSectionId}
              onSectionClick={handleSectionClick}
              onPrevPage={() => navigatePage('prev')}
              onNextPage={() => navigatePage('next')}
            />
          </div>

          {/* Right sidebar - Section editor */}
          <div className="w-72 border-l flex flex-col shrink-0">
            <div className="p-3 border-b bg-muted/30">
              <h3 className="font-semibold text-sm">Edit Section</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedSection ? `Editing ${selectedSection.type}` : 'Click an element to edit'}
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                {selectedSection ? (
                  <SectionEditorPanel
                    section={selectedSection}
                    onChange={handleUpdateSection}
                    onDelete={() => handleDeleteSection(selectedSection.id)}
                    onDuplicate={() => handleDuplicateSection(selectedSection.id)}
                    onMoveUp={() => handleMoveSection(selectedSection.id, 'up')}
                    onMoveDown={() => handleMoveSection(selectedSection.id, 'down')}
                    canMoveUp={currentSectionIndex > 0}
                    canMoveDown={currentSectionIndex < editedContent.sections.length - 1}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Type className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Click any element in the preview to edit it</p>
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
