-- Enable pgvector extension
create extension if not exists vector with schema extensions;

-- Users (linked to Supabase Auth)
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text,
  role text check (role in ('student', 'instructor')),
  created_at timestamptz default now()
);

-- Courses/Sessions
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references public.users(id),
  title text not null,
  pin varchar(6) unique,
  created_at timestamptz default now()
);

-- Skill Tree Nodes
create table public.skill_nodes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  title text not null,
  prerequisite_ids uuid[] default '{}',
  position_x float, position_y float
);

-- Mastery Scores (BKT input/output)
create table public.mastery_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  node_id uuid references public.skill_nodes(id),
  score float default 0.0 check (score >= 0 and score <= 1),
  updated_at timestamptz default now(),
  unique(user_id, node_id)
);

-- Quests
create table public.quests (
  id uuid primary key default gen_random_uuid(),
  node_id uuid references public.skill_nodes(id),
  question text not null,
  options jsonb not null, -- array of 4 options
  correct_index int not null,
  bloom_level int check (bloom_level between 1 and 6),
  variant_of uuid references public.quests(id) -- untuk pre-generated variants
);

-- Quest Attempts (untuk BKT)
create table public.quest_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  quest_id uuid references public.quests(id),
  is_correct boolean,
  attempted_at timestamptz default now()
);

-- PDF Chunks (untuk RAG)
create table public.pdf_chunks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id),
  content text not null,
  embedding extensions.vector(768), -- pgvector
  source_ref text, -- "Modul 3, hal. 42"
  created_at timestamptz default now()
);

-- AEL Cache (2-tier caching)
create table public.ael_cache (
  id uuid primary key default gen_random_uuid(),
  query_hash text unique, -- SHA-256
  query_embedding extensions.vector(768),
  response text,
  created_at timestamptz default now()
);

-- Index untuk cosine similarity search
create index on public.pdf_chunks using hnsw (embedding extensions.vector_cosine_ops);
create index on public.ael_cache using hnsw (query_embedding extensions.vector_cosine_ops);
