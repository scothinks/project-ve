alter table public.xp_accounts
  add column if not exists display_name text,
  add column if not exists display_name_plural text,
  add column if not exists short_label text,
  add column if not exists icon text,
  add column if not exists display_format text not null default 'amount_name'
    check (display_format in ('amount_name', 'amount_short_label'));

update public.xp_accounts
set display_name = coalesce(display_name, case when scope = 'platform' then 'XP' else 'Point' end),
    display_name_plural = coalesce(display_name_plural, case when scope = 'platform' then 'XP' else 'Points' end),
    short_label = coalesce(short_label, case when scope = 'platform' then 'XP' else 'PTS' end),
    icon = coalesce(icon, 'coins');

alter table public.xp_accounts
  alter column display_name set not null,
  alter column display_name_plural set not null,
  alter column short_label set not null,
  alter column icon set not null;

alter table public.xp_accounts
  alter column display_name set default 'Point',
  alter column display_name_plural set default 'Points',
  alter column short_label set default 'PTS',
  alter column icon set default 'coins';

create or replace function public.admin_update_xp_account_presentation(
  p_xp_account_id uuid,
  p_display_name text,
  p_display_name_plural text,
  p_short_label text,
  p_icon text,
  p_display_format text
)
returns public.xp_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.xp_accounts%rowtype;
begin
  select * into v_account from public.xp_accounts where id = p_xp_account_id for update;
  if not found then raise exception 'XP account not found.'; end if;
  if v_account.scope <> 'organization' or not public.current_user_can_manage_organization(v_account.organization_id) then
    raise exception 'Organisation account management access is required.';
  end if;
  if nullif(trim(p_display_name), '') is null or nullif(trim(p_display_name_plural), '') is null or nullif(trim(p_short_label), '') is null then
    raise exception 'XP account labels are required.';
  end if;
  if p_display_format not in ('amount_name', 'amount_short_label') then raise exception 'Unsupported XP account display format.'; end if;

  update public.xp_accounts
  set display_name = left(trim(p_display_name), 80),
      display_name_plural = left(trim(p_display_name_plural), 80),
      short_label = left(trim(p_short_label), 20),
      icon = left(trim(coalesce(p_icon, 'coins')), 80),
      display_format = p_display_format,
      updated_at = now()
  where id = p_xp_account_id
  returning * into v_account;
  return v_account;
end;
$$;

revoke execute on function public.admin_update_xp_account_presentation(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.admin_update_xp_account_presentation(uuid, text, text, text, text, text) to authenticated;

insert into private.rpc_security_classifications (function_schema, function_name, identity_arguments, classification, intended_callers, authorization_rule, execute_roles)
values ('public', 'admin_update_xp_account_presentation', 'p_xp_account_id uuid, p_display_name text, p_display_name_plural text, p_short_label text, p_icon text, p_display_format text', 'ADMIN_AUTHENTICATED', 'Organisation account configuration workflow.', 'Requires an active organisation management role; account ownership and scope cannot be changed.', array['authenticated', 'service_role'])
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification, intended_callers = excluded.intended_callers, authorization_rule = excluded.authorization_rule, execute_roles = excluded.execute_roles, reviewed_at = now();
