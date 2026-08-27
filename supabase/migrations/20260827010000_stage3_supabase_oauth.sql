create table if not exists public.ld_supabase_oauth_config (
  singleton boolean primary key default true check (singleton),
  client_id text not null,
  app_name text not null default 'Lovable Decrypter',
  redirect_uri text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ld_supabase_oauth_states (
  state_hash text primary key,
  license_id uuid not null references public.ld_license_keys(id) on delete cascade,
  device_hash text not null,
  code_verifier text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ld_supabase_oauth_states_license_idx on public.ld_supabase_oauth_states(license_id);
create index if not exists ld_supabase_oauth_states_expiry_idx on public.ld_supabase_oauth_states(expires_at);

create table if not exists public.ld_supabase_connections (
  license_id uuid not null references public.ld_license_keys(id) on delete cascade,
  device_hash text not null,
  refresh_secret_name text not null,
  granted_scope text,
  token_type text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (license_id, device_hash)
);

alter table public.ld_supabase_oauth_config enable row level security;
alter table public.ld_supabase_oauth_states enable row level security;
alter table public.ld_supabase_connections enable row level security;

revoke all on table public.ld_supabase_oauth_config from public, anon, authenticated;
revoke all on table public.ld_supabase_oauth_states from public, anon, authenticated;
revoke all on table public.ld_supabase_connections from public, anon, authenticated;
grant all on table public.ld_supabase_oauth_config to service_role;
grant all on table public.ld_supabase_oauth_states to service_role;
grant all on table public.ld_supabase_connections to service_role;

create or replace function public.ld_backend_secret_delete(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets where name = p_name;
end;
$$;
revoke all on function public.ld_backend_secret_delete(text) from public, anon, authenticated;
grant execute on function public.ld_backend_secret_delete(text) to service_role;

create or replace function public.ld_supabase_oauth_config_set(
  p_client_id text,
  p_client_secret text,
  p_redirect_uri text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(length(trim(p_client_id)),0) = 0 then raise exception 'client_id required'; end if;
  if coalesce(length(trim(p_client_secret)),0) = 0 then raise exception 'client_secret required'; end if;
  if coalesce(length(trim(p_redirect_uri)),0) = 0 then raise exception 'redirect_uri required'; end if;

  perform public.ld_backend_secret_set(
    'LD_SUPABASE_OAUTH_CLIENT_SECRET',
    p_client_secret,
    'Lovable Decrypter Supabase OAuth client secret'
  );

  insert into public.ld_supabase_oauth_config(singleton, client_id, app_name, redirect_uri, updated_at)
  values (true, trim(p_client_id), 'Lovable Decrypter', trim(p_redirect_uri), now())
  on conflict (singleton) do update set
    client_id = excluded.client_id,
    redirect_uri = excluded.redirect_uri,
    updated_at = now();
end;
$$;
revoke all on function public.ld_supabase_oauth_config_set(text,text,text) from public, anon, authenticated;
grant execute on function public.ld_supabase_oauth_config_set(text,text,text) to service_role;
