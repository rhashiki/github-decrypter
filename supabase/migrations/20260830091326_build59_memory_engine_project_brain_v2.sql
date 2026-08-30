alter table public.ld_agent_steps
  add column if not exists memory_digest text,
  add column if not exists memory_hits integer not null default 0 check (memory_hits between 0 and 20),
  add column if not exists brain_version integer;

create or replace function public.ld_match_knowledge_keyword(
  query_text text,
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
      pg_catalog.ts_rank_cd(
        c.content_tsv,
        pg_catalog.websearch_to_tsquery('simple', coalesce(query_text, ''))
      )::real as keyword_rank
    from public.ld_knowledge_chunks c
    join public.ld_knowledge_sources s on s.id = c.source_id
    where s.status = 'active'
      and pg_catalog.btrim(coalesce(query_text, '')) <> ''
      and c.content_tsv @@ pg_catalog.websearch_to_tsquery('simple', query_text)
      and (filter_domains is null or s.domain = any(filter_domains))
      and (filter_categories is null or s.category = any(filter_categories))
  )
  select
    r.chunk_id,r.source_id,r.source_key,r.title,r.canonical_url,r.domain,r.category,r.heading_path,r.content,
    r.keyword_rank,
    (case when r.keyword_rank > 1::real then 1::real else r.keyword_rank end)::real as score
  from ranked r
  order by r.keyword_rank desc
  limit (case when match_count < 1 then 1 when match_count > 20 then 20 else match_count end);
$$;

revoke all on function public.ld_match_knowledge_keyword(text, integer, text[], text[]) from public, anon, authenticated;
grant execute on function public.ld_match_knowledge_keyword(text, integer, text[], text[]) to service_role;

comment on column public.ld_agent_steps.memory_digest is 'Build 59 hash of ephemeral Memory Engine context; raw memory content is not persisted.';
comment on column public.ld_agent_steps.memory_hits is 'Build 59 number of external knowledge hits used by the step.';
comment on column public.ld_agent_steps.brain_version is 'Build 59 Project Brain version observed by the step.';
comment on function public.ld_match_knowledge_keyword(text, integer, text[], text[]) is 'Build 59 zero-external-dependency keyword fallback for Memory Engine retrieval.';
