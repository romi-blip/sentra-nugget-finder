import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentPage, PageSection } from './PageThumbnail';

interface VisualPagePreviewProps {
  page: DocumentPage;
  totalPages: number;
  documentTitle: string;
  documentSubtitle: string;
  selectedSectionId: string | null;
  onSectionClick: (sectionId: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}

const VisualPagePreview: React.FC<VisualPagePreviewProps> = ({
  page,
  totalPages,
  documentTitle,
  documentSubtitle,
  selectedSectionId,
  onSectionClick,
  onPrevPage,
  onNextPage,
}) => {
  const renderCoverPage = () => (
    <div className="h-full flex flex-col items-center justify-center p-12 text-center">
      {/* Logo area */}
      <div className="w-32 h-20 bg-primary/20 rounded-lg mb-8 flex items-center justify-center border border-primary/30">
        <span className="text-primary font-bold text-xl">SENTRA</span>
      </div>
      
      {/* Confidential badge area */}
      <div className="mb-8">
        <span className="px-4 py-1 bg-destructive/20 text-destructive text-sm rounded-full border border-destructive/30">
          CONFIDENTIAL
        </span>
      </div>
      
      {/* Title */}
      <h1 className="text-4xl font-bold text-primary mb-4 max-w-lg">
        {documentTitle || 'Document Title'}
      </h1>
      
      {/* Subtitle */}
      <p className="text-xl text-white/70 max-w-md">
        {documentSubtitle || 'Document Subtitle'}
      </p>
      
      {/* Footer metadata */}
      <div className="absolute bottom-8 text-sm text-white/40">
        Sentra Security • {new Date().toLocaleDateString()}
      </div>
    </div>
  );

  const renderTOCPage = () => (
    <div className="h-full p-12">
      <h2 className="text-2xl font-bold text-primary mb-8">Table of Contents</h2>
      <div className="space-y-3">
        {/* Placeholder TOC items */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-white/80">Section {i}</span>
            <span className="text-white/40">{i + 2}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderContentPage = () => (
    <div className="h-full p-8 overflow-y-auto">
      {page.sections.length === 0 ? (
        <div className="h-full flex items-center justify-center text-white/40">
          <p>Empty page - add content from the editor</p>
        </div>
      ) : (
        <div className="space-y-4">
          {page.sections.map((section) => {
            const isSelected = selectedSectionId === section.id;
            const baseClasses = cn(
              'rounded-lg p-3 cursor-pointer transition-all border-2',
              isSelected 
                ? 'border-primary bg-primary/10 ring-2 ring-primary/30' 
                : 'border-transparent hover:border-primary/30 hover:bg-white/5'
            );

            if (section.type === 'h1') {
              return (
                <div
                  key={section.id}
                  className={baseClasses}
                  onClick={() => onSectionClick(section.id)}
                >
                  <h1 className="text-3xl font-bold text-primary">
                    {section.content || 'Heading 1'}
                  </h1>
                </div>
              );
            }

            if (section.type === 'h2') {
              return (
                <div
                  key={section.id}
                  className={baseClasses}
                  onClick={() => onSectionClick(section.id)}
                >
                  <h2 className="text-2xl font-semibold text-primary/90">
                    {section.content || 'Heading 2'}
                  </h2>
                </div>
              );
            }

            if (section.type === 'h3') {
              return (
                <div
                  key={section.id}
                  className={baseClasses}
                  onClick={() => onSectionClick(section.id)}
                >
                  <h3 className="text-xl font-medium text-primary/80">
                    {section.content || 'Heading 3'}
                  </h3>
                </div>
              );
            }

            if (section.type === 'paragraph') {
              return (
                <div
                  key={section.id}
                  className={baseClasses}
                  onClick={() => onSectionClick(section.id)}
                >
                  <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
                    {section.content || 'Paragraph text...'}
                  </p>
                </div>
              );
            }

            if (section.type === 'bullet-list') {
              return (
                <div
                  key={section.id}
                  className={baseClasses}
                  onClick={() => onSectionClick(section.id)}
                >
                  <ul className="space-y-2">
                    {(section.items || []).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                        <span className="text-white/80">{item}</span>
                      </li>
                    ))}
                    {(!section.items || section.items.length === 0) && (
                      <li className="text-white/40 italic">Empty list</li>
                    )}
                  </ul>
                </div>
              );
            }

            if (section.type === 'image') {
              return (
                <div
                  key={section.id}
                  className={baseClasses}
                  onClick={() => onSectionClick(section.id)}
                >
                  {section.imageBase64 ? (
                    <img
                      src={`data:${section.imageMimeType || 'image/jpeg'};base64,${section.imageBase64}`}
                      alt="Document image"
                      className="max-w-full max-h-64 mx-auto rounded"
                    />
                  ) : (
                    <div className="h-32 bg-white/10 rounded flex items-center justify-center">
                      <span className="text-white/40">Image placeholder</span>
                    </div>
                  )}
                </div>
              );
            }

            if (section.type === 'page-break') {
              return (
                <div
                  key={section.id}
                  className={cn(baseClasses, 'py-2')}
                  onClick={() => onSectionClick(section.id)}
                >
                  <div className="border-t-2 border-dashed border-white/20 relative">
                    <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#050505] px-2 text-xs text-white/40">
                      Page Break
                    </span>
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Preview area */}
      <div className="flex-1 flex items-center justify-center p-6 bg-muted/20">
        <div 
          className="bg-[#050505] rounded-lg shadow-2xl overflow-hidden border border-white/10"
          style={{
            width: '100%',
            maxWidth: '600px',
            aspectRatio: '8.5/11',
          }}
        >
          {page.pageType === 'cover' && renderCoverPage()}
          {page.pageType === 'toc' && renderTOCPage()}
          {page.pageType === 'content' && renderContentPage()}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 p-4 border-t bg-background">
        <Button
          variant="outline"
          size="icon"
          onClick={onPrevPage}
          disabled={page.pageNumber <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground min-w-[80px] text-center">
          {page.pageType === 'cover' ? 'Cover' : 
           page.pageType === 'toc' ? 'Contents' : 
           `${page.pageNumber} / ${totalPages}`}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={onNextPage}
          disabled={page.pageNumber >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default VisualPagePreview;
