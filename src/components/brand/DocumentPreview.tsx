import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { useDocumentProfile, usePageLayouts, useProfileTextStyles } from '@/hooks/useDocumentProfiles';
import { useElementTemplates, ElementTemplate } from '@/hooks/useElementTemplates';
import { PageLayoutEditor } from './PageLayoutEditor';

interface DocumentPreviewProps {
  profileId: string | null;
  onClose: () => void;
}

export function DocumentPreview({ profileId, onClose }: DocumentPreviewProps) {
  const { data: profile } = useDocumentProfile(profileId);
  const { data: layouts } = usePageLayouts(profileId);
  const { data: textStyles } = useProfileTextStyles(profileId);
  const { data: elementTemplates } = useElementTemplates();

  const getElement = (id: string | null | undefined): ElementTemplate | null => {
    if (!id || !elementTemplates) return null;
    return elementTemplates.find(e => e.id === id) || null;
  };

  const coverLayout = layouts?.find(l => l.page_type === 'cover');
  const tocLayout = layouts?.find(l => l.page_type === 'toc');
  const contentLayout = layouts?.find(l => l.page_type === 'content');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Document Preview: {profile?.name}</DialogTitle>
          <DialogDescription>
            Preview how your document elements combine across all page types
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-3 gap-4 py-4">
          {/* Cover Page */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-center">Cover Page</h3>
            <PageLayoutEditor
              pageType="cover"
              headerElement={getElement(coverLayout?.header_element_id)}
              footerElement={getElement(coverLayout?.footer_element_id)}
              logoElement={getElement(coverLayout?.logo_element_id)}
              backgroundElement={getElement(coverLayout?.background_element_id)}
              logoPosition={{
                x: coverLayout?.logo_position_x || 50,
                y: coverLayout?.logo_position_y || 50,
              }}
              showLogo={coverLayout?.show_logo ?? true}
            />
          </div>

          {/* TOC Page */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-center">Table of Contents</h3>
            <PageLayoutEditor
              pageType="toc"
              headerElement={getElement(tocLayout?.header_element_id)}
              footerElement={getElement(tocLayout?.footer_element_id)}
              logoElement={getElement(tocLayout?.logo_element_id)}
              logoPosition={{
                x: tocLayout?.logo_position_x || 50,
                y: tocLayout?.logo_position_y || 50,
              }}
              showLogo={tocLayout?.show_logo ?? true}
            />
          </div>

          {/* Content Page */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-center">Content Page</h3>
            <PageLayoutEditor
              pageType="content"
              headerElement={getElement(contentLayout?.header_element_id)}
              footerElement={getElement(contentLayout?.footer_element_id)}
              logoElement={getElement(contentLayout?.logo_element_id)}
              logoPosition={{
                x: contentLayout?.logo_position_x || 50,
                y: contentLayout?.logo_position_y || 50,
              }}
              showLogo={contentLayout?.show_logo ?? true}
            />
          </div>
        </div>

        {/* Document Settings Summary */}
        {profile && (
          <div className="border-t pt-4 space-y-2 text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground">Document Settings</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>Margins: {profile.page_margin_top}/{profile.page_margin_right}/{profile.page_margin_bottom}/{profile.page_margin_left} pt</div>
              <div>Line Height: {profile.default_line_height}</div>
              <div>Paragraph Spacing: {profile.paragraph_spacing} pt</div>
              <div>Page Break before H1: {profile.page_break_before_h1 ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
