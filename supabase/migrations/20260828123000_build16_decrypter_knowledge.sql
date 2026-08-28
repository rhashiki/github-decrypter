create extension if not exists vector with schema extensions;
create extension if not exists pg_net with schema extensions;

create table if not exists public.ld_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  canonical_url text not null unique,
  domain text not null,
  category text not null,
  title text not null default '',
  source_type text not null default 'official_docs' check (source_type in ('official_docs')),
  status text not null default 'active' check (status in ('active','disabled','stale')),
  content_sha256 text not null default '',
  fetched_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ld_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.ld_knowledge_sources(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  heading_path text[] not null default '{}'::text[],
  content text not null check (char_length(content) between 80 and 8000),
  content_sha256 text not null,
  token_estimate integer not null default 0 check (token_estimate >= 0),
  embedding extensions.vector(384) not null,
  metadata jsonb not null default '{}'::jsonb,
  content_tsv tsvector generated always as (to_tsvector('simple', content)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, chunk_index)
);

alter table public.ld_knowledge_sources enable row level security;
alter table public.ld_knowledge_chunks enable row level security;

revoke all on public.ld_knowledge_sources from public, anon, authenticated;
revoke all on public.ld_knowledge_chunks from public, anon, authenticated;
grant select, insert, update, delete on public.ld_knowledge_sources to service_role;
grant select, insert, update, delete on public.ld_knowledge_chunks to service_role;

create index if not exists ld_knowledge_sources_domain_idx on public.ld_knowledge_sources(domain, category, status);
create index if not exists ld_knowledge_chunks_source_idx on public.ld_knowledge_chunks(source_id, chunk_index);
create index if not exists ld_knowledge_chunks_tsv_idx on public.ld_knowledge_chunks using gin(content_tsv);
create index if not exists ld_knowledge_chunks_embedding_hnsw on public.ld_knowledge_chunks using hnsw (embedding vector_cosine_ops);

create or replace function public.ld_match_knowledge(
  query_embedding extensions.vector(384),
  query_text text default '',
  match_threshold real default 0.50,
  match_count integer default 8,
  filter_domains text[] default null,
  filter_categories text[] default null
)
returns table (
  chunk_id uuid,
  source_id uuid,
  source_key text,
  title text,
  canonical_url text,
  domain text,
  category text,
  heading_path text[],
  content text,
  semantic_similarity real,
  keyword_rank real,
  score real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked as (
    select
      c.id as chunk_id,
      s.id as source_id,
      s.source_key,
      s.title,
      s.canonical_url,
      s.domain,
      s.category,
      c.heading_path,
      c.content,
      (1 - (c.embedding OPERATOR(extensions.<=>) query_embedding))::real as semantic_similarity,
      case
        when nullif(pg_catalog.btrim(query_text), '') is null then 0::real
        else pg_catalog.ts_rank_cd(c.content_tsv, pg_catalog.websearch_to_tsquery('simple', query_text))::real
      end as keyword_rank
    from public.ld_knowledge_chunks c
    join public.ld_knowledge_sources s on s.id = c.source_id
    where s.status = 'active'
      and (filter_domains is null or s.domain = any(filter_domains))
      and (filter_categories is null or s.category = any(filter_categories))
  )
  select
    r.chunk_id,
    r.source_id,
    r.source_key,
    r.title,
    r.canonical_url,
    r.domain,
    r.category,
    r.heading_path,
    r.content,
    r.semantic_similarity,
    r.keyword_rank,
    ((r.semantic_similarity * 0.88) + ((case when r.keyword_rank > 1::real then 1::real else r.keyword_rank end) * 0.12))::real as score
  from ranked r
  where r.semantic_similarity >= (case when match_threshold < 0::real then 0::real when match_threshold > 0.99::real then 0.99::real else match_threshold end)
     or r.keyword_rank >= 0.08
  order by score desc, r.semantic_similarity desc
  limit (case when match_count < 1 then 1 when match_count > 20 then 20 else match_count end);
$$;

revoke all on function public.ld_match_knowledge(extensions.vector, text, real, integer, text[], text[]) from public, anon, authenticated;
grant execute on function public.ld_match_knowledge(extensions.vector, text, real, integer, text[], text[]) to service_role;

comment on table public.ld_knowledge_sources is 'Build 16 Decrypter Knowledge: allowlisted official documentation sources only.';
comment on table public.ld_knowledge_chunks is 'Build 16 Decrypter Knowledge chunks embedded with Supabase Edge gte-small (384 dimensions).';
