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
  created_at: string;
  updated_at: string;
}

export interface TransformResult {
  html: string;
  originalFileName: string;
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

  async transformDocument(file: File, settings: BrandSettings): Promise<TransformResult> {
    // Read file as base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const { data, error } = await supabase.functions.invoke('transform-document-design', {
      body: {
        file: base64,
        fileName: file.name,
        fileType: file.type,
        settings: {
          primaryColor: settings.primary_color,
          secondaryColor: settings.secondary_color,
          accentPink: settings.accent_pink,
          accentCyan: settings.accent_cyan,
          backgroundColor: settings.background_color,
          textColor: settings.text_color,
          headingFont: settings.heading_font,
          headingWeight: settings.heading_weight,
          bodyFont: settings.body_font,
          bodyWeight: settings.body_weight,
        },
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return {
      html: data.html,
      originalFileName: file.name,
    };
  },
};
