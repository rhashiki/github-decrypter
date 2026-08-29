-- Build 24 — Security & Chaos hardening
-- Defense-in-depth at the database boundary. No customer prompt/source payload is added.

create or replace function public.ld_webhook_accept_signed_row()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Invalid signatures are intentionally not persisted. The Edge Function still returns 401.
  if new.signature_valid is not true then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function public.ld_webhook_accept_signed_row() from public, anon, authenticated;
grant execute on function public.ld_webhook_accept_signed_row() to service_role;

drop trigger if exists ld_webhook_accept_signed_row_trigger on public.ld_webhook_events;
create trigger ld_webhook_accept_signed_row_trigger
before insert or update of signature_valid, payload on public.ld_webhook_events
for each row execute function public.ld_webhook_accept_signed_row();

alter table public.ld_webhook_events
  drop constraint if exists ld_webhook_events_payload_size_chk;
alter table public.ld_webhook_events
  add constraint ld_webhook_events_payload_size_chk
  check (octet_length(payload::text) <= 524288);

create or replace function public.ld_worker_endpoint_is_public_https(p_endpoint text)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_host text;
begin
  if p_endpoint is null or p_endpoint !~* '^https://' or p_endpoint ~ '@' then
    return false;
  end if;

  v_host := lower(substring(p_endpoint from '^https://(\[[^]]+\]|[^/:]+)'));
  if v_host is null or v_host = '' then
    return false;
  end if;
  v_host := trim(both '[]' from v_host);

  if v_host in ('localhost','0.0.0.0','::','::1') then return false; end if;
  if v_host ~ '^127\.' then return false; end if;
  if v_host ~ '^10\.' then return false; end if;
  if v_host ~ '^169\.254\.' then return false; end if;
  if v_host ~ '^192\.168\.' then return false; end if;
  if v_host ~ '^172\.(1[6-9]|2[0-9]|3[01])\.' then return false; end if;
  if v_host ~ '^(fc|fd)[0-9a-f]{2}:' then return false; end if;
  if v_host ~ '^fe[89ab][0-9a-f]:' then return false; end if;
  if v_host ~ '\.(local|internal|localhost|lan)$' then return false; end if;

  return true;
end;
$$;

revoke all on function public.ld_worker_endpoint_is_public_https(text) from public, anon, authenticated;
grant execute on function public.ld_worker_endpoint_is_public_https(text) to service_role;

alter table public.ld_inference_workers
  drop constraint if exists ld_inference_workers_public_endpoint_chk;
alter table public.ld_inference_workers
  add constraint ld_inference_workers_public_endpoint_chk
  check (public.ld_worker_endpoint_is_public_https(endpoint));

alter table public.ld_inference_workers
  drop constraint if exists ld_inference_workers_metrics_size_chk;
alter table public.ld_inference_workers
  add constraint ld_inference_workers_metrics_size_chk
  check (octet_length(metrics::text) <= 65536 and octet_length(metadata::text) <= 32768);
