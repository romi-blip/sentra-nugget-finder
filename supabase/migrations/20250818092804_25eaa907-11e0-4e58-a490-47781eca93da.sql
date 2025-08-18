-- Create website_pages table
CREATE TABLE public.website_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL UNIQUE,
  title text,
  description text,
  content text,
  original_content text,
  word_count integer,
  character_count integer,
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (website pages are generally public knowledge)
CREATE POLICY "Website pages are viewable by everyone" 
ON public.website_pages 
FOR SELECT 
USING (true);

-- Create policy for admin insert/update
CREATE POLICY "Admins can manage website pages" 
ON public.website_pages 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for timestamps
CREATE TRIGGER update_website_pages_updated_at
BEFORE UPDATE ON public.website_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create documents_website vector table
CREATE TABLE public.documents_website (
  id bigserial PRIMARY KEY,
  content text,
  metadata jsonb,
  embedding vector(1536)
);

-- Enable RLS
ALTER TABLE public.documents_website ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Website documents are viewable by everyone" 
ON public.documents_website 
FOR SELECT 
USING (true);

-- Create policy for admin insert/update
CREATE POLICY "Admins can manage website documents" 
ON public.documents_website 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for vector similarity search
CREATE INDEX ON public.documents_website USING hnsw (embedding vector_cosine_ops);

-- Create function to match website documents
CREATE OR REPLACE FUNCTION public.match_documents_website(
  query_embedding vector(1536),
  match_count integer DEFAULT NULL,
  filter jsonb DEFAULT '{}'
)
RETURNS TABLE(
  id bigint,
  content text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents_website.embedding <=> query_embedding) as similarity
  from documents_website
  where metadata @> filter
  order by documents_website.embedding <=> query_embedding
  limit match_count;
end;
$$;