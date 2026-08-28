create extension if not exists pg_cron with schema pg_catalog;

-- Build 16: keep keyword retrieval available while a chunk still waits for its vector.
drop function if exists public.ld_match_knowledge(extensions.vector, text, real, integer, text[], text[]);
create function public.ld_match_knowledge(
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
  embedding_ready boolean,
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
      (c.embedding_status = 'ready' and c.embedding is not null) as embedding_ready,
      case when c.embedding_status = 'ready' and c.embedding is not null
        then (1 - (c.embedding OPERATOR(extensions.<=>) query_embedding))::real
        else 0::real end as semantic_similarity,
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
    r.chunk_id,r.source_id,r.source_key,r.title,r.canonical_url,r.domain,r.category,r.heading_path,r.content,r.embedding_ready,
    r.semantic_similarity,r.keyword_rank,
    (case when r.embedding_ready
      then (r.semantic_similarity * 0.82) + ((case when r.keyword_rank > 1::real then 1::real else r.keyword_rank end) * 0.18)
      else ((case when r.keyword_rank > 1::real then 1::real else r.keyword_rank end) * 0.92)
    end)::real as score
  from ranked r
  where (r.embedding_ready and r.semantic_similarity >= (case when match_threshold < 0::real then 0::real when match_threshold > 0.99::real then 0.99::real else match_threshold end))
     or r.keyword_rank >= 0.05
  order by score desc, r.semantic_similarity desc, r.keyword_rank desc
  limit (case when match_count < 1 then 1 when match_count > 20 then 20 else match_count end);
$$;

revoke all on function public.ld_match_knowledge(extensions.vector, text, real, integer, text[], text[]) from public, anon, authenticated;
grant execute on function public.ld_match_knowledge(extensions.vector, text, real, integer, text[], text[]) to service_role;

-- Processing leases recover automatically after five minutes.
create or replace function public.ld_claim_knowledge_chunks(p_limit integer default 1)
returns table (id uuid, content text)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  with picked as (
    select c.id
    from public.ld_knowledge_chunks c
    where c.embedding_status in ('pending','failed')
       or (c.embedding_status = 'processing' and c.embedding is null and c.updated_at < pg_catalog.now() - interval '5 minutes')
    order by c.updated_at asc, c.created_at asc
    for update skip locked
    limit (case when p_limit < 1 then 1 when p_limit > 3 then 3 else p_limit end)
  ), claimed as (
    update public.ld_knowledge_chunks c
    set embedding_status='processing', embedding_error='', updated_at=pg_catalog.now()
    from picked p
    where c.id=p.id
    returning c.id,c.content
  )
  select claimed.id,claimed.content from claimed;
end;
$$;

revoke all on function public.ld_claim_knowledge_chunks(integer) from public,anon,authenticated;
grant execute on function public.ld_claim_knowledge_chunks(integer) to service_role;

-- The scheduler never embeds when the queue is empty and never exposes the admin token to the client.
do $$
declare j bigint;
begin
  for j in select jobid from cron.job where jobname='ld-knowledge-embed' loop
    perform cron.unschedule(j);
  end loop;
end $$;

select cron.schedule(
  'ld-knowledge-embed',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1/ld-knowledge-embed',
      headers := pg_catalog.jsonb_build_object(
        'content-type','application/json',
        'x-knowledge-admin-token', public.ld_backend_secret('LD_KNOWLEDGE_ADMIN_TOKEN')
      ),
      body := '{"limit":3}'::jsonb
    )
    where exists (
      select 1 from public.ld_knowledge_chunks
      where embedding_status in ('pending','failed')
         or (embedding_status='processing' and embedding is null and updated_at < pg_catalog.now() - interval '5 minutes')
    );
  $job$
);
