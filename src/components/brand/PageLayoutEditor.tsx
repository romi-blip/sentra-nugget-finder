import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ElementTemplate } from '@/hooks/useElementTemplates';

interface PageLayoutEditorProps {
  pageType: 'cover' | 'toc' | 'content';
  headerElement?: ElementTemplate | null;
  footerElement?: ElementTemplate | null;
  logoElement?: ElementTemplate | null;
  backgroundElement?: ElementTemplate | null;
  logoPosition?: { x: number; y: number };
  logoHeight?: number;
  showLogo?: boolean;
  onLogoHeightChange?: (height: number) => void;
  onLogoPositionChange?: (position: { x: number; y: number }) => void;
  editable?: boolean;
}

// Helper to get image source from element template
const getImageSrc = (element: ElementTemplate | null | undefined): string | null => {
  if (!element) return null;
  
  // Check for PNG/JPG base64 first
  if (element.image_base64) {
    // If it starts with data:, use as-is
    if (element.image_base64.startsWith('data:')) {
      return element.image_base64;
    }
    // Otherwise wrap in data URL
    return `data:image/png;base64,${element.image_base64}`;
  }
  
  // Check for SVG content
  if (element.svg_content) {
    // Convert SVG to data URL
    const svgBlob = new Blob([element.svg_content], { type: 'image/svg+xml' });
    return URL.createObjectURL(svgBlob);
  }
  
  return null;
};

// Preset logo positions for common layouts
const LOGO_PRESETS = {
  headerLeft: { x: 15, y: 12, height: 24, label: 'Header Left' },
  headerCenter: { x: 250, y: 12, height: 24, label: 'Header Center' },
  topLeft: { x: 30, y: 30, height: 32, label: 'Top Left' },
  coverCenter: { x: 50, y: 50, height: 40, label: 'Cover Center' },
} as const;

export function PageLayoutEditor({
  pageType,
  headerElement,
  footerElement,
  logoElement,
  backgroundElement,
  logoPosition = { x: 15, y: 12 },
  logoHeight = 24,
  showLogo = true,
  onLogoHeightChange,
  onLogoPositionChange,
  editable = false,
}: PageLayoutEditorProps) {
  // A4 dimensions: 595 x 842 points
  const PDF_WIDTH = 595;
  const PDF_HEIGHT = 842;
  const PREVIEW_WIDTH = 280;
  const PREVIEW_HEIGHT = 396;
  const SCALE = PREVIEW_WIDTH / PDF_WIDTH;
  
  // Header zone height in PDF points (typical header area)
  const HEADER_ZONE_PT = 42;

  const headerSrc = getImageSrc(headerElement);
  const footerSrc = getImageSrc(footerElement);
  const logoSrc = getImageSrc(logoElement);
  const backgroundSrc = getImageSrc(backgroundElement);

  // Default heights for different page types
  const defaultHeights = {
    cover: 40,
    toc: 24,
    content: 24,
  };

  const effectiveLogoHeight = logoHeight || defaultHeights[pageType];
  
  // Calculate logo aspect ratio from element template dimensions
  const logoAspectRatio = logoElement?.image_width && logoElement?.image_height 
    ? logoElement.image_width / logoElement.image_height 
    : 4; // Default fallback aspect ratio
  
  const calculatedLogoWidth = Math.round(effectiveLogoHeight * logoAspectRatio);

  // Apply preset position
  const applyPreset = (preset: keyof typeof LOGO_PRESETS) => {
    const p = LOGO_PRESETS[preset];
    onLogoPositionChange?.({ x: p.x, y: p.y });
    onLogoHeightChange?.(p.height);
  };

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
          {backgroundSrc && (
            <img
              src={backgroundSrc}
              alt="Background"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {/* Header Zone Reference - shows where header bar is */}
          <div 
            className="absolute top-0 left-0 right-0 border-b border-dashed border-primary/40 flex items-center justify-center"
            style={{ height: HEADER_ZONE_PT * SCALE }}
          >
            {headerSrc ? (
              <img
                src={headerSrc}
                alt="Header"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[9px] text-primary/60 font-medium">Header Zone ({HEADER_ZONE_PT}pt)</span>
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

          {/* Logo - positioned using same coordinate system as PDF */}
          {showLogo && logoSrc && (
            <img
              src={logoSrc}
              alt="Logo"
              className="absolute"
              style={{
                left: logoPosition.x * SCALE,
                top: logoPosition.y * SCALE,
                height: effectiveLogoHeight * SCALE,
                width: calculatedLogoWidth * SCALE,
                objectFit: 'contain',
              }}
            />
          )}

          {/* Footer Zone */}
          <div 
            className="absolute bottom-0 left-0 right-0 border-t border-dashed border-muted-foreground/30 flex items-center justify-center"
            style={{ height: 30 }}
          >
            {footerSrc ? (
              <img
                src={footerSrc}
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

        {/* Logo Size Controls - Only show if editable */}
        {editable && showLogo && logoElement && (
          <div className="p-4 space-y-4 border-t">
            {/* Preset Positions */}
            <div className="space-y-2">
              <Label className="text-sm">Quick Positions</Label>
              <div className="flex flex-wrap gap-1">
                {Object.entries(LOGO_PRESETS).map(([key, preset]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(key as keyof typeof LOGO_PRESETS)}
                    className="text-xs h-7"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Logo Size */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm">Logo Height</Label>
                <span className="text-sm text-muted-foreground">
                  {effectiveLogoHeight}pt → {calculatedLogoWidth}pt wide
                </span>
              </div>
              <Slider
                value={[effectiveLogoHeight]}
                onValueChange={(value) => onLogoHeightChange?.(value[0])}
                min={16}
                max={64}
                step={2}
                className="w-full"
              />
            </div>
            
            {/* Position Controls */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm">X Position</Label>
                  <span className="text-sm text-muted-foreground">{logoPosition.x}pt</span>
                </div>
                <Slider
                  value={[logoPosition.x]}
                  onValueChange={(value) => onLogoPositionChange?.({ ...logoPosition, x: value[0] })}
                  min={10}
                  max={450}
                  step={5}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm">Y Position (from top)</Label>
                  <span className="text-sm text-muted-foreground">{logoPosition.y}pt</span>
                </div>
                <Slider
                  value={[logoPosition.y]}
                  onValueChange={(value) => onLogoPositionChange?.({ ...logoPosition, y: value[0] })}
                  min={5}
                  max={80}
                  step={2}
                  className="w-full"
                />
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Position is in PDF points from top-left. For header bar placement, use Y ≈ 10-15pt.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
