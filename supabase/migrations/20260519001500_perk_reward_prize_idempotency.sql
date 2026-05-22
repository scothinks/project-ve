do $$
declare
  v_group record;
  v_keeper_id uuid;
  v_duplicate_id uuid;
begin
  for v_group in
    select
      bundle_reward_id,
      source_reward_id
    from public.perk_bundle_prizes
    where prize_type = 'reward'
      and source_reward_id is not null
    group by bundle_reward_id, source_reward_id
    having count(*) > 1
  loop
    select id
      into v_keeper_id
    from public.perk_bundle_prizes
    where bundle_reward_id = v_group.bundle_reward_id
      and source_reward_id = v_group.source_reward_id
      and prize_type = 'reward'
    order by sort_order asc, created_at asc, id asc
    limit 1;

    for v_duplicate_id in
      select id
      from public.perk_bundle_prizes
      where bundle_reward_id = v_group.bundle_reward_id
        and source_reward_id = v_group.source_reward_id
        and prize_type = 'reward'
        and id <> v_keeper_id
    loop
      update public.reward_inventory_items
         set perk_prize_id = v_keeper_id
       where perk_prize_id = v_duplicate_id;

      update public.reward_quantity_allocations
         set perk_prize_id = v_keeper_id
       where perk_prize_id = v_duplicate_id;

      update public.perk_prize_release_buckets
         set prize_id = v_keeper_id
       where prize_id = v_duplicate_id;

      update public.perk_bundle_draws
         set prize_id = v_keeper_id
       where prize_id = v_duplicate_id;

      delete from public.perk_bundle_prizes
       where id = v_duplicate_id;
    end loop;
  end loop;
end;
$$;

create unique index if not exists perk_bundle_prizes_unique_reward_source
  on public.perk_bundle_prizes (bundle_reward_id, source_reward_id)
  where prize_type = 'reward' and source_reward_id is not null;

create or replace function public.admin_upsert_perk_bundle_prize(
  p_prize_id uuid default null,
  p_bundle_reward_id text default null,
  p_prize_type text default null,
  p_source_reward_id text default null,
  p_title text default null,
  p_thumbnail jsonb default '{}'::jsonb,
  p_config jsonb default '{}'::jsonb,
  p_weight integer default 1,
  p_total_win_cap integer default null,
  p_daily_win_cap integer default null,
  p_available_from timestamptz default null,
  p_expires_at timestamptz default null,
  p_sort_order integer default 0,
  p_is_enabled boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_bundle_reward public.rewards%rowtype;
  v_existing public.perk_bundle_prizes%rowtype;
  v_source_reward public.rewards%rowtype;
  v_duplicate public.perk_bundle_prizes%rowtype;
  v_prize_id uuid := coalesce(p_prize_id, gen_random_uuid());
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage perk prizes.';
  end if;

  if p_weight is null or p_weight <= 0 then
    raise exception 'Prize weight must be greater than zero.';
  end if;

  if p_total_win_cap is not null and p_total_win_cap <= 0 then
    raise exception 'Total win cap must be greater than zero.';
  end if;

  if p_daily_win_cap is not null and p_daily_win_cap <= 0 then
    raise exception 'Daily win cap must be greater than zero.';
  end if;

  if p_expires_at is not null and p_available_from is not null and p_expires_at <= p_available_from then
    raise exception 'Prize expiry must be after available from.';
  end if;

  if p_prize_id is not null then
    select * into v_existing
    from public.perk_bundle_prizes
    where id = p_prize_id
    for update;

    if not found then
      raise exception 'Perk prize not found.';
    end if;
  end if;

  select * into v_bundle_reward
  from public.rewards
  where id = coalesce(p_bundle_reward_id, v_existing.bundle_reward_id)
  for update;

  if not found or v_bundle_reward.distribution_mode <> 'perk_bundle' then
    raise exception 'Choose a perk bundle reward first.';
  end if;

  if coalesce(p_prize_type, v_existing.prize_type) not in ('reward', 'native_xp', 'xp_boost') then
    raise exception 'Unsupported perk prize type.';
  end if;

  if coalesce(p_prize_type, v_existing.prize_type) = 'reward' then
    if nullif(trim(coalesce(p_source_reward_id, '')), '') is null then
      raise exception 'Choose a reward prize source.';
    end if;

    select * into v_source_reward
    from public.rewards
    where id = p_source_reward_id
    for update;

    if not found or v_source_reward.fulfillment_type = 'native' or v_source_reward.distribution_mode = 'perk_bundle' then
      raise exception 'Choose a direct reward with real fulfillment.';
    end if;

    select * into v_duplicate
    from public.perk_bundle_prizes
    where bundle_reward_id = v_bundle_reward.id
      and prize_type = 'reward'
      and source_reward_id = p_source_reward_id
      and id <> coalesce(p_prize_id, '00000000-0000-0000-0000-000000000000'::uuid)
    limit 1;

    if found then
      raise exception 'This reward is already in the prize pool.';
    end if;
  else
    if coalesce(p_prize_type, v_existing.prize_type) = 'native_xp'
       and greatest(1, coalesce((p_config ->> 'amount')::integer, 0)) <= 0 then
      raise exception 'Fallback XP must be greater than zero.';
    end if;
  end if;

  insert into public.perk_bundle_prizes (
    id,
    bundle_reward_id,
    prize_type,
    source_reward_id,
    title,
    thumbnail,
    config,
    weight,
    total_win_cap,
    daily_win_cap,
    available_from,
    expires_at,
    sort_order,
    is_enabled
  )
  values (
    v_prize_id,
    v_bundle_reward.id,
    coalesce(p_prize_type, 'native_xp'),
    case when coalesce(p_prize_type, 'native_xp') = 'reward' then p_source_reward_id else null end,
    nullif(trim(coalesce(p_title, '')), ''),
    coalesce(p_thumbnail, '{}'::jsonb),
    coalesce(p_config, '{}'::jsonb),
    greatest(1, coalesce(p_weight, 1)),
    p_total_win_cap,
    p_daily_win_cap,
    p_available_from,
    p_expires_at,
    coalesce(p_sort_order, 0),
    coalesce(p_is_enabled, true)
  )
  on conflict (id) do update
  set prize_type = excluded.prize_type,
      source_reward_id = excluded.source_reward_id,
      title = excluded.title,
      thumbnail = excluded.thumbnail,
      config = excluded.config,
      weight = excluded.weight,
      total_win_cap = excluded.total_win_cap,
      daily_win_cap = excluded.daily_win_cap,
      available_from = excluded.available_from,
      expires_at = excluded.expires_at,
      sort_order = excluded.sort_order,
      is_enabled = excluded.is_enabled,
      updated_at = now();

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    case when p_prize_id is null then 'perk_bundle_prize_created' else 'perk_bundle_prize_updated' end,
    'perk_bundle_prize',
    v_prize_id::text,
    jsonb_build_object(
      'bundleRewardId', v_bundle_reward.id,
      'prizeType', coalesce(p_prize_type, v_existing.prize_type),
      'sourceRewardId', p_source_reward_id
    )
  );

  return jsonb_build_object('status', case when p_prize_id is null then 'created' else 'updated' end, 'prizeId', v_prize_id);
end;
$$;
