-- Add mode column to ael_cache so semantic cache lookups are scoped per mode.
ALTER TABLE public.ael_cache
  ADD COLUMN IF NOT EXISTS mode text;

-- Rebuild match_ael_cache to filter by mode before cosine similarity.
CREATE OR REPLACE FUNCTION public.match_ael_cache(
  query_embedding  extensions.vector(768),
  match_mode       text,
  similarity_threshold float DEFAULT 0.92
)
RETURNS TABLE (
  id         uuid,
  response   text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT
    ac.id,
    ac.response,
    1 - (ac.query_embedding <=> query_embedding) AS similarity
  FROM public.ael_cache ac
  WHERE ac.mode = match_mode
    AND ac.query_embedding IS NOT NULL
    AND ac.response IS NOT NULL
    AND 1 - (ac.query_embedding <=> query_embedding) > similarity_threshold
  ORDER BY ac.query_embedding <=> query_embedding
  LIMIT 1
$$;
