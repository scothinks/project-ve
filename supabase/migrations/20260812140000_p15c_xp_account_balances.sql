create table public.user_xp_balances (
  user_id uuid not null references public.profiles(id) on delete cascade,
  xp_account_id uuid not null references public.xp_accounts(id) on delete restrict,
  balance_cached integer not null default 0 check (balance_cached >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, xp_account_id)
);

create index user_xp_balances_account_balance_idx
  on public.user_xp_balances(xp_account_id, balance_cached desc);

insert into public.user_xp_balances (
  user_id,
  xp_account_id,
  balance_cached,
  updated_at
)
select
  transaction.user_id,
  transaction.xp_account_id,
  greatest(
    0,
    sum(case when transaction.direction = 'earn' then transaction.amount else -transaction.amount end)
  )::integer,
  max(transaction.created_at)
from public.xp_transactions transaction
group by transaction.user_id, transaction.xp_account_id
on conflict (user_id, xp_account_id) do update
  set balance_cached = excluded.balance_cached,
      updated_at = excluded.updated_at;

insert into public.user_xp_balances (
  user_id,
  xp_account_id,
  balance_cached
)
select
  profile.id,
  '00000000-0000-4000-8000-00000000e001'::uuid,
  0
from public.profiles profile
on conflict (user_id, xp_account_id) do nothing;

alter table public.user_xp_balances enable row level security;

create policy "Users can read their own XP account balances"
  on public.user_xp_balances for select
  using (auth.uid() = user_id);

create or replace function private.ensure_platform_xp_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_xp_balances (
    user_id,
    xp_account_id,
    balance_cached
  )
  values (
    new.id,
    '00000000-0000-4000-8000-00000000e001'::uuid,
    0
  )
  on conflict (user_id, xp_account_id) do nothing;

  return new;
end;
$$;

revoke execute on function private.ensure_platform_xp_balance()
  from public, anon, authenticated, service_role;

drop trigger if exists profiles_ensure_platform_xp_balance on public.profiles;
create trigger profiles_ensure_platform_xp_balance
  after insert on public.profiles
  for each row execute function private.ensure_platform_xp_balance();

create or replace function private.apply_xp_balance_delta(
  p_user_id uuid,
  p_xp_account_id uuid,
  p_delta integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_account_scope public.xp_account_scope;
begin
  if p_user_id is null or p_xp_account_id is null or p_delta is null or p_delta = 0 then
    raise exception 'XP balance mutation is invalid.';
  end if;

  select scope
    into v_account_scope
  from public.xp_accounts
  where id = p_xp_account_id
    and status = 'active'
  for key share;

  if not found then
    raise exception 'XP account is not active.';
  end if;

  if p_delta > 0 then
    insert into public.user_xp_balances (
      user_id,
      xp_account_id,
      balance_cached,
      updated_at
    )
    values (
      p_user_id,
      p_xp_account_id,
      p_delta,
      now()
    )
    on conflict (user_id, xp_account_id) do update
      set balance_cached = public.user_xp_balances.balance_cached + excluded.balance_cached,
          updated_at = excluded.updated_at
    returning balance_cached into v_balance;
  else
    update public.user_xp_balances
       set balance_cached = balance_cached + p_delta,
           updated_at = now()
     where user_id = p_user_id
       and xp_account_id = p_xp_account_id
       and balance_cached >= -p_delta
     returning balance_cached into v_balance;

    if v_balance is null then
      raise exception 'Insufficient XP account balance.';
    end if;
  end if;

  if v_account_scope = 'platform' then
    perform set_config('app.xp_balance_projection', 'on', true);

    update public.profiles
       set xp = v_balance,
           xp_balance_cached = v_balance,
           updated_at = now()
     where id = p_user_id;

    if not found then
      raise exception 'XP profile not found.';
    end if;

    perform set_config('app.xp_balance_projection', '', true);
  end if;
end;
$$;

revoke execute on function private.apply_xp_balance_delta(uuid, uuid, integer)
  from public, anon, authenticated, service_role;

create or replace function private.sync_xp_transaction_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform private.apply_xp_balance_delta(
      new.user_id,
      new.xp_account_id,
      case when new.direction = 'earn' then new.amount else -new.amount end
    );
  elsif tg_op = 'DELETE' then
    perform private.apply_xp_balance_delta(
      old.user_id,
      old.xp_account_id,
      case when old.direction = 'earn' then -old.amount else old.amount end
    );
  else
    perform private.apply_xp_balance_delta(
      old.user_id,
      old.xp_account_id,
      case when old.direction = 'earn' then -old.amount else old.amount end
    );
    perform private.apply_xp_balance_delta(
      new.user_id,
      new.xp_account_id,
      case when new.direction = 'earn' then new.amount else -new.amount end
    );
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function private.sync_xp_transaction_balance()
  from public, anon, authenticated, service_role;

drop trigger if exists xp_transactions_sync_account_balance on public.xp_transactions;
create trigger xp_transactions_sync_account_balance
  after insert or update or delete on public.xp_transactions
  for each row execute function private.sync_xp_transaction_balance();

create or replace function private.prevent_legacy_profile_xp_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform_balance integer;
begin
  if current_setting('app.xp_balance_projection', true) = 'on' then
    return new;
  end if;

  if new.xp is distinct from old.xp
     or new.xp_balance_cached is distinct from old.xp_balance_cached then
    select balance_cached
      into v_platform_balance
    from public.user_xp_balances
    where user_id = old.id
      and xp_account_id = '00000000-0000-4000-8000-00000000e001'::uuid;

    new.xp := coalesce(v_platform_balance, 0);
    new.xp_balance_cached := coalesce(v_platform_balance, 0);
  end if;

  return new;
end;
$$;

revoke execute on function private.prevent_legacy_profile_xp_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists profiles_prevent_legacy_xp_mutation on public.profiles;
create trigger profiles_prevent_legacy_xp_mutation
  before update on public.profiles
  for each row execute function private.prevent_legacy_profile_xp_mutation();

create or replace function private.post_xp_transaction(
  p_user_id uuid,
  p_xp_account_id uuid,
  p_direction public.xp_direction,
  p_amount integer,
  p_source_type public.xp_source_type,
  p_source_id text,
  p_award_scope text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id uuid;
begin
  if p_user_id is null then
    raise exception 'XP user is required.';
  end if;

  if p_xp_account_id is null then
    raise exception 'XP account is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'XP amount must be positive.';
  end if;

  if p_direction is null then
    raise exception 'XP direction is required.';
  end if;

  if p_source_type is null or nullif(trim(coalesce(p_source_id, '')), '') is null then
    raise exception 'XP source is required.';
  end if;

  if p_direction = 'earn' and nullif(trim(coalesce(p_award_scope, '')), '') is not null then
    insert into public.xp_transactions (
      user_id, xp_account_id, amount, direction, source_type, source_id, award_scope, metadata
    ) values (
      p_user_id, p_xp_account_id, p_amount, p_direction, p_source_type, p_source_id,
      p_award_scope, coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (user_id, xp_account_id, award_scope)
      where direction = 'earn' and award_scope is not null
      do nothing
    returning id into v_transaction_id;

    if v_transaction_id is null then
      select id into v_transaction_id
      from public.xp_transactions
      where user_id = p_user_id
        and xp_account_id = p_xp_account_id
        and direction = 'earn'
        and award_scope = p_award_scope;
    end if;
  else
    insert into public.xp_transactions (
      user_id, xp_account_id, amount, direction, source_type, source_id, award_scope, metadata
    ) values (
      p_user_id, p_xp_account_id, p_amount, p_direction, p_source_type, p_source_id,
      p_award_scope, coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_transaction_id;
  end if;

  return v_transaction_id;
end;
$$;

create or replace function private.post_xp_transaction(
  p_user_id uuid,
  p_direction public.xp_direction,
  p_amount integer,
  p_source_type public.xp_source_type,
  p_source_id text,
  p_award_scope text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select private.post_xp_transaction(
    p_user_id,
    '00000000-0000-4000-8000-00000000e001'::uuid,
    p_direction,
    p_amount,
    p_source_type,
    p_source_id,
    p_award_scope,
    p_metadata
  );
$$;

revoke execute on function private.post_xp_transaction(uuid, uuid, public.xp_direction, integer, public.xp_source_type, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function private.post_xp_transaction(uuid, public.xp_direction, integer, public.xp_source_type, text, text, jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.increment_profile_xp(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'XP user is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'XP amount must be positive.';
  end if;

  if not exists (
    select 1
    from public.xp_transactions
    where user_id = p_user_id
      and xp_account_id = '00000000-0000-4000-8000-00000000e001'::uuid
      and direction = 'earn'
      and amount = p_amount
      and created_at = transaction_timestamp()
  ) then
    raise exception 'XP balance updates must be backed by a same-transaction ledger entry.';
  end if;
end;
$$;

revoke execute on function private.increment_profile_xp(uuid, integer)
  from public, anon, authenticated, service_role;

create or replace function public.increment_profile_xp(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    raise exception 'authenticated learner cannot choose an XP amount' using errcode = '42501';
  end if;

  perform private.increment_profile_xp(p_user_id, p_amount);
end;
$$;

revoke execute on function public.increment_profile_xp(uuid, integer) from public, anon, authenticated;
grant execute on function public.increment_profile_xp(uuid, integer) to service_role;

insert into private.rpc_security_classifications (
  function_schema,
  function_name,
  identity_arguments,
  classification,
  intended_callers,
  authorization_rule,
  execute_roles
)
values
  (
    'private',
    'post_xp_transaction',
    'p_user_id uuid, p_xp_account_id uuid, p_direction public.xp_direction, p_amount integer, p_source_type public.xp_source_type, p_source_id text, p_award_scope text, p_metadata jsonb',
    'INTERNAL_HELPER',
    'Trusted database XP workflows only.',
    'The account must be resolved by trusted server-side context; no API role may call this primitive directly.',
    array[]::text[]
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
