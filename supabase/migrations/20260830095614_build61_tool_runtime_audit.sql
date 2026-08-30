create table public.ld_tool_invocations (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.ld_license_keys(id) on delete cascade,
  device_hash text not null,
  project_id text not null check (char_length(project_id) between 1 and 200),
  tool_name text not null check (char_length(tool_name) between 1 and 80),
  status text not null check (status in ('completed','failed','blocked')),
  input_hash text not null check (char_length(input_hash)=64),
  output_hash text check (output_hash is null or char_length(output_hash)=64),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_code text check (error_code is null or char_length(error_code) <= 160),
  created_at timestamptz not null default now()
);

alter table public.ld_tool_invocations enable row level security;
revoke all on table public.ld_tool_invocations from public, anon, authenticated;
grant select, insert on table public.ld_tool_invocations to service_role;
create index ld_tool_invocations_license_project_created_idx on public.ld_tool_invocations(license_id, project_id, created_at desc);

comment on table public.ld_tool_invocations is 'Build61 metadata-only audit trail for explicit read-only coding/LSP tool invocations. Raw tool inputs and outputs are never persisted.';
