import { supabase } from "@/integrations/supabase/client";

export interface ConvertSVGResult {
  success: boolean;
  html: string;
  css: string;
  placeholders: string[];
  pageType: string;
  name: string;
}

export const templateService = {
  async convertSVGToHTML(
    svgContent: string,
    pageType: string = 'text',
    name?: string
  ): Promise<ConvertSVGResult> {
    const { data, error } = await supabase.functions.invoke('convert-svg-to-html', {
      body: { svgContent, pageType, name },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return data as ConvertSVGResult;
  },

  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
};
