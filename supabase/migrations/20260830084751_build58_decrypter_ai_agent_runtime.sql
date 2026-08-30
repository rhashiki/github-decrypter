create table if not exists public.ld_agent_runs (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.ld_license_keys(id) on delete cascade,
  device_hash text not null,
  project_id text,
  mode text not null check (mode in ('plan','build')),
  status text not null default 'created' check (status in ('created','running','waiting_approval','completed','cancelled','failed')),
  max_steps smallint not null default 8 check (max_steps between 1 and 8),
  step_count smallint not null default 0 check (step_count between 0 and 8),
  command_hash text not null check (char_length(command_hash) = 64),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (project_id is null or char_length(project_id) <= 200),
  check (last_error_code is null or char_length(last_error_code) <= 160)
);

create table if not exists public.ld_agent_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ld_agent_runs(id) on delete cascade,
  step_index smallint not null check (step_index between 1 and 8),
  kind text not null default 'model' check (kind in ('model','tool','review')),
  status text not null default 'claimed' check (status in ('claimed','running','completed','failed','cancelled')),
  input_hash text check (input_hash is null or char_length(input_hash) = 64),
  output_hash text check (output_hash is null or char_length(output_hash) = 64),
  provider text,
  model text,
  gateway_profile text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (run_id, step_index),
  check (provider is null or char_length(provider) <= 80),
  check (model is null or char_length(model) <= 240),
  check (gateway_profile is null or char_length(gateway_profile) <= 40),
  check (error_code is null or char_length(error_code) <= 160)
);

create index if not exists ld_agent_runs_license_created_idx on public.ld_agent_runs (license_id, created_at desc);
create index if not exists ld_agent_runs_status_idx on public.ld_agent_runs (status, updated_at desc);
create index if not exists ld_agent_steps_run_idx on public.ld_agent_steps (run_id, step_index);

alter table public.ld_agent_runs enable row level security;
alter table public.ld_agent_steps enable row level security;

revoke all on table public.ld_agent_runs from public, anon, authenticated;
revoke all on table public.ld_agent_steps from public, anon, authenticated;
grant select, insert, update, delete on table public.ld_agent_runs to service_role;
grant select, insert, update, delete on table public.ld_agent_steps to service_role;

create or replace function public.ld_agent_claim_step(
  p_run_id uuid,
  p_license_id uuid,
  p_device_hash text
)
returns table(step_id uuid, step_index smallint, run_mode text, run_status text, max_steps smallint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_step_index smallint;
  v_mode text;
  v_status text;
  v_max_steps smallint;
  v_step_id uuid;
begin
  update public.ld_agent_runs
  set step_count = step_count + 1,
      status = 'running',
      updated_at = now()
  where id = p_run_id
    and license_id = p_license_id
    and device_hash = p_device_hash
    and status in ('created','running','waiting_approval')
    and step_count < max_steps
  returning public.ld_agent_runs.step_count,
            public.ld_agent_runs.mode,
            public.ld_agent_runs.status,
            public.ld_agent_runs.max_steps
  into v_step_index, v_mode, v_status, v_max_steps;

  if not found then
    raise exception 'AGENT_STEP_NOT_CLAIMABLE';
  end if;

  insert into public.ld_agent_steps(run_id, step_index, kind, status)
  values (p_run_id, v_step_index, 'model', 'claimed')
  returning id into v_step_id;

  return query select v_step_id, v_step_index, v_mode, v_status, v_max_steps;
end;
$$;

revoke all on function public.ld_agent_claim_step(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.ld_agent_claim_step(uuid, uuid, text) to service_role;
