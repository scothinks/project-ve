create table if not exists public.reward_inventory_batches (
  id uuid primary key default gen_random_uuid(),
  reward_id text not null references public.rewards(id) on delete cascade,
  campaign_id text references public.campaigns(id) on delete set null,
  item_type text not null check (item_type in ('voucher_code', 'qr_code')),
  batch_label text,
  partner_reference text,
  source text not null default 'partner' check (source in ('partner', 'manual', 'internal')),
  original_filename text,
  available_from timestamptz,
  expires_at timestamptz,
  status text not null default 'importing'
    check (status in ('draft', 'validated', 'importing', 'completed', 'failed', 'cancelled')),
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reward_inventory_batches enable row level security;

drop policy if exists "Admins can read reward inventory batches" on public.reward_inventory_batches;
create policy "Admins can read reward inventory batches"
  on public.reward_inventory_batches for select
  using (public.current_user_is_admin());

alter table public.reward_inventory_items
  add column if not exists batch_id uuid references public.reward_inventory_batches(id) on delete set null;

alter table public.reward_inventory_adjustments
  add column if not exists batch_id uuid references public.reward_inventory_batches(id) on delete set null;

create index if not exists reward_inventory_batches_reward_idx
  on public.reward_inventory_batches (reward_id, created_at desc);

create index if not exists reward_inventory_batches_campaign_idx
  on public.reward_inventory_batches (campaign_id, created_at desc);

create index if not exists reward_inventory_items_batch_idx
  on public.reward_inventory_items (batch_id, status);

create or replace function public.find_existing_reward_inventory_values(
  p_reward_id text,
  p_item_type text,
  p_values jsonb
)
returns table(value text)
language sql
security definer
set search_path = public
as $$
  with requested_values as (
    select distinct trim(value::text) as requested_value
    from jsonb_array_elements_text(coalesce(p_values, '[]'::jsonb)) as value
    where trim(value::text) <> ''
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
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can create inventory batches.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = p_reward_id;

  if not found then
    raise exception 'Reward not found.';
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

drop function if exists public.admin_upload_reward_inventory(text, text, jsonb, timestamptz);
drop function if exists public.admin_upload_reward_inventory(text, text, jsonb, timestamptz, text, text, text);
drop function if exists public.admin_upload_reward_inventory(text, text, jsonb, timestamptz, text, text, text, timestamptz);

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
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can upload reward inventory.';
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
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can complete inventory batches.';
  end if;

  select *
    into v_batch
  from public.reward_inventory_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'Inventory batch not found.';
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

grant execute on function public.find_existing_reward_inventory_values(text, text, jsonb) to authenticated;
grant execute on function public.admin_create_reward_inventory_batch(text, text, text, text, text, text, timestamptz, timestamptz, integer, integer, integer, integer) to authenticated;
grant execute on function public.admin_upload_reward_inventory(text, text, jsonb, timestamptz, text, text, text, timestamptz, uuid) to authenticated;
grant execute on function public.admin_complete_reward_inventory_batch(uuid, text, text) to authenticated;
