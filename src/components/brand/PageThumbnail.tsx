import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Trash2, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

export type SectionType = 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet-list' | 'page-break' | 'image';

export interface PageSection {
  id: string;
  type: SectionType;
  content?: string;
  items?: string[];
  imageBase64?: string;
  imageMimeType?: string;
}

export interface DocumentPage {
  id: string;
  pageNumber: number;
  pageType: 'cover' | 'toc' | 'content';
  sections: PageSection[];
}

interface PageThumbnailProps {
  page: DocumentPage;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  documentTitle?: string;
  documentSubtitle?: string;
}

const PageThumbnail: React.FC<PageThumbnailProps> = ({
  page,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
  documentTitle,
  documentSubtitle,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const renderThumbnailContent = () => {
    if (page.pageType === 'cover') {
      return (
        <div className="h-full flex flex-col items-center justify-center p-2 bg-[#050505]">
          <div className="w-6 h-4 bg-primary/80 rounded-sm mb-2" /> {/* Logo placeholder */}
          <div className="text-[6px] font-bold text-primary text-center leading-tight truncate w-full">
            {documentTitle || 'Document Title'}
          </div>
          <div className="text-[5px] text-white/60 text-center truncate w-full">
            {documentSubtitle || 'Subtitle'}
          </div>
        </div>
      );
    }

    if (page.pageType === 'toc') {
      return (
        <div className="h-full flex flex-col p-2 bg-[#050505]">
          <div className="text-[5px] font-bold text-primary mb-1">Contents</div>
          <div className="space-y-0.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-1 bg-white/30 rounded" style={{ width: `${60 - i * 10}%` }} />
                <div className="text-[4px] text-white/40">{i}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Content page
    return (
      <div className="h-full flex flex-col p-2 bg-[#050505] overflow-hidden">
        {page.sections.slice(0, 4).map((section, idx) => {
          if (section.type === 'h1' || section.type === 'h2' || section.type === 'h3') {
            return (
              <div
                key={idx}
                className={cn(
                  'rounded mb-0.5 truncate',
                  section.type === 'h1' ? 'text-[5px] font-bold text-primary' : 
                  section.type === 'h2' ? 'text-[4px] font-semibold text-primary/80' :
                  'text-[4px] text-primary/60'
                )}
              >
                {section.content?.substring(0, 20) || 'Heading'}
              </div>
            );
          }
          if (section.type === 'paragraph') {
            return (
              <div key={idx} className="h-1 bg-white/20 rounded mb-0.5" style={{ width: `${80 + Math.random() * 20}%` }} />
            );
          }
          if (section.type === 'bullet-list') {
            return (
              <div key={idx} className="space-y-0.5 mb-0.5">
                {(section.items || []).slice(0, 2).map((_, i) => (
                  <div key={i} className="flex items-center gap-0.5">
                    <div className="w-0.5 h-0.5 rounded-full bg-primary" />
                    <div className="h-1 bg-white/20 rounded" style={{ width: `${50 + Math.random() * 30}%` }} />
                  </div>
                ))}
              </div>
            );
          }
          if (section.type === 'image') {
            return (
              <div key={idx} className="h-6 bg-muted/30 rounded border border-white/10 flex items-center justify-center mb-0.5">
                <div className="text-[4px] text-white/40">IMG</div>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative',
        isDragging && 'opacity-50'
      )}
    >
      <div
        className={cn(
          'relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all',
          isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
        )}
        onClick={onSelect}
      >
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1 left-1 z-10 p-0.5 rounded bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>

        {/* Thumbnail content */}
        <div className="w-full aspect-[8.5/11]">
          {renderThumbnailContent()}
        </div>

        {/* Action buttons */}
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="icon"
            className="h-5 w-5"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
          >
            <Copy className="h-2.5 w-2.5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-5 w-5 hover:bg-destructive hover:text-destructive-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-2.5 w-2.5" />
          </Button>
        </div>
      </div>

      {/* Page number */}
      <div className="text-center mt-1">
        <span className={cn(
          'text-xs',
          isSelected ? 'text-primary font-medium' : 'text-muted-foreground'
        )}>
          {page.pageType === 'cover' ? 'Cover' : 
           page.pageType === 'toc' ? 'Contents' : 
           `Page ${page.pageNumber}`}
        </span>
      </div>
    </div>
  );
};

export default PageThumbnail;
