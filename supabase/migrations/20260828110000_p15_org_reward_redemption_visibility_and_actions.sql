-- P15-UI-001: organisation staff need to see and process redemptions of the
-- rewards their own organisation owns ("claim queue" / "clear organisation
-- responsibility"). Additive read policy, plus authorization edits to the
-- two mutation RPCs that were platform-admin-only. Business logic in both
-- RPCs is unchanged — only the authorization gate moves after the row
-- lookup so it can branch on the owning reward's organisation_id.

drop policy if exists "Organization staff can read organization redemptions" on public.reward_redemptions;
create policy "Organization staff can read organization redemptions"
  on public.reward_redemptions for select
  using (
    exists (
      select 1
      from public.rewards r
      where r.id = coalesce(reward_redemptions.awarded_reward_id, reward_redemptions.reward_id)
        and r.organization_id is not null
        and public.current_user_has_organization_role(
          r.organization_id,
          array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
        )
    )
  );

create or replace function public.admin_mark_reward_redemption_fulfilled(
  p_redemption_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_redemption public.reward_redemptions%rowtype;
  v_inventory_reward_id text;
  v_organization_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_redemption
  from public.reward_redemptions
  where id = p_redemption_id
  for update;

  if not found then
    raise exception 'We could not find this reward redemption.';
  end if;

  select organization_id
    into v_organization_id
  from public.rewards
  where id = coalesce(v_redemption.awarded_reward_id, v_redemption.reward_id);

  if not (
    public.current_user_is_admin()
    or (
      v_organization_id is not null
      and public.current_user_has_organization_role(
        v_organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can fulfill reward redemptions.';
  end if;

  if v_redemption.claim_state in ('refunded', 'cancelled', 'expired') then
    raise exception 'This redemption can no longer be fulfilled.';
  end if;

  update public.reward_redemptions
  set status = 'fulfilled',
      claim_state = 'fulfilled',
      fulfilled_at = coalesce(fulfilled_at, now()),
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      admin_note = nullif(trim(coalesce(p_note, '')), ''),
      user_message = 'This reward has been fulfilled.'
  where id = p_redemption_id;

  update public.reward_inventory_items
  set status = 'redeemed',
      redeemed_at = now()
  where redemption_id = p_redemption_id
    and status = 'reserved';

  v_inventory_reward_id := coalesce(v_redemption.awarded_reward_id, v_redemption.reward_id);
  perform public.refresh_reward_item_inventory_counts(v_inventory_reward_id);

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_redemption_fulfilled',
    'reward_redemption',
    p_redemption_id::text,
    jsonb_build_object('rewardId', v_redemption.reward_id, 'awardedRewardId', v_redemption.awarded_reward_id, 'note', p_note)
  );

  return jsonb_build_object('id', p_redemption_id, 'claimState', 'fulfilled');
end;
$$;

create or replace function public.refund_reward_redemption_legacy(
  p_redemption_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_organization_id uuid;
  v_redemption public.reward_redemptions%rowtype;
  v_refund_transaction_id uuid;
  v_restored_inventory boolean := false;
  v_inventory_reward_id text;
  v_draw public.perk_bundle_draws%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_redemption
  from public.reward_redemptions
  where id = p_redemption_id
  for update;

  if not found then
    raise exception 'We could not find this reward redemption.';
  end if;

  select organization_id
    into v_organization_id
  from public.rewards
  where id = coalesce(v_redemption.awarded_reward_id, v_redemption.reward_id);

  if not (
    public.current_user_is_admin()
    or (
      v_organization_id is not null
      and public.current_user_has_organization_role(
        v_organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can refund reward redemptions.';
  end if;

  if v_redemption.refunded_at is not null or v_redemption.claim_state = 'refunded' then
    return jsonb_build_object('id', p_redemption_id, 'claimState', 'refunded', 'alreadyRefunded', true);
  end if;

  if v_redemption.fulfilled_at is not null then
    raise exception 'Fulfilled rewards cannot be automatically refunded.';
  end if;

  v_inventory_reward_id := coalesce(v_redemption.awarded_reward_id, v_redemption.reward_id);

  if v_redemption.inventory_item_id is not null then
    update public.reward_inventory_items
    set status = case
          when expires_at is not null and expires_at <= now() then 'expired'
          else 'available'
        end,
        redemption_id = null,
        assigned_at = null
    where id = v_redemption.inventory_item_id
      and redemption_id = p_redemption_id
      and status = 'reserved';

    if found then
      v_restored_inventory := true;
      perform public.refresh_reward_item_inventory_counts(v_inventory_reward_id);
    end if;
  elsif v_redemption.quantity_allocation_id is not null then
    update public.reward_quantity_allocations
    set quantity_available = least(quantity_total, quantity_available + 1),
        updated_at = now()
    where id = v_redemption.quantity_allocation_id;

    if found then
      v_restored_inventory := true;
      perform public.refresh_reward_quantity_inventory_counts(v_inventory_reward_id);
    end if;
  end if;

  select *
    into v_draw
  from public.perk_bundle_draws
  where redemption_id = p_redemption_id
  for update;

  if found and v_draw.bundle_quantity_allocation_id is not null then
    update public.reward_quantity_allocations
    set quantity_available = least(quantity_total, quantity_available + 1),
        updated_at = now()
    where id = v_draw.bundle_quantity_allocation_id;

    if found then
      v_restored_inventory := true;
      perform public.refresh_reward_quantity_inventory_counts(v_draw.bundle_reward_id);
    end if;

    update public.perk_bundle_draws
    set award_status = 'refunded'
    where id = v_draw.id;
  end if;

  insert into public.xp_transactions (
    user_id,
    amount,
    direction,
    source_type,
    source_id,
    award_scope,
    metadata
  )
  values (
    v_redemption.user_id,
    coalesce(v_redemption.xp_cost_at_redemption, 0),
    'earn',
    'reward_redemption',
    p_redemption_id::text,
    'reward_refund:' || p_redemption_id::text,
    jsonb_build_object(
      'reason', coalesce(p_reason, 'admin_refund'),
      'inventoryRestored', v_restored_inventory
    )
  )
  returning id into v_refund_transaction_id;

  update public.profiles
  set xp = xp + coalesce(v_redemption.xp_cost_at_redemption, 0),
      xp_balance_cached = xp_balance_cached + coalesce(v_redemption.xp_cost_at_redemption, 0),
      updated_at = now()
  where id = v_redemption.user_id;

  update public.reward_redemptions
  set status = 'cancelled',
      claim_state = 'refunded',
      refunded_at = now(),
      refund_xp_transaction_id = v_refund_transaction_id,
      admin_note = p_reason,
      user_message = 'This reward was refunded. The XP has been returned to your balance.'
  where id = p_redemption_id;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_redemption_refunded',
    'reward_redemption',
    p_redemption_id::text,
    jsonb_build_object(
      'rewardId', v_redemption.reward_id,
      'awardedRewardId', v_redemption.awarded_reward_id,
      'reason', p_reason,
      'inventoryRestored', v_restored_inventory,
      'inventoryItemId', v_redemption.inventory_item_id,
      'quantityAllocationId', v_redemption.quantity_allocation_id
    )
  );

  return jsonb_build_object(
    'id', p_redemption_id,
    'claimState', 'refunded',
    'inventoryRestored', v_restored_inventory,
    'refundXpTransactionId', v_refund_transaction_id
  );
end;
$$;
