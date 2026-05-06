-- RPC functions for cosine-similarity search.
-- Used by lib/rag.ts (retrieveChunks) and lib/ael-cache.ts (checkSemanticCache).

create extension if not exists vector
  with schema extensions;

create extension if not exists "uuid-ossp"
  with schema extensions;

create or replace function public.match_pdf_chunks(
  query_embedding extensions.vector(768),
  match_session_id uuid,
  match_count int default 5,
  similarity_threshold float default 0.5
)
returns table (
  id uuid,
  content text,
  source_ref text,
  similarity float
)
language sql stable
set search_path = public, extensions
as $$
  select
    pc.id,
    pc.content,
    pc.source_ref,
    1 - (pc.embedding <=> query_embedding) as similarity
  from public.pdf_chunks pc
  where pc.session_id = match_session_id
    and pc.embedding is not null
    and 1 - (pc.embedding <=> query_embedding) > similarity_threshold
  order by pc.embedding <=> query_embedding
  limit match_count
$$;

create or replace function public.match_ael_cache(
  query_embedding extensions.vector(768),
  similarity_threshold float default 0.92
)
returns table (
  id uuid,
  response text,
  similarity float
)
language sql stable
set search_path = public, extensions
as $$
  select
    ac.id,
    ac.response,
    1 - (ac.query_embedding <=> query_embedding) as similarity
  from public.ael_cache ac
  where ac.query_embedding is not null
    and ac.response is not null
    and 1 - (ac.query_embedding <=> query_embedding) > similarity_threshold
  order by ac.query_embedding <=> query_embedding
  limit 1
$$;
