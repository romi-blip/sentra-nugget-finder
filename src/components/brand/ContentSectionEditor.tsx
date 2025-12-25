import React, { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ContentSection } from '@/lib/documentTemplates';
import { GripVertical, Trash2, Image, Plus, Type, FileText } from 'lucide-react';

interface ContentSectionEditorProps {
  sections: ContentSection[];
  onChange: (sections: ContentSection[]) => void;
}

const ContentSectionEditor: React.FC<ContentSectionEditorProps> = ({
  sections,
  onChange,
}) => {
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const updateSection = (id: string, updates: Partial<ContentSection>) => {
    onChange(
      sections.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const removeSection = (id: string) => {
    onChange(sections.filter((s) => s.id !== id));
  };

  const addSection = (type: ContentSection['type']) => {
    const newSection: ContentSection = {
      id: crypto.randomUUID(),
      type,
      content: '',
    };
    onChange([...sections, newSection]);
  };

  const handleImageUpload = (sectionId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      updateSection(sectionId, {
        imageBase64: base64,
        imageMimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (sectionId: string) => {
    updateSection(sectionId, {
      imageBase64: undefined,
      imageMimeType: undefined,
      imageCaption: undefined,
    });
  };

  return (
    <div className="space-y-4">
      {sections.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No content sections yet</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => addSection('heading')}>
              <Type className="h-4 w-4 mr-1" /> Add Heading
            </Button>
            <Button variant="outline" size="sm" onClick={() => addSection('text')}>
              <FileText className="h-4 w-4 mr-1" /> Add Text
            </Button>
            <Button variant="outline" size="sm" onClick={() => addSection('text-image')}>
              <Image className="h-4 w-4 mr-1" /> Add Text + Image
            </Button>
          </div>
        </div>
      ) : (
        <>
          {sections.map((section, index) => (
            <Card key={section.id} className="relative">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-2 pt-2">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                    <span className="text-xs text-muted-foreground">{index + 1}</span>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    {/* Section Type and Chapter */}
                    <div className="flex items-center gap-4">
                      <div className="w-32">
                        <Select
                          value={section.type}
                          onValueChange={(v) =>
                            updateSection(section.id, { type: v as ContentSection['type'] })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="heading">Heading</SelectItem>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="text-image">Text + Image</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {section.type === 'heading' && (
                        <div className="flex-1">
                          <Input
                            placeholder="Chapter Number (e.g., 1.)"
                            value={section.chapterNumber || ''}
                            onChange={(e) =>
                              updateSection(section.id, { chapterNumber: e.target.value })
                            }
                            className="w-32"
                          />
                        </div>
                      )}
                    </div>

                    {/* Title and Subtitle for headings */}
                    {section.type === 'heading' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Input
                            placeholder="Section Title"
                            value={section.title || ''}
                            onChange={(e) =>
                              updateSection(section.id, { title: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Subtitle</Label>
                          <Input
                            placeholder="Section Subtitle"
                            value={section.subtitle || ''}
                            onChange={(e) =>
                              updateSection(section.id, { subtitle: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    )}

                    {/* Content */}
                    <div className="space-y-2">
                      <Label>Content</Label>
                      <Textarea
                        placeholder="Enter section content..."
                        value={section.content}
                        onChange={(e) =>
                          updateSection(section.id, { content: e.target.value })
                        }
                        rows={section.type === 'heading' ? 3 : 6}
                      />
                    </div>

                    {/* Image for text-image sections */}
                    {section.type === 'text-image' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={(el) => (fileInputRefs.current[section.id] = el)}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(section.id, file);
                            }}
                          />
                          {section.imageBase64 ? (
                            <div className="flex items-center gap-4">
                              <img
                                src={`data:${section.imageMimeType || 'image/jpeg'};base64,${section.imageBase64}`}
                                alt="Section image"
                                className="h-24 w-auto rounded border"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeImage(section.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" /> Remove
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRefs.current[section.id]?.click()}
                            >
                              <Image className="h-4 w-4 mr-1" /> Upload Image
                            </Button>
                          )}
                        </div>
                        {section.imageBase64 && (
                          <div className="space-y-2">
                            <Label>Image Caption</Label>
                            <Input
                              placeholder="Image caption (optional)"
                              value={section.imageCaption || ''}
                              onChange={(e) =>
                                updateSection(section.id, { imageCaption: e.target.value })
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeSection(section.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add Section Buttons */}
          <div className="flex justify-center gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => addSection('heading')}>
              <Plus className="h-4 w-4 mr-1" /> Heading
            </Button>
            <Button variant="outline" size="sm" onClick={() => addSection('text')}>
              <Plus className="h-4 w-4 mr-1" /> Text
            </Button>
            <Button variant="outline" size="sm" onClick={() => addSection('text-image')}>
              <Plus className="h-4 w-4 mr-1" /> Text + Image
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default ContentSectionEditor;
