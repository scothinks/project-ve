create or replace function public.reconcile_organization_ai_usage(
  p_usage_record_id uuid,
  p_status text,
  p_actual_provider_model text default null,
  p_actual_provider_usage jsonb default '{}'::jsonb,
  p_actual_provider_cost numeric default null,
  p_actual_internal_cost numeric default null,
  p_final_charged_units numeric default null,
  p_failure_code text default null,
  p_failed_job_charge_policy text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_usage public.organization_ai_usage_records%rowtype;
begin
  if not private.current_request_is_service_role() then
    raise exception 'Only trusted server workers may reconcile organization AI usage.';
  end if;

  select *
    into v_usage
  from public.organization_ai_usage_records
  where id = p_usage_record_id
  for update;

  if v_usage.id is null then
    raise exception 'AI usage record does not exist.';
  end if;

  if v_usage.status <> 'reserved' then
    return jsonb_build_object(
      'usageRecordId', v_usage.id,
      'status', v_usage.status,
      'finalChargedUnits', v_usage.final_charged_units,
      'reconciliationStatus', v_usage.reconciliation_status
    );
  end if;

  if p_status not in ('released', 'charged') then
    raise exception 'AI usage reconciliation status must be released or charged.';
  end if;

  update public.organization_ai_usage_records
  set status = p_status,
      actual_provider_model = nullif(trim(coalesce(p_actual_provider_model, '')), ''),
      actual_provider_usage = coalesce(p_actual_provider_usage, '{}'::jsonb),
      actual_provider_cost = p_actual_provider_cost,
      actual_internal_cost = p_actual_internal_cost,
      final_charged_units = case when p_status = 'released' then 0 else coalesce(p_final_charged_units, reserved_units) end,
      reconciliation_status = case
        when p_status = 'released' then 'released'
        when p_final_charged_units is null then 'charged_estimate'
        when p_final_charged_units = reserved_units then 'charged_actual'
        else 'adjusted'
      end,
      completed_at = now(),
      failure_code = p_failure_code,
      failed_job_charge_policy = p_failed_job_charge_policy,
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
  where id = v_usage.id
  returning * into v_usage;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_usage.actor_user_id,
    'organization_ai_usage_reconciled',
    'organization',
    v_usage.organization_id::text,
    jsonb_build_object(
      'usageRecordId', v_usage.id,
      'sourceType', v_usage.source_type,
      'sourceId', v_usage.source_id,
      'operationType', v_usage.operation_type,
      'status', v_usage.status,
      'reservedUnits', v_usage.reserved_units,
      'finalChargedUnits', v_usage.final_charged_units,
      'reconciliationStatus', v_usage.reconciliation_status,
      'failedJobChargePolicy', v_usage.failed_job_charge_policy
    )
  );

  return jsonb_build_object(
    'usageRecordId', v_usage.id,
    'status', v_usage.status,
    'finalChargedUnits', v_usage.final_charged_units,
    'reconciliationStatus', v_usage.reconciliation_status
  );
end;
$$;

revoke execute on function public.reconcile_organization_ai_usage(
  uuid, text, text, jsonb, numeric, numeric, numeric, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.reconcile_organization_ai_usage(
  uuid, text, text, jsonb, numeric, numeric, numeric, text, text, jsonb
) to service_role;
