create table if not exists public.ld_cloud_migration_jobs (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.ld_license_keys(id) on delete cascade,
  device_hash text not null,
  lovable_project_id text not null,
  lovable_project_name text,
  framework text,
  source_project_ref text,
  destination_project_ref text not null,
  destination_project_name text,
  helper_path text,
  helper_url text,
  handoff_token_hash text not null unique,
  source_secret_name text,
  status text not null default 'prepared' check (status in ('prepared','helper_ready','inspecting','ready','running','paused','cancelled','failed','completed')),
  phase text not null default 'prepare' check (phase in ('prepare','inspect','schema','data','rls','auth','verify','done')),
  inventory jsonb not null default '{}'::jsonb,
  progress jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  logs jsonb not null default '[]'::jsonb,
  error_code text,
  error_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index if not exists ld_cloud_migration_jobs_owner_idx on public.ld_cloud_migration_jobs (license_id, device_hash, created_at desc);
create index if not exists ld_cloud_migration_jobs_active_idx on public.ld_cloud_migration_jobs (license_id, device_hash, lovable_project_id) where status in ('prepared','helper_ready','inspecting','ready','running','paused');
alter table public.ld_cloud_migration_jobs enable row level security;
revoke all on table public.ld_cloud_migration_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.ld_cloud_migration_jobs to service_role;
comment on table public.ld_cloud_migration_jobs is 'Backend-only resumable Lovable Cloud to Supabase migration jobs. No browser credentials are stored here; source DB URLs live temporarily in Vault.';
