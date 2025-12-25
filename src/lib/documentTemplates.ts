// Document Template Types for Sentra Branded Documents

export interface DocumentMetadata {
  title: string;
  subtitle?: string;
  category: string;
  preparedFor: string;
  version: string;
  author: string;
  date: string;
  confidential: boolean; // Toggle for confidentiality badge
}

export interface TOCItem {
  id: string;
  title: string;
  page: number;
  level: 1 | 2 | 3;
  subsections?: TOCItem[];
}

export interface ContentSection {
  id: string;
  type: 'heading' | 'text' | 'text-image';
  chapterNumber?: string;
  title?: string;
  subtitle?: string;
  content: string;
  imageBase64?: string; // Preserved from original document or uploaded
  imageMimeType?: string;
  imageCaption?: string;
}

export interface ExtractedImage {
  id: string;
  base64: string;
  mimeType: string;
  originalPath?: string;
  width?: number;
  height?: number;
}

export interface SentraDocument {
  metadata: DocumentMetadata;
  tableOfContents: TOCItem[];
  sections: ContentSection[];
  extractedImages: ExtractedImage[];
}

// Brand colors from templates
export const SENTRA_BRAND_COLORS = {
  primary: '#39FF14', // Neon Green
  primaryHover: '#32CD32',
  secondaryOrange: '#FFA500',
  accentPink: '#FF1493',
  accentCyan: '#00FFFF',
  backgroundLight: '#F3F4F6',
  backgroundDark: '#050505',
  cardDark: '#121212',
  cardLight: '#FFFFFF',
} as const;

// Default document metadata
export const DEFAULT_DOCUMENT_METADATA: DocumentMetadata = {
  title: '',
  subtitle: '',
  category: 'Security Architecture',
  preparedFor: '',
  version: 'v1.0',
  author: '',
  date: new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }),
  confidential: false,
};

// Helper to create a new content section
export const createContentSection = (
  type: ContentSection['type'] = 'text',
  overrides: Partial<ContentSection> = {}
): ContentSection => ({
  id: crypto.randomUUID(),
  type,
  content: '',
  ...overrides,
});

// Helper to create a TOC item
export const createTOCItem = (
  title: string,
  page: number,
  level: 1 | 2 | 3 = 1
): TOCItem => ({
  id: crypto.randomUUID(),
  title,
  page,
  level,
});
