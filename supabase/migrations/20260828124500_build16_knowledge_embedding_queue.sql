alter table public.ld_knowledge_chunks alter column embedding drop not null;
alter table public.ld_knowledge_chunks add column if not exists embedding_status text not null default 'pending' check (embedding_status in ('pending','processing','ready','failed'));
alter table public.ld_knowledge_chunks add column if not exists embedding_error text not null default '';
update public.ld_knowledge_chunks set embedding_status='ready', embedding_error='' where embedding is not null;

create index if not exists ld_knowledge_chunks_embedding_status_idx on public.ld_knowledge_chunks(embedding_status, updated_at);

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
      and c.embedding_status = 'ready'
      and c.embedding is not null
      and (filter_domains is null or s.domain = any(filter_domains))
      and (filter_categories is null or s.category = any(filter_categories))
  )
  select r.chunk_id,r.source_id,r.source_key,r.title,r.canonical_url,r.domain,r.category,r.heading_path,r.content,r.semantic_similarity,r.keyword_rank,
    ((r.semantic_similarity * 0.88) + ((case when r.keyword_rank > 1::real then 1::real else r.keyword_rank end) * 0.12))::real as score
  from ranked r
  where r.semantic_similarity >= (case when match_threshold < 0::real then 0::real when match_threshold > 0.99::real then 0.99::real else match_threshold end)
     or r.keyword_rank >= 0.08
  order by score desc, r.semantic_similarity desc
  limit (case when match_count < 1 then 1 when match_count > 20 then 20 else match_count end);
$$;

revoke all on function public.ld_match_knowledge(extensions.vector, text, real, integer, text[], text[]) from public, anon, authenticated;
grant execute on function public.ld_match_knowledge(extensions.vector, text, real, integer, text[], text[]) to service_role;
