alter table public.xp_settings
  add column if not exists admin_manual_grant_daily_limit integer not null default 500 check (admin_manual_grant_daily_limit >= 0);

update public.xp_settings
set admin_manual_grant_daily_limit = 500
where admin_manual_grant_daily_limit is null;

create or replace function public.admin_manual_xp_grant_status()
returns table (
  local_date date,
  daily_limit integer,
  granted_today integer,
  remaining_today integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_daily_limit integer := 500;
  v_granted_today integer := 0;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_actor_id
      and role = 'admin'
  ) then
    raise exception 'Admin access required.';
  end if;

  select coalesce(admin_manual_grant_daily_limit, 500)
    into v_daily_limit
  from public.xp_settings
  where id = 1;

  select coalesce(sum(amount), 0)
    into v_granted_today
  from public.xp_transactions
  where direction = 'earn'
    and source_type = 'adjustment'
    and source_id = 'admin_user_grant'
    and metadata->>'kind' = 'admin_user_grant'
    and metadata->>'granted_by' = v_actor_id::text
    and (created_at at time zone 'Africa/Lagos')::date = (now() at time zone 'Africa/Lagos')::date;

  return query
  select
    (now() at time zone 'Africa/Lagos')::date,
    v_daily_limit,
    v_granted_today,
    greatest(v_daily_limit - v_granted_today, 0);
end;
$$;

create or replace function public.admin_grant_user_xp(
  p_target_user_id uuid,
  p_amount integer,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text := 'Admin';
  v_local_date date := (now() at time zone 'Africa/Lagos')::date;
  v_daily_limit integer := 500;
  v_granted_today integer := 0;
  v_transaction_id uuid := gen_random_uuid();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_actor_id is null then
    raise exception 'Authentication required.';
  end if;

  select coalesce(display_name, 'Admin')
    into v_actor_name
  from public.profiles
  where id = v_actor_id
    and role = 'admin';

  if not found then
    raise exception 'Admin access required.';
  end if;

  if p_target_user_id is null then
    raise exception 'Choose a user to grant XP.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Grant amount must be greater than 0.';
  end if;

  select coalesce(admin_manual_grant_daily_limit, 500)
    into v_daily_limit
  from public.xp_settings
  where id = 1;

  select coalesce(sum(amount), 0)
    into v_granted_today
  from public.xp_transactions
  where direction = 'earn'
    and source_type = 'adjustment'
    and source_id = 'admin_user_grant'
    and metadata->>'kind' = 'admin_user_grant'
    and metadata->>'granted_by' = v_actor_id::text
    and (created_at at time zone 'Africa/Lagos')::date = v_local_date;

  if v_granted_today + p_amount > v_daily_limit then
    raise exception 'Daily admin grant limit reached. % XP remaining today.', greatest(v_daily_limit - v_granted_today, 0);
  end if;

  update public.profiles
  set xp_balance_cached = xp_balance_cached + p_amount
  where id = p_target_user_id;

  if not found then
    raise exception 'User not found.';
  end if;

  insert into public.xp_transactions (
    id,
    user_id,
    amount,
    direction,
    source_type,
    source_id,
    metadata
  ) values (
    v_transaction_id,
    p_target_user_id,
    p_amount,
    'earn',
    'adjustment',
    'admin_user_grant',
    jsonb_build_object(
      'kind', 'admin_user_grant',
      'granted_by', v_actor_id,
      'granted_by_name', v_actor_name,
      'target_user_id', p_target_user_id,
      'reason', coalesce(v_reason, 'Admin manual grant'),
      'local_date', v_local_date
    )
  );

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_actor_id,
    'admin_user_xp_granted',
    'profile',
    p_target_user_id::text,
    jsonb_build_object(
      'xp_amount', p_amount,
      'reason', coalesce(v_reason, 'Admin manual grant'),
      'xp_transaction_id', v_transaction_id,
      'local_date', v_local_date
    )
  );

  return v_transaction_id;
end;
$$;

grant execute on function public.admin_manual_xp_grant_status() to authenticated;
grant execute on function public.admin_grant_user_xp(uuid, integer, text) to authenticated;
