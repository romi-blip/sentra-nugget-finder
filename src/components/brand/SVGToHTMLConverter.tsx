import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileCode, Save, Eye, FileText } from "lucide-react";
import { toast } from "sonner";
import { templateService } from "@/services/templateService";
import { useCreateTemplate } from "@/hooks/useDocumentTemplates";

const PAGE_TYPES = [
  { value: 'cover', label: 'Cover Page' },
  { value: 'toc', label: 'Table of Contents' },
  { value: 'text', label: 'Text/Content Page' },
  { value: 'table', label: 'Table Page' },
  { value: 'appendix', label: 'Appendix' },
];

export function SVGToHTMLConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [svgText, setSvgText] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [pageType, setPageType] = useState<string>('text');
  const [templateName, setTemplateName] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<{
    html: string;
    css: string;
    placeholders: string[];
  } | null>(null);
  const [headerHtml, setHeaderHtml] = useState('');
  const [footerHtml, setFooterHtml] = useState('');

  const createTemplate = useCreateTemplate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const isSvg = selectedFile.type === 'image/svg+xml' || selectedFile.name.endsWith('.svg');
      const isTxt = selectedFile.type === 'text/plain' || selectedFile.name.endsWith('.txt');
      
      if (isSvg || isTxt) {
        setFile(selectedFile);
        const baseName = selectedFile.name.replace(/\.(svg|txt)$/i, '');
        setTemplateName(baseName);
        
        // If it's a txt file, read its content
        if (isTxt) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target?.result as string;
            setSvgText(content);
          };
          reader.readAsText(selectedFile);
        } else {
          setSvgText('');
        }
      } else {
        toast.error('Please select an SVG or TXT file');
      }
    }
  };

  const handleConvert = async () => {
    let svgContent: string;
    
    if (inputMode === 'text') {
      if (!svgText.trim()) {
        toast.error('Please enter SVG code');
        return;
      }
      svgContent = btoa(unescape(encodeURIComponent(svgText)));
    } else {
      if (!file) {
        toast.error('Please select an SVG or TXT file');
        return;
      }
      
      // Check if file is txt (already read into svgText) or svg
      if (file.name.endsWith('.txt') && svgText) {
        svgContent = btoa(unescape(encodeURIComponent(svgText)));
      } else {
        svgContent = await templateService.fileToBase64(file);
      }
    }

    setIsConverting(true);
    try {
      const convertResult = await templateService.convertSVGToHTML(svgContent, pageType, templateName);
      
      setResult({
        html: convertResult.html,
        css: convertResult.css,
        placeholders: convertResult.placeholders,
      });
      
      toast.success('SVG converted successfully');
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConverting(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!result) {
      toast.error('Please convert an SVG first');
      return;
    }

    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    await createTemplate.mutateAsync({
      name: templateName,
      page_type: pageType as 'cover' | 'toc' | 'text' | 'table' | 'appendix',
      html_content: result.html,
      css_content: result.css,
      placeholders: result.placeholders,
      header_html: pageType !== 'cover' ? headerHtml || null : null,
      footer_html: pageType !== 'cover' ? footerHtml || null : null,
      is_default: false,
    });

    // Reset form
    setFile(null);
    setResult(null);
    setTemplateName('');
    setHeaderHtml('');
    setFooterHtml('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            SVG to HTML Converter
          </CardTitle>
          <CardDescription>
            Upload an SVG template design and convert it to HTML for document generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'file' | 'text')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload File
              </TabsTrigger>
              <TabsTrigger value="text" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Paste SVG Code
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="file" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="svg-file">SVG or TXT File</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="svg-file"
                    type="file"
                    accept=".svg,.txt,image/svg+xml,text/plain"
                    onChange={handleFileChange}
                    className="flex-1"
                  />
                </div>
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {file.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Upload an .svg file or a .txt file containing SVG code
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="text" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="svg-text">SVG Code</Label>
                <Textarea
                  id="svg-text"
                  value={svgText}
                  onChange={(e) => setSvgText(e.target.value)}
                  placeholder="Paste your SVG code here..."
                  className="font-mono text-xs h-48"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="page-type">Page Type</Label>
              <Select value={pageType} onValueChange={setPageType}>
                <SelectTrigger id="page-type">
                  <SelectValue placeholder="Select page type" />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Enter template name"
              />
            </div>
          </div>


          <Button 
            onClick={handleConvert} 
            disabled={(inputMode === 'file' ? !file : !svgText.trim()) || isConverting}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isConverting ? 'Converting...' : 'Convert to HTML'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-white">
                <style dangerouslySetInnerHTML={{ __html: result.css }} />
                <div dangerouslySetInnerHTML={{ __html: result.html }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generated HTML</CardTitle>
              <CardDescription>
                Detected placeholders: {result.placeholders.length > 0 ? result.placeholders.join(', ') : 'None'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>HTML Content</Label>
                <Textarea
                  value={result.html}
                  readOnly
                  className="font-mono text-xs h-40"
                />
              </div>

              <div className="space-y-2">
                <Label>CSS Styles</Label>
                <Textarea
                  value={result.css}
                  readOnly
                  className="font-mono text-xs h-32"
                />
              </div>

              {pageType !== 'cover' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="header-html">Header HTML (Optional)</Label>
                    <Textarea
                      id="header-html"
                      value={headerHtml}
                      onChange={(e) => setHeaderHtml(e.target.value)}
                      placeholder="Enter shared header HTML for this page type"
                      className="font-mono text-xs h-24"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="footer-html">Footer HTML (Optional)</Label>
                    <Textarea
                      id="footer-html"
                      value={footerHtml}
                      onChange={(e) => setFooterHtml(e.target.value)}
                      placeholder="Enter shared footer HTML for this page type"
                      className="font-mono text-xs h-24"
                    />
                  </div>
                </>
              )}

              <Button 
                onClick={handleSaveTemplate}
                disabled={createTemplate.isPending}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                {createTemplate.isPending ? 'Saving...' : 'Save as Template'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
