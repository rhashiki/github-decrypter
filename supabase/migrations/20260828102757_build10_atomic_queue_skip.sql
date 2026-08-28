create or replace function public.ld_skip_queue_item(
  p_license_id uuid,
  p_item_id uuid,
  p_project_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.ld_command_queue%rowtype;
  v_project_id text;
  v_changed integer := 0;
  v_batch_status text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_license_id::text || ':' || pg_catalog.coalesce(p_project_id, ''), 0)
  );

  if exists (
    select 1
    from public.ld_command_queue q
    join public.ld_command_batches b on b.id = q.batch_id
    where q.license_id = p_license_id
      and q.status = 'running'
      and (p_project_id is null or b.project_id = p_project_id)
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'QUEUE_ALREADY_RUNNING');
  end if;

  select q.* into v_item
  from public.ld_command_queue q
  join public.ld_command_batches b on b.id = q.batch_id
  where q.id = p_item_id
    and q.license_id = p_license_id
    and q.status in ('failed', 'blocked')
    and (p_project_id is null or b.project_id = p_project_id)
  for update of q
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'ITEM_NOT_SKIPPABLE');
  end if;

  select b.project_id into v_project_id
  from public.ld_command_batches b
  where b.id = v_item.batch_id;

  update public.ld_command_queue
  set status = 'cancelled',
      error_code = 'SKIPPED_BY_USER',
      result_summary = pg_catalog.coalesce(result_summary, 'Ignorado pelo usuário.'),
      completed_at = pg_catalog.now()
  where id = v_item.id;

  update public.ld_command_queue q
  set status = 'queued'
  from public.ld_command_batches b
  where q.batch_id = b.id
    and q.license_id = p_license_id
    and q.status = 'paused'
    and b.project_id is not distinct from v_project_id;
  get diagnostics v_changed = row_count;

  update public.ld_command_batches b
  set status = 'queued', completed_at = null
  where b.license_id = p_license_id
    and b.project_id is not distinct from v_project_id
    and exists (
      select 1 from public.ld_command_queue q
      where q.batch_id = b.id and q.status = 'queued'
    );

  select case
    when exists (select 1 from public.ld_command_queue q where q.batch_id = v_item.batch_id and q.status in ('queued','running','paused')) then 'queued'
    when exists (select 1 from public.ld_command_queue q where q.batch_id = v_item.batch_id and q.status in ('failed','blocked')) then 'failed'
    when exists (select 1 from public.ld_command_queue q where q.batch_id = v_item.batch_id and q.status = 'completed')
         and exists (select 1 from public.ld_command_queue q where q.batch_id = v_item.batch_id and q.status = 'cancelled') then 'partial'
    when exists (select 1 from public.ld_command_queue q where q.batch_id = v_item.batch_id and q.status = 'completed') then 'completed'
    else 'cancelled'
  end into v_batch_status;

  update public.ld_command_batches
  set status = v_batch_status,
      completed_at = case when v_batch_status in ('completed','partial','failed','cancelled') then pg_catalog.now() else null end
  where id = v_item.batch_id;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'item_id', v_item.id,
    'status', 'cancelled',
    'reason', 'SKIPPED_BY_USER',
    'project_id', v_project_id,
    'resumed', v_changed,
    'batch_status', v_batch_status
  );
end;
$$;

revoke all on function public.ld_skip_queue_item(uuid, uuid, text) from public;
revoke all on function public.ld_skip_queue_item(uuid, uuid, text) from anon;
revoke all on function public.ld_skip_queue_item(uuid, uuid, text) from authenticated;
grant execute on function public.ld_skip_queue_item(uuid, uuid, text) to service_role;
