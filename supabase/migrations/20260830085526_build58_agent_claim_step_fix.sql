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
  update public.ld_agent_runs as r
  set step_count = r.step_count + 1,
      status = 'running',
      updated_at = now()
  where r.id = p_run_id
    and r.license_id = p_license_id
    and r.device_hash = p_device_hash
    and r.status in ('created','running','waiting_approval')
    and r.step_count < r.max_steps
  returning r.step_count, r.mode, r.status, r.max_steps
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
