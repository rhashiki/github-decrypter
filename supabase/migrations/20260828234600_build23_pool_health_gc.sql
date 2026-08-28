-- Build 23 follow-up: stale-worker detection, bounded control-plane retention and accurate live worker counts.

create or replace function public.ld_reap_inference_leases(p_pool_code text default 'decrypter-local-primary')
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_pool_id uuid;
  v_timeout integer;
  r record;
begin
  select id,heartbeat_timeout_seconds into v_pool_id,v_timeout
  from public.ld_inference_pools where code=p_pool_code;
  if v_pool_id is null then return 0; end if;

  for r in
    select l.id,l.worker_id,l.job_id
    from public.ld_inference_leases l
    where l.pool_id=v_pool_id and l.state='active' and l.expires_at <= now()
    for update skip locked
  loop
    update public.ld_inference_leases set state='expired',released_at=now(),outcome='lease_expired' where id=r.id;
    update public.ld_inference_workers set inflight=greatest(0,inflight-1),updated_at=now() where id=r.worker_id;
    update public.ld_inference_jobs set status='failed',completed_at=now(),error_code='LEASE_EXPIRED',updated_at=now() where id=r.job_id and status='leased';
    v_count := v_count + 1;
  end loop;

  update public.ld_inference_workers
  set status='offline',inflight=0,updated_at=now(),last_error='HEARTBEAT_EXPIRED'
  where pool_id=v_pool_id
    and status in ('joining','ready')
    and last_heartbeat_at <= now()-make_interval(secs => v_timeout);

  delete from public.ld_inference_rate_windows where pool_id=v_pool_id and window_started_at < now()-interval '2 hours';
  delete from public.ld_inference_scale_decisions where pool_id=v_pool_id and created_at < now()-interval '7 days';
  delete from public.ld_inference_jobs
  where pool_id=v_pool_id and status in ('completed','failed','rejected') and created_at < now()-interval '24 hours';

  return v_count;
end;
$$;

create or replace function public.ld_inference_pool_snapshot(p_pool_code text default 'decrypter-local-primary')
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with p as (
    select * from public.ld_inference_pools where code=p_pool_code
  ), w as (
    select
      count(*) filter(
        where status in ('joining','ready','draining')
          and last_heartbeat_at > now()-make_interval(secs => (select heartbeat_timeout_seconds from p))
      )::int as current_workers,
      count(*) filter(
        where status='ready'
          and last_heartbeat_at > now()-make_interval(secs => (select heartbeat_timeout_seconds from p))
      )::int as ready_workers,
      coalesce(sum(inflight) filter(
        where status='ready'
          and last_heartbeat_at > now()-make_interval(secs => (select heartbeat_timeout_seconds from p))
      ),0)::int as inflight,
      coalesce(sum(greatest(0,least(max_inflight,(select max_inflight_per_worker from p))-inflight)) filter(
        where status='ready'
          and last_heartbeat_at > now()-make_interval(secs => (select heartbeat_timeout_seconds from p))
      ),0)::int as available_slots
    from public.ld_inference_workers where pool_id=(select id from p)
  ), j as (
    select count(*) filter(where status='queued' and queued_at > now()-interval '10 minutes')::int as queued_jobs
    from public.ld_inference_jobs where pool_id=(select id from p)
  ), calc as (
    select p.*,w.current_workers,w.ready_workers,w.inflight,w.available_slots,j.queued_jobs,
      least(p.max_workers,greatest(p.min_workers,ceil((w.inflight+j.queued_jobs)::numeric/greatest(1,p.target_inflight_per_worker))::int)) as desired_workers
    from p,w,j
  )
  select jsonb_build_object(
    'configured',true,
    'healthy',(ready_workers > 0 and available_slots > 0),
    'code',case when ready_workers=0 then 'LOCAL_POOL_NO_READY_WORKERS' when available_slots=0 then 'LOCAL_POOL_SATURATED' else 'OK' end,
    'pool_code',code,
    'served_model',served_model,
    'model_label',model_label,
    'current_workers',current_workers,
    'ready_workers',ready_workers,
    'inflight',inflight,
    'queued_jobs',queued_jobs,
    'available_slots',available_slots,
    'desired_workers',desired_workers,
    'min_workers',min_workers,
    'max_workers',max_workers,
    'heartbeat_timeout_seconds',heartbeat_timeout_seconds,
    'batching','vllm-continuous',
    'payload_persistence',false
  ) from calc;
$$;

revoke execute on function public.ld_reap_inference_leases(text) from public,anon,authenticated;
revoke execute on function public.ld_inference_pool_snapshot(text) from public,anon,authenticated;
grant execute on function public.ld_reap_inference_leases(text) to service_role;
grant execute on function public.ld_inference_pool_snapshot(text) to service_role;
