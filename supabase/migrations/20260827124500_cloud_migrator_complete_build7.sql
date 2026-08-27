create table if not exists public.ld_cloud_asset_jobs (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.ld_license_keys(id) on delete cascade,
  device_hash text not null,
  lovable_project_id text not null,
  lovable_project_name text not null default '',
  source_project_ref text not null default '',
  destination_project_ref text not null,
  destination_project_name text not null default '',
  handoff_token_hash text not null,
  source_db_secret_name text not null,
  source_url_secret_name text not null,
  source_key_secret_name text not null,
  status text not null default 'prepared' check (status in ('prepared','helper_ready','running','waiting','completed','cancelled','failed')),
  phase text not null default 'prepare',
  inventory jsonb not null default '{}'::jsonb,
  progress jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  logs jsonb not null default '[]'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

create unique index if not exists ld_cloud_asset_jobs_one_active_project
  on public.ld_cloud_asset_jobs (license_id, device_hash, lovable_project_id)
  where status in ('prepared','helper_ready','running','waiting');

create index if not exists ld_cloud_asset_jobs_lookup
  on public.ld_cloud_asset_jobs (license_id, device_hash, lovable_project_id, created_at desc);

alter table public.ld_cloud_asset_jobs enable row level security;
revoke all on table public.ld_cloud_asset_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.ld_cloud_asset_jobs to service_role;
