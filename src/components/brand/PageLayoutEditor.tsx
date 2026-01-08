import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ElementTemplate } from '@/hooks/useElementTemplates';

interface PageLayoutEditorProps {
  pageType: 'cover' | 'toc' | 'content';
  headerElement?: ElementTemplate | null;
  footerElement?: ElementTemplate | null;
  logoElement?: ElementTemplate | null;
  backgroundElement?: ElementTemplate | null;
  logoPosition?: { x: number; y: number };
  showLogo?: boolean;
}

export function PageLayoutEditor({
  pageType,
  headerElement,
  footerElement,
  logoElement,
  backgroundElement,
  logoPosition = { x: 50, y: 50 },
  showLogo = true,
}: PageLayoutEditorProps) {
  // A4 aspect ratio for preview (595 x 842 points, scaled down)
  const PREVIEW_WIDTH = 280;
  const PREVIEW_HEIGHT = 396;
  const SCALE = PREVIEW_WIDTH / 595;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div
          className="relative bg-white mx-auto border shadow-sm"
          style={{
            width: PREVIEW_WIDTH,
            height: PREVIEW_HEIGHT,
          }}
        >
          {/* Background */}
          {backgroundElement?.image_base64 && (
            <img
              src={`data:image/png;base64,${backgroundElement.image_base64}`}
              alt="Background"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {/* Header Zone */}
          <div 
            className="absolute top-0 left-0 right-0 border-b border-dashed border-muted-foreground/30 flex items-center justify-center"
            style={{ height: 40 }}
          >
            {headerElement?.image_base64 ? (
              <img
                src={`data:image/png;base64,${headerElement.image_base64}`}
                alt="Header"
                className="h-full object-contain"
              />
            ) : (
              <span className="text-xs text-muted-foreground">Header Zone</span>
            )}
          </div>

          {/* Content Area */}
          <div 
            className="absolute left-4 right-4 flex flex-col items-center justify-center"
            style={{ top: 50, bottom: 50 }}
          >
            {pageType === 'cover' && (
              <div className="text-center space-y-2">
                <div className="text-lg font-bold text-foreground/60">Document Title</div>
                <div className="text-sm text-muted-foreground">Subtitle goes here</div>
              </div>
            )}
            {pageType === 'toc' && (
              <div className="w-full space-y-1 text-xs text-muted-foreground">
                <div className="font-bold text-sm mb-2">Table of Contents</div>
                <div className="flex justify-between">
                  <span>1. Introduction</span>
                  <span>1</span>
                </div>
                <div className="flex justify-between">
                  <span>2. Overview</span>
                  <span>3</span>
                </div>
                <div className="flex justify-between">
                  <span>3. Conclusion</span>
                  <span>7</span>
                </div>
              </div>
            )}
            {pageType === 'content' && (
              <div className="w-full space-y-2 text-xs text-muted-foreground">
                <div className="font-bold text-sm">Section Heading</div>
                <div className="text-[10px] leading-relaxed">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
                  Sed do eiusmod tempor incididunt ut labore.
                </div>
                <div className="pl-2">• Bullet point one</div>
                <div className="pl-2">• Bullet point two</div>
              </div>
            )}
          </div>

          {/* Logo */}
          {showLogo && logoElement?.image_base64 && (
            <img
              src={`data:image/png;base64,${logoElement.image_base64}`}
              alt="Logo"
              className="absolute"
              style={{
                left: logoPosition.x * SCALE,
                top: logoPosition.y * SCALE,
                width: (logoElement.image_width || 100) * SCALE,
                height: (logoElement.image_height || 50) * SCALE,
                objectFit: 'contain',
              }}
            />
          )}

          {/* Footer Zone */}
          <div 
            className="absolute bottom-0 left-0 right-0 border-t border-dashed border-muted-foreground/30 flex items-center justify-center"
            style={{ height: 30 }}
          >
            {footerElement?.image_base64 ? (
              <img
                src={`data:image/png;base64,${footerElement.image_base64}`}
                alt="Footer"
                className="h-full object-contain"
              />
            ) : (
              <span className="text-xs text-muted-foreground">Footer Zone</span>
            )}
          </div>

          {/* Page Type Label */}
          <div className="absolute top-1 right-1 bg-background/80 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground">
            {pageType.toUpperCase()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
