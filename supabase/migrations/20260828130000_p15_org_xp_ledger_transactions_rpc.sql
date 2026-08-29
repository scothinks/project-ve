-- P15-UI-001: the "Points" workspace needs a real per-organisation ledger.
-- xp_transactions already carries xp_account_id (added in
-- 20260812130000_p15c_xp_account_model.sql), and xp_accounts already carries
-- organization_id/scope — this RPC is the missing piece that lets the admin
-- ledger page query by organisation instead of scanning the global table
-- (which has no organisation-staff RLS policy at all). Mirrors
-- admin_get_xp_account_overview's authorization and account-resolution
-- pattern; for the Platform Catalog pseudo-workspace (p_organization_id is
-- null) it resolves the existing fixed platform-scope account instead, and
-- requires true platform-admin access rather than an organisation role.

create or replace function public.admin_list_xp_account_transactions(
  p_organization_id uuid,
  p_direction text default null,
  p_source_type text default null,
  p_user_ids uuid[] default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_limit integer default 200
)
returns table(
  id uuid,
  user_id uuid,
  amount integer,
  direction public.xp_direction,
  source_type public.xp_source_type,
  source_id text,
  award_scope text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.xp_accounts%rowtype;
begin
  if p_organization_id is null then
    if not public.current_user_is_admin() then
      raise exception 'Platform XP ledger access is required.' using errcode = '42501';
    end if;

    select * into v_account
    from public.xp_accounts
    where scope = 'platform' and is_default
    order by status = 'active' desc
    limit 1;
  else
    if not public.current_user_can_manage_organization(p_organization_id) then
      raise exception 'Organisation XP account access is required.' using errcode = '42501';
    end if;

    select * into v_account
    from public.xp_accounts
    where organization_id = p_organization_id and scope = 'organization' and is_default
    order by status = 'active' desc
    limit 1;
  end if;

  if not found then
    raise exception 'XP account not found.';
  end if;

  return query
  select
    transaction.id,
    transaction.user_id,
    transaction.amount,
    transaction.direction,
    transaction.source_type,
    transaction.source_id,
    transaction.award_scope,
    transaction.metadata,
    transaction.created_at
  from public.xp_transactions transaction
  where transaction.xp_account_id = v_account.id
    and (p_direction is null or transaction.direction = p_direction::public.xp_direction)
    and (p_source_type is null or transaction.source_type = p_source_type::public.xp_source_type)
    and (p_user_ids is null or transaction.user_id = any(p_user_ids))
    and (p_date_from is null or transaction.created_at >= p_date_from)
    and (p_date_to is null or transaction.created_at <= p_date_to)
  order by transaction.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

revoke execute on function public.admin_list_xp_account_transactions(uuid, text, text, uuid[], timestamptz, timestamptz, integer)
  from public, anon;
grant execute on function public.admin_list_xp_account_transactions(uuid, text, text, uuid[], timestamptz, timestamptz, integer)
  to authenticated, service_role;

insert into private.rpc_security_classifications (
  function_schema,
  function_name,
  identity_arguments,
  classification,
  intended_callers,
  authorization_rule,
  execute_roles
)
values (
  'public',
  'admin_list_xp_account_transactions',
  'p_organization_id uuid, p_direction text, p_source_type text, p_user_ids uuid[], p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_limit integer',
  'ADMIN_AUTHENTICATED',
  'Platform admins and organisation owners/admins viewing their Points ledger.',
  'Platform admins may pass a null organisation id to read the platform XP account; otherwise requires current_user_can_manage_organization for the target organisation.',
  array['authenticated', 'service_role']
)
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
