-- P15-UI-001: organisation staff need to manage inventory for the rewards
-- their own organisation owns. All six inventory RPCs were platform-admin
-- only; this migration adds an organisation-role branch scoped to the
-- reward (or batch's owning reward) each function already operates on.
-- Business logic is unchanged — only the authorization gate moves.

create or replace function public.admin_set_reward_quantity(
  p_reward_id text,
  p_total_available integer,
  p_reason text,
  p_campaign_id text default null,
  p_batch_label text default null,
  p_partner_reference text default null,
  p_available_from timestamptz default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_quantity integer := greatest(0, coalesce(p_total_available, 0));
  v_allocation_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = p_reward_id
  for update;

  if not found then
    raise exception 'Reward not found.';
  end if;

  if not (
    public.current_user_is_admin()
    or (
      v_reward.organization_id is not null
      and public.current_user_has_organization_role(
        v_reward.organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can set reward quantity.';
  end if;

  if v_reward.fulfillment_type in ('voucher_code', 'qr_code') then
    raise exception 'Voucher and QR rewards require item batch upload.';
  end if;

  if p_campaign_id is not null and not exists (select 1 from public.campaigns where id = p_campaign_id) then
    raise exception 'Campaign not found.';
  end if;

  if p_expires_at is not null and p_available_from is not null and p_expires_at <= p_available_from then
    raise exception 'Expiry must be after available from.';
  end if;

  if v_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  insert into public.reward_quantity_allocations (
    reward_id,
    campaign_id,
    batch_label,
    partner_reference,
    quantity_total,
    quantity_available,
    available_from,
    expires_at,
    reason,
    created_by
  )
  values (
    p_reward_id,
    coalesce(p_campaign_id, v_reward.campaign_id),
    nullif(trim(coalesce(p_batch_label, '')), ''),
    nullif(trim(coalesce(p_partner_reference, '')), ''),
    v_quantity,
    v_quantity,
    p_available_from,
    p_expires_at,
    coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Admin quantity allocation'),
    v_actor_id
  )
  returning id into v_allocation_id;

  insert into public.reward_inventory_adjustments (
    reward_id,
    campaign_id,
    batch_label,
    partner_reference,
    delta,
    reason,
    created_by,
    available_from,
    expires_at
  )
  values (
    p_reward_id,
    coalesce(p_campaign_id, v_reward.campaign_id),
    nullif(trim(coalesce(p_batch_label, '')), ''),
    nullif(trim(coalesce(p_partner_reference, '')), ''),
    v_quantity,
    coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Admin quantity allocation'),
    v_actor_id,
    p_available_from,
    p_expires_at
  );

  perform public.refresh_reward_quantity_inventory_counts(p_reward_id);

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_quantity_allocated',
    'reward',
    p_reward_id,
    jsonb_build_object(
      'allocationId', v_allocation_id,
      'quantity', v_quantity,
      'campaignId', p_campaign_id,
      'batchLabel', p_batch_label,
      'partnerReference', p_partner_reference,
      'availableFrom', p_available_from,
      'expiresAt', p_expires_at
    )
  );

  return jsonb_build_object(
    'status', 'allocated',
    'rewardId', p_reward_id,
    'allocationId', v_allocation_id,
    'quantity', v_quantity
  );
end;
$$;

create or replace function public.admin_reallocate_reward_inventory(
  p_reward_id text,
  p_from_campaign_id text,
  p_to_campaign_id text,
  p_quantity integer,
  p_available_from timestamptz default null,
  p_expires_at timestamptz default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_quantity integer := greatest(0, coalesce(p_quantity, 0));
  v_item_ids uuid[] := array[]::uuid[];
  v_moved integer := 0;
  v_remaining integer;
  v_take integer;
  v_allocation record;
  v_from_allocation_ids uuid[] := array[]::uuid[];
  v_to_allocation_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  if v_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  if p_from_campaign_id is null or p_to_campaign_id is null or p_from_campaign_id = p_to_campaign_id then
    raise exception 'Choose different source and destination campaigns.';
  end if;

  if p_expires_at is not null and p_available_from is not null and p_expires_at <= p_available_from then
    raise exception 'Expiry must be after available from.';
  end if;

  if not exists (select 1 from public.campaigns where id = p_from_campaign_id) then
    raise exception 'Source campaign not found.';
  end if;

  if not exists (select 1 from public.campaigns where id = p_to_campaign_id) then
    raise exception 'Destination campaign not found.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = p_reward_id
  for update;

  if not found then
    raise exception 'Reward not found.';
  end if;

  if not (
    public.current_user_is_admin()
    or (
      v_reward.organization_id is not null
      and public.current_user_has_organization_role(
        v_reward.organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can reallocate inventory.';
  end if;

  if v_reward.fulfillment_type in ('voucher_code', 'qr_code') then
    select coalesce(array_agg(id), array[]::uuid[])
      into v_item_ids
    from (
      select id
      from public.reward_inventory_items
      where reward_id = p_reward_id
        and campaign_id = p_from_campaign_id
        and status = 'available'
        and (expires_at is null or expires_at > now())
      order by coalesce(available_from, uploaded_at), uploaded_at
      for update skip locked
      limit v_quantity
    ) items;

    v_moved := coalesce(array_length(v_item_ids, 1), 0);

    if v_moved < v_quantity then
      raise exception 'Only % unused item(s) are available to reallocate.', v_moved;
    end if;

    update public.reward_inventory_items
    set campaign_id = p_to_campaign_id,
        available_from = p_available_from,
        expires_at = p_expires_at
    where id = any(v_item_ids);

    perform public.refresh_reward_item_inventory_counts(p_reward_id);
  else
    v_remaining := v_quantity;

    for v_allocation in
      select *
      from public.reward_quantity_allocations
      where reward_id = p_reward_id
        and campaign_id = p_from_campaign_id
        and quantity_available > 0
        and (expires_at is null or expires_at > now())
      order by coalesce(available_from, created_at), created_at
      for update skip locked
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, v_allocation.quantity_available);

      update public.reward_quantity_allocations
      set quantity_available = quantity_available - v_take,
          updated_at = now()
      where id = v_allocation.id;

      v_from_allocation_ids := array_append(v_from_allocation_ids, v_allocation.id);
      v_moved := v_moved + v_take;
      v_remaining := v_remaining - v_take;
    end loop;

    if v_moved < v_quantity then
      raise exception 'Only % unused quantity is available to reallocate.', v_moved;
    end if;

    insert into public.reward_quantity_allocations (
      reward_id,
      campaign_id,
      quantity_total,
      quantity_available,
      available_from,
      expires_at,
      reason,
      created_by,
      allocation_type,
      source_allocation_id
    )
    values (
      p_reward_id,
      p_to_campaign_id,
      v_quantity,
      v_quantity,
      p_available_from,
      p_expires_at,
      coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Inventory reallocation'),
      v_actor_id,
      'reallocation',
      v_from_allocation_ids[1]
    )
    returning id into v_to_allocation_id;

    perform public.refresh_reward_quantity_inventory_counts(p_reward_id);
  end if;

  insert into public.reward_inventory_reallocations (
    reward_id,
    inventory_type,
    from_campaign_id,
    to_campaign_id,
    quantity,
    inventory_item_ids,
    from_quantity_allocation_ids,
    to_quantity_allocation_id,
    available_from,
    expires_at,
    reason,
    created_by
  )
  values (
    p_reward_id,
    case when v_reward.fulfillment_type in ('voucher_code', 'qr_code') then v_reward.fulfillment_type else 'quantity' end,
    p_from_campaign_id,
    p_to_campaign_id,
    v_quantity,
    coalesce(to_jsonb(v_item_ids), '[]'::jsonb),
    coalesce(to_jsonb(v_from_allocation_ids), '[]'::jsonb),
    v_to_allocation_id,
    p_available_from,
    p_expires_at,
    coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Inventory reallocation'),
    v_actor_id
  );

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_inventory_reallocated',
    'reward',
    p_reward_id,
    jsonb_build_object(
      'fromCampaignId', p_from_campaign_id,
      'toCampaignId', p_to_campaign_id,
      'quantity', v_quantity
    )
  );

  return jsonb_build_object(
    'status', 'reallocated',
    'rewardId', p_reward_id,
    'quantity', v_quantity,
    'fromCampaignId', p_from_campaign_id,
    'toCampaignId', p_to_campaign_id
  );
end;
$$;

create or replace function public.admin_create_reward_inventory_batch(
  p_reward_id text,
  p_campaign_id text,
  p_batch_label text,
  p_partner_reference text,
  p_source text,
  p_original_filename text,
  p_available_from timestamptz,
  p_expires_at timestamptz,
  p_total_rows integer,
  p_valid_rows integer,
  p_invalid_rows integer,
  p_duplicate_rows integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_batch_id uuid := gen_random_uuid();
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = p_reward_id;

  if not found then
    raise exception 'Reward not found.';
  end if;

  if not (
    public.current_user_is_admin()
    or (
      v_reward.organization_id is not null
      and public.current_user_has_organization_role(
        v_reward.organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can create inventory batches.';
  end if;

  if v_reward.fulfillment_type not in ('voucher_code', 'qr_code') then
    raise exception 'Inventory batches only support voucher and QR rewards.';
  end if;

  if p_campaign_id is not null and not exists (select 1 from public.campaigns where id = p_campaign_id) then
    raise exception 'Campaign not found.';
  end if;

  insert into public.reward_inventory_batches (
    id,
    reward_id,
    campaign_id,
    item_type,
    batch_label,
    partner_reference,
    source,
    original_filename,
    available_from,
    expires_at,
    status,
    total_rows,
    valid_rows,
    invalid_rows,
    duplicate_rows,
    created_by
  )
  values (
    v_batch_id,
    p_reward_id,
    p_campaign_id,
    v_reward.fulfillment_type,
    nullif(trim(coalesce(p_batch_label, '')), ''),
    nullif(trim(coalesce(p_partner_reference, '')), ''),
    coalesce(nullif(p_source, ''), 'partner'),
    nullif(trim(coalesce(p_original_filename, '')), ''),
    p_available_from,
    p_expires_at,
    'importing',
    greatest(0, coalesce(p_total_rows, 0)),
    greatest(0, coalesce(p_valid_rows, 0)),
    greatest(0, coalesce(p_invalid_rows, 0)),
    greatest(0, coalesce(p_duplicate_rows, 0)),
    v_actor_id
  );

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_inventory_batch_created',
    'reward_inventory_batch',
    v_batch_id::text,
    jsonb_build_object(
      'rewardId', p_reward_id,
      'campaignId', p_campaign_id,
      'totalRows', p_total_rows,
      'validRows', p_valid_rows,
      'invalidRows', p_invalid_rows,
      'duplicateRows', p_duplicate_rows
    )
  );

  return jsonb_build_object('batchId', v_batch_id, 'itemType', v_reward.fulfillment_type);
end;
$$;

create or replace function public.admin_upload_reward_inventory(
  p_reward_id text,
  p_item_type text,
  p_items jsonb,
  p_expires_at timestamptz,
  p_campaign_id text default null,
  p_batch_label text default null,
  p_partner_reference text default null,
  p_available_from timestamptz default null,
  p_batch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_item jsonb;
  v_value text;
  v_row_campaign_id text;
  v_row_available_from timestamptz;
  v_row_expires_at timestamptz;
  v_row_partner_reference text;
  v_count integer := 0;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  if p_item_type not in ('voucher_code', 'qr_code') then
    raise exception 'Inventory upload only supports voucher and QR rewards.';
  end if;

  if p_campaign_id is not null and not exists (select 1 from public.campaigns where id = p_campaign_id) then
    raise exception 'Campaign not found.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = p_reward_id
  for update;

  if not found then
    raise exception 'Reward not found.';
  end if;

  if not (
    public.current_user_is_admin()
    or (
      v_reward.organization_id is not null
      and public.current_user_has_organization_role(
        v_reward.organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can upload reward inventory.';
  end if;

  if v_reward.fulfillment_type <> p_item_type then
    raise exception 'Inventory type must match the reward fulfillment type.';
  end if;

  if p_batch_id is not null
     and not exists (
      select 1
      from public.reward_inventory_batches
      where id = p_batch_id
        and reward_id = p_reward_id
        and item_type = p_item_type
     ) then
    raise exception 'Inventory batch not found.';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_value := nullif(trim(coalesce(v_item ->> 'value', '')), '');
    v_row_campaign_id := coalesce(nullif(v_item ->> 'campaignId', ''), p_campaign_id, v_reward.campaign_id);
    v_row_partner_reference := coalesce(nullif(v_item ->> 'partnerReference', ''), p_partner_reference);
    v_row_available_from := coalesce(nullif(v_item ->> 'availableFrom', '')::timestamptz, p_available_from, now());
    v_row_expires_at := coalesce(nullif(v_item ->> 'expiresAt', '')::timestamptz, p_expires_at);

    if v_row_campaign_id is not null
       and not exists (select 1 from public.campaigns where id = v_row_campaign_id) then
      raise exception 'Campaign not found for inventory row.';
    end if;

    if v_value is not null
       and not exists (
         select 1
         from public.reward_inventory_items
         where reward_id = p_reward_id
           and item_type = p_item_type
           and case
             when p_item_type = 'voucher_code' then payload ->> 'code'
             else payload ->> 'qrPayload'
           end = v_value
       ) then
      insert into public.reward_inventory_items (
        reward_id,
        batch_id,
        campaign_id,
        batch_label,
        partner_reference,
        item_type,
        payload,
        available_from,
        expires_at,
        uploaded_by
      )
      values (
        p_reward_id,
        p_batch_id,
        v_row_campaign_id,
        nullif(trim(coalesce(p_batch_label, '')), ''),
        nullif(trim(coalesce(v_row_partner_reference, '')), ''),
        p_item_type,
        case
          when p_item_type = 'voucher_code' then jsonb_build_object('code', v_value)
          else jsonb_build_object('qrPayload', v_value)
        end,
        v_row_available_from,
        v_row_expires_at,
        v_actor_id
      );

      v_count := v_count + 1;
    end if;
  end loop;

  if v_count = 0 then
    raise exception 'No new inventory items were provided.';
  end if;

  perform public.refresh_reward_item_inventory_counts(p_reward_id);

  if p_batch_id is not null then
    update public.reward_inventory_batches
    set imported_rows = imported_rows + v_count,
        updated_at = now()
    where id = p_batch_id;
  end if;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_inventory_uploaded',
    'reward',
    p_reward_id,
    jsonb_build_object(
      'itemType', p_item_type,
      'count', v_count,
      'batchId', p_batch_id,
      'campaignId', p_campaign_id,
      'batchLabel', p_batch_label,
      'partnerReference', p_partner_reference,
      'availableFrom', p_available_from,
      'expiresAt', p_expires_at
    )
  );

  return jsonb_build_object('status', 'uploaded', 'rewardId', p_reward_id, 'batchId', p_batch_id, 'count', v_count);
end;
$$;

create or replace function public.admin_complete_reward_inventory_batch(
  p_batch_id uuid,
  p_status text default 'completed',
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_batch public.reward_inventory_batches%rowtype;
  v_reward_organization_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_batch
  from public.reward_inventory_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'Inventory batch not found.';
  end if;

  select organization_id
    into v_reward_organization_id
  from public.rewards
  where id = v_batch.reward_id;

  if not (
    public.current_user_is_admin()
    or (
      v_reward_organization_id is not null
      and public.current_user_has_organization_role(
        v_reward_organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can complete inventory batches.';
  end if;

  update public.reward_inventory_batches
  set status = case when p_status in ('completed', 'failed', 'cancelled') then p_status else 'completed' end,
      error_message = p_error_message,
      completed_at = case when p_status = 'completed' then now() else completed_at end,
      updated_at = now()
  where id = p_batch_id;

  return jsonb_build_object('batchId', p_batch_id, 'status', p_status);
end;
$$;

create or replace function public.find_existing_reward_inventory_values(
  p_reward_id text,
  p_item_type text,
  p_values jsonb
)
returns table(value text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select organization_id
    into v_reward_organization_id
  from public.rewards
  where id = p_reward_id;

  if not (
    public.current_user_is_admin()
    or (
      v_reward_organization_id is not null
      and public.current_user_has_organization_role(
        v_reward_organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Admin or organisation manager access required.';
  end if;

  return query
  with requested_values as (
    select distinct trim(requested.raw_value) as requested_value
    from jsonb_array_elements_text(coalesce(p_values, '[]'::jsonb)) as requested(raw_value)
    where trim(requested.raw_value) <> ''
  )
  select requested_values.requested_value
  from requested_values
  where exists (
    select 1
    from public.reward_inventory_items
    where reward_inventory_items.reward_id = p_reward_id
      and reward_inventory_items.item_type = p_item_type
      and case
        when p_item_type = 'voucher_code' then reward_inventory_items.payload ->> 'code'
        else reward_inventory_items.payload ->> 'qrPayload'
      end = requested_values.requested_value
  );
end;
$$;
