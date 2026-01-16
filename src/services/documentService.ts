import { supabase } from "@/integrations/supabase/client";
import { DocumentMetadata, TOCItem, ContentSection } from "@/lib/documentTemplates";

export type FooterSectionType = 'none' | 'text' | 'page_number' | 'image';

export interface FooterConfig {
  showSeparator: boolean;
  separatorColor: string;
  separatorThickness: number;
  leftType: FooterSectionType;
  leftText?: string | null;
  leftImageBase64?: string | null;
  leftImageMime?: string | null;
  middleType: FooterSectionType;
  middleText?: string | null;
  middleImageBase64?: string | null;
  middleImageMime?: string | null;
  rightType: FooterSectionType;
  rightText?: string | null;
  rightImageBase64?: string | null;
  rightImageMime?: string | null;
}

export interface GenerateDocumentParams {
  metadata: DocumentMetadata;
  tableOfContents: TOCItem[];
  sections: ContentSection[];
  logoBase64: string;
  tocFooterConfig?: FooterConfig;
  contentFooterConfig?: FooterConfig;
}

export interface GenerateDocumentResult {
  success: boolean;
  document: string; // base64
  filename: string;
}

export const documentService = {
  async generateBrandedDocument(
    params: GenerateDocumentParams
  ): Promise<GenerateDocumentResult> {
    const { data, error } = await supabase.functions.invoke(
      "generate-branded-document",
      {
        body: params,
      }
    );

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return data as GenerateDocumentResult;
  },

  downloadDocument(base64: string, filename: string) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Convert image file to base64
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // Fetch logo from public folder and convert to base64
  async fetchLogoBase64(): Promise<string> {
    try {
      const response = await fetch("/images/sentra-logo.jpg");
      if (!response.ok) {
        console.error("Failed to fetch logo:", response.status);
        return "";
      }
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error fetching logo:", error);
      return "";
    }
  },
};
