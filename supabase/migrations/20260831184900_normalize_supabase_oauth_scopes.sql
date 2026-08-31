create or replace function public.ld_normalize_supabase_oauth_scopes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(btrim(new.granted_scope), '') = '' then
    new.granted_scope := 'organizations:read projects:read projects:write database:read database:write auth:read auth:write edge_functions:read edge_functions:write secrets:read secrets:write storage:read rest:read rest:write';
  end if;
  return new;
end;
$$;

drop trigger if exists ld_supabase_connections_normalize_scopes on public.ld_supabase_connections;
create trigger ld_supabase_connections_normalize_scopes
before insert or update of granted_scope on public.ld_supabase_connections
for each row
execute function public.ld_normalize_supabase_oauth_scopes();

update public.ld_supabase_connections
set granted_scope = 'organizations:read projects:read projects:write database:read database:write auth:read auth:write edge_functions:read edge_functions:write secrets:read secrets:write storage:read rest:read rest:write',
    updated_at = now()
where coalesce(btrim(granted_scope), '') = '';
