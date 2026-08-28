-- Build 23 — Mass Scale / GPU Autoscaling
-- Provider-neutral worker pools, metadata-only dispatch queue, leasing, rate limiting and autoscaling state.

create table if not exists public.ld_inference_pools (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  provider text not null default 'decrypter-local' check (provider = 'decrypter-local'),
  served_model text not null default 'decrypter-local',
  model_label text not null default 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
  min_workers integer not null default 0 check (min_workers >= 0),
  max_workers integer not null default 16 check (max_workers >= 1 and max_workers >= min_workers),
  target_inflight_per_worker integer not null default 2 check (target_inflight_per_worker >= 1),
  max_inflight_per_worker integer not null default 4 check (max_inflight_per_worker >= 1),
  heartbeat_timeout_seconds integer not null default 45 check (heartbeat_timeout_seconds between 15 and 300),
  lease_seconds integer not null default 240 check (lease_seconds between 30 and 900),
  global_requests_per_minute integer not null default 240 check (global_requests_per_minute >= 1),
  scale_down_cooldown_seconds integer not null default 300 check (scale_down_cooldown_seconds >= 60),
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ld_inference_pools(
  code,provider,served_model,model_label,min_workers,max_workers,target_inflight_per_worker,max_inflight_per_worker,
  heartbeat_timeout_seconds,lease_seconds,global_requests_per_minute,scale_down_cooldown_seconds,metadata
) values (
  'decrypter-local-primary','decrypter-local','decrypter-local','Qwen/Qwen3-Coder-30B-A3B-Instruct',0,16,2,4,45,240,240,300,
  jsonb_build_object('batching','vllm-continuous','payload_persistence',false,'build',23)
)
on conflict (code) do update set
  provider=excluded.provider,
  served_model=excluded.served_model,
  model_label=excluded.model_label,
  updated_at=now(),
  metadata=public.ld_inference_pools.metadata || excluded.metadata;

create table if not exists public.ld_inference_workers (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.ld_inference_pools(id) on delete cascade,
  instance_key text not null,
  endpoint text not null check (endpoint ~ '^https://'),
  status text not null default 'joining' check (status in ('joining','ready','draining','offline')),
  inflight integer not null default 0 check (inflight >= 0),
  max_inflight integer not null default 4 check (max_inflight >= 1),
  zone text,
  last_heartbeat_at timestamptz not null default now(),
  last_assigned_at timestamptz,
  last_error text,
  metrics jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pool_id,instance_key),
  unique(pool_id,endpoint)
);
create index if not exists ld_inference_workers_pool_health_idx on public.ld_inference_workers(pool_id,status,last_heartbeat_at);

create table if not exists public.ld_inference_jobs (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.ld_inference_pools(id) on delete cascade,
  request_id uuid not null unique,
  status text not null default 'queued' check (status in ('queued','leased','completed','failed','rejected')),
  worker_id uuid references public.ld_inference_workers(id) on delete set null,
  queued_at timestamptz not null default now(),
  leased_at timestamptz,
  completed_at timestamptz,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ld_inference_jobs_pool_status_idx on public.ld_inference_jobs(pool_id,status,queued_at);

create table if not exists public.ld_inference_leases (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.ld_inference_pools(id) on delete cascade,
  worker_id uuid not null references public.ld_inference_workers(id) on delete cascade,
  job_id uuid not null references public.ld_inference_jobs(id) on delete cascade,
  request_id uuid not null unique,
  state text not null default 'active' check (state in ('active','released','expired')),
  leased_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  outcome text,
  created_at timestamptz not null default now(),
  check (expires_at > leased_at)
);
create index if not exists ld_inference_leases_worker_state_idx on public.ld_inference_leases(worker_id,state,expires_at);

create table if not exists public.ld_inference_rate_windows (
  pool_id uuid not null references public.ld_inference_pools(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key(pool_id,window_started_at)
);

create table if not exists public.ld_inference_scale_decisions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.ld_inference_pools(id) on delete cascade,
  current_workers integer not null,
  ready_workers integer not null,
  queued_jobs integer not null,
  inflight integer not null,
  desired_workers integer not null,
  reason text not null,
  actuator_status text not null default 'not_configured' check (actuator_status in ('not_configured','requested','accepted','failed','skipped')),
  actuator_code text,
  created_at timestamptz not null default now()
);
create index if not exists ld_inference_scale_decisions_pool_created_idx on public.ld_inference_scale_decisions(pool_id,created_at desc);

alter table public.ld_inference_pools enable row level security;
alter table public.ld_inference_workers enable row level security;
alter table public.ld_inference_jobs enable row level security;
alter table public.ld_inference_leases enable row level security;
alter table public.ld_inference_rate_windows enable row level security;
alter table public.ld_inference_scale_decisions enable row level security;

revoke all on table public.ld_inference_pools from anon, authenticated;
revoke all on table public.ld_inference_workers from anon, authenticated;
revoke all on table public.ld_inference_jobs from anon, authenticated;
revoke all on table public.ld_inference_leases from anon, authenticated;
revoke all on table public.ld_inference_rate_windows from anon, authenticated;
revoke all on table public.ld_inference_scale_decisions from anon, authenticated;

create or replace function public.ld_reap_inference_leases(p_pool_code text default 'decrypter-local-primary')
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select l.id,l.worker_id,l.job_id
    from public.ld_inference_leases l
    join public.ld_inference_pools p on p.id=l.pool_id
    where p.code=p_pool_code and l.state='active' and l.expires_at <= now()
    for update of l skip locked
  loop
    update public.ld_inference_leases set state='expired',released_at=now(),outcome='lease_expired' where id=r.id;
    update public.ld_inference_workers set inflight=greatest(0,inflight-1),updated_at=now() where id=r.worker_id;
    update public.ld_inference_jobs set status='failed',completed_at=now(),error_code='LEASE_EXPIRED',updated_at=now() where id=r.job_id and status='leased';
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.ld_enqueue_inference_job(
  p_pool_code text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pool public.ld_inference_pools%rowtype;
  v_window timestamptz := date_trunc('minute',now());
  v_count integer;
  v_job uuid;
begin
  select * into v_pool from public.ld_inference_pools where code=p_pool_code and enabled=true;
  if v_pool.id is null then return jsonb_build_object('ok',false,'code','POOL_DISABLED'); end if;

  insert into public.ld_inference_rate_windows(pool_id,window_started_at,request_count)
  values(v_pool.id,v_window,1)
  on conflict(pool_id,window_started_at) do update set request_count=public.ld_inference_rate_windows.request_count+1,updated_at=now()
  returning request_count into v_count;

  if v_count > v_pool.global_requests_per_minute then
    return jsonb_build_object('ok',false,'code','POOL_RATE_LIMITED','limit',v_pool.global_requests_per_minute,'count',v_count);
  end if;

  insert into public.ld_inference_jobs(pool_id,request_id,status,metadata)
  values(v_pool.id,p_request_id,'queued',jsonb_build_object('payload_persisted',false))
  on conflict(request_id) do update set updated_at=now()
  returning id into v_job;

  return jsonb_build_object('ok',true,'job_id',v_job,'request_count',v_count,'limit',v_pool.global_requests_per_minute);
end;
$$;

create or replace function public.ld_claim_inference_worker(
  p_pool_code text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pool public.ld_inference_pools%rowtype;
  v_worker public.ld_inference_workers%rowtype;
  v_job public.ld_inference_jobs%rowtype;
  v_lease uuid;
begin
  perform public.ld_reap_inference_leases(p_pool_code);
  select * into v_pool from public.ld_inference_pools where code=p_pool_code and enabled=true;
  if v_pool.id is null then return jsonb_build_object('ok',false,'code','POOL_DISABLED'); end if;

  select * into v_job from public.ld_inference_jobs where request_id=p_request_id and pool_id=v_pool.id for update;
  if v_job.id is null then return jsonb_build_object('ok',false,'code','JOB_NOT_FOUND'); end if;
  if v_job.status <> 'queued' then return jsonb_build_object('ok',false,'code','JOB_NOT_QUEUED','status',v_job.status); end if;

  select w.* into v_worker
  from public.ld_inference_workers w
  where w.pool_id=v_pool.id
    and w.status='ready'
    and w.last_heartbeat_at > now() - make_interval(secs => v_pool.heartbeat_timeout_seconds)
    and w.inflight < least(w.max_inflight,v_pool.max_inflight_per_worker)
  order by (w.inflight::numeric / greatest(1,least(w.max_inflight,v_pool.max_inflight_per_worker))) asc,
           w.last_assigned_at asc nulls first,
           w.id
  for update skip locked
  limit 1;

  if v_worker.id is null then return jsonb_build_object('ok',false,'code','POOL_SATURATED'); end if;

  insert into public.ld_inference_leases(pool_id,worker_id,job_id,request_id,expires_at)
  values(v_pool.id,v_worker.id,v_job.id,p_request_id,now()+make_interval(secs => v_pool.lease_seconds))
  returning id into v_lease;

  update public.ld_inference_workers set inflight=inflight+1,last_assigned_at=now(),updated_at=now() where id=v_worker.id;
  update public.ld_inference_jobs set status='leased',worker_id=v_worker.id,leased_at=now(),updated_at=now() where id=v_job.id;

  return jsonb_build_object(
    'ok',true,'lease_id',v_lease,'job_id',v_job.id,'worker_id',v_worker.id,'endpoint',v_worker.endpoint,
    'served_model',v_pool.served_model,'model_label',v_pool.model_label,'lease_seconds',v_pool.lease_seconds
  );
end;
$$;

create or replace function public.ld_finish_inference_job(
  p_lease_id uuid,
  p_outcome text,
  p_error_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lease public.ld_inference_leases%rowtype;
  v_status text;
begin
  select * into v_lease from public.ld_inference_leases where id=p_lease_id for update;
  if v_lease.id is null then return jsonb_build_object('ok',false,'code','LEASE_NOT_FOUND'); end if;
  if v_lease.state <> 'active' then return jsonb_build_object('ok',true,'duplicate',true,'state',v_lease.state); end if;

  v_status := case when p_outcome='success' then 'completed' else 'failed' end;
  update public.ld_inference_leases set state='released',released_at=now(),outcome=left(coalesce(p_outcome,'unknown'),80) where id=v_lease.id;
  update public.ld_inference_workers set inflight=greatest(0,inflight-1),updated_at=now(),last_error=case when v_status='failed' then left(p_error_code,160) else null end where id=v_lease.worker_id;
  update public.ld_inference_jobs set status=v_status,completed_at=now(),error_code=case when v_status='failed' then left(p_error_code,160) else null end,updated_at=now() where id=v_lease.job_id;
  return jsonb_build_object('ok',true,'status',v_status);
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
      count(*)::int as current_workers,
      count(*) filter(where status='ready' and last_heartbeat_at > now()-make_interval(secs => (select heartbeat_timeout_seconds from p)))::int as ready_workers,
      coalesce(sum(inflight) filter(where status='ready' and last_heartbeat_at > now()-make_interval(secs => (select heartbeat_timeout_seconds from p))),0)::int as inflight,
      coalesce(sum(greatest(0,least(max_inflight,(select max_inflight_per_worker from p))-inflight)) filter(where status='ready' and last_heartbeat_at > now()-make_interval(secs => (select heartbeat_timeout_seconds from p))),0)::int as available_slots
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
    'batching','vllm-continuous',
    'payload_persistence',false
  ) from calc;
$$;

revoke execute on function public.ld_reap_inference_leases(text) from public,anon,authenticated;
revoke execute on function public.ld_enqueue_inference_job(text,uuid) from public,anon,authenticated;
revoke execute on function public.ld_claim_inference_worker(text,uuid) from public,anon,authenticated;
revoke execute on function public.ld_finish_inference_job(uuid,text,text) from public,anon,authenticated;
revoke execute on function public.ld_inference_pool_snapshot(text) from public,anon,authenticated;
grant execute on function public.ld_reap_inference_leases(text) to service_role;
grant execute on function public.ld_enqueue_inference_job(text,uuid) to service_role;
grant execute on function public.ld_claim_inference_worker(text,uuid) to service_role;
grant execute on function public.ld_finish_inference_job(uuid,text,text) to service_role;
grant execute on function public.ld_inference_pool_snapshot(text) to service_role;
