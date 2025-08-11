import { useEffect } from "react";

interface SEOProps {
  title: string;
  description?: string;
  canonicalPath?: string;
}

export const SEO = ({ title, description, canonicalPath }: SEOProps) => {
  useEffect(() => {
    document.title = title;

    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }

    if (canonicalPath) {
      const existing = document.querySelector('link[rel="canonical"]');
      const link = existing || document.createElement('link');
      link.setAttribute('rel', 'canonical');
      const origin = window.location.origin;
      link.setAttribute('href', `${origin}${canonicalPath}`);
      if (!existing) document.head.appendChild(link);
    }
  }, [title, description, canonicalPath]);

  return null;
};

export default SEO;
