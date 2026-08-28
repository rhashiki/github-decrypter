create table if not exists public.ld_trust_sessions (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.ld_license_keys(id) on delete cascade,
  device_hash text not null,
  client_version text not null,
  client_fingerprint text not null,
  nonce_hash text not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ld_trust_sessions_license_device_idx
  on public.ld_trust_sessions (license_id, device_hash, expires_at desc);
create index if not exists ld_trust_sessions_expires_idx
  on public.ld_trust_sessions (expires_at) where revoked_at is null;

alter table public.ld_trust_sessions enable row level security;
revoke all on table public.ld_trust_sessions from anon, authenticated;

create table if not exists public.ld_trust_events (
  id uuid primary key default gen_random_uuid(),
  license_id uuid references public.ld_license_keys(id) on delete set null,
  session_id uuid references public.ld_trust_sessions(id) on delete set null,
  device_hash text,
  event_type text not null,
  outcome text not null,
  client_version text,
  client_fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ld_trust_events_license_created_idx
  on public.ld_trust_events (license_id, created_at desc);
create index if not exists ld_trust_events_type_created_idx
  on public.ld_trust_events (event_type, created_at desc);

alter table public.ld_trust_events enable row level security;
revoke all on table public.ld_trust_events from anon, authenticated;

comment on table public.ld_trust_sessions is 'Build 21 short-lived server-authoritative trust sessions. Service-role access only.';
comment on table public.ld_trust_events is 'Build 21 minimal trust/security audit events. Service-role access only.';
