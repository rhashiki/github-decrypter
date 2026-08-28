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
    order by c.updated_at asc, c.created_at asc
    for update skip locked
    limit (case when p_limit < 1 then 1 when p_limit > 3 then 3 else p_limit end)
  ), claimed as (
    update public.ld_knowledge_chunks c
    set embedding_status='processing', embedding_error='', updated_at=now()
    from picked p
    where c.id=p.id
    returning c.id,c.content
  )
  select claimed.id,claimed.content from claimed;
end;
$$;

revoke all on function public.ld_claim_knowledge_chunks(integer) from public,anon,authenticated;
grant execute on function public.ld_claim_knowledge_chunks(integer) to service_role;
