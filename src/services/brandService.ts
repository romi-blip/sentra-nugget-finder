import { supabase } from "@/integrations/supabase/client";

export interface BrandSettings {
  id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  accent_pink: string;
  accent_cyan: string;
  background_color: string;
  text_color: string;
  heading_font: string;
  heading_weight: string;
  body_font: string;
  body_weight: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StructuredSection {
  id: string;
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet-list' | 'numbered-list' | 'table' | 'feature-grid' | 'page-break' | 'image';
  content?: string;
  items?: string[]; // For bullet-list and numbered-list
  tableData?: { rows: string[][] };
  features?: Array<{ title: string; description: string }>;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface ExtractedDocument {
  title: string;
  subtitle: string;
  sections: StructuredSection[];
  isConfidential: boolean;
}

export interface TransformOptions {
  coverTitleHighlightWords?: number;
  useAiStructuring?: boolean; // Enable AI-powered content structuring for exact text preservation
  // Output is always PDF (DOCX has design limitations)
}

export interface TransformResult {
  type: 'pdf' | null;
  modifiedFile: string | null;
  originalFileName: string;
  message?: string;
  extractedContent?: ExtractedDocument;
  pageCount?: number;
}

export const brandService = {
  async getSettings(): Promise<BrandSettings | null> {
    const { data, error } = await supabase
      .from('brand_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching brand settings:', error);
      return null;
    }

    return data as BrandSettings;
  },

  async updateSettings(id: string, settings: Partial<BrandSettings>): Promise<BrandSettings> {
    const { data, error } = await supabase
      .from('brand_settings')
      .update(settings)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as BrandSettings;
  },

  async transformDocument(file: File, settings: BrandSettings, mode: 'extract' | 'generate' = 'extract', options?: TransformOptions): Promise<TransformResult> {
    // Read file as base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const fileType = file.name.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf';

    const { data, error } = await supabase.functions.invoke('transform-document-design', {
      body: {
        file: base64,
        fileName: file.name,
        fileType,
        mode,
        coverTitleHighlightWordsOverride: options?.coverTitleHighlightWords,
        useAiStructuring: options?.useAiStructuring,
        outputFormat: 'pdf', // Always PDF
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return {
      type: data.type,
      modifiedFile: data.modifiedFile,
      originalFileName: data.originalFileName || file.name,
      message: data.message,
      extractedContent: data.extractedContent,
      pageCount: data.pageCount,
    };
  },

  async generateFromContent(
    editedContent: ExtractedDocument, 
    originalFileName: string,
    options?: TransformOptions
  ): Promise<TransformResult> {
    const { data, error } = await supabase.functions.invoke('transform-document-design', {
      body: {
        mode: 'generate',
        editedContent,
        fileName: originalFileName,
        coverTitleHighlightWordsOverride: options?.coverTitleHighlightWords,
        outputFormat: 'pdf', // Always PDF
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return {
      type: data.type,
      modifiedFile: data.modifiedFile,
      originalFileName: data.originalFileName || originalFileName,
      message: data.message,
    };
  },
};
