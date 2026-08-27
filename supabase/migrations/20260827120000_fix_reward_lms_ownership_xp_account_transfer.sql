create or replace function public.admin_set_reward_lms_ownership(
  p_reward_id text,
  p_owner_scope public.lms_reward_owner_scope,
  p_organization_id uuid,
  p_sponsored_programme_id uuid,
  p_shared_with_programmes boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_owner_scope public.lms_reward_owner_scope := coalesce(p_owner_scope, 'platform_owned'::public.lms_reward_owner_scope);
  v_organization_id uuid := p_organization_id;
  v_sponsored_programme_id uuid := p_sponsored_programme_id;
  v_xp_account_id uuid;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage reward ownership.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = p_reward_id;

  if not found then
    raise exception 'Reward not found.';
  end if;

  if v_owner_scope = 'platform_owned' then
    v_organization_id := null;
    v_sponsored_programme_id := null;
    v_xp_account_id := '00000000-0000-4000-8000-00000000e001'::uuid;
  elsif v_owner_scope = 'organization_owned' then
    v_sponsored_programme_id := null;
  elsif v_owner_scope = 'programme_sponsored' and v_organization_id is null then
    select programme.organization_id
      into v_organization_id
    from public.programmes programme
    where programme.id = v_sponsored_programme_id;
  end if;

  if v_owner_scope <> 'platform_owned' then
    select account.id
      into v_xp_account_id
    from public.xp_accounts account
    where account.organization_id = v_organization_id
      and account.scope = 'organization'
      and account.is_default
      and account.status = 'active';

    if v_xp_account_id is null then
      raise exception 'Rewards require an active organisation XP account.';
    end if;
  end if;

  update public.rewards
  set owner_scope = v_owner_scope,
      organization_id = v_organization_id,
      sponsored_programme_id = v_sponsored_programme_id,
      xp_account_id = v_xp_account_id,
      shared_with_programmes = case
        when v_owner_scope = 'platform_owned'
          then coalesce(p_shared_with_programmes, false)
        else false
      end,
      updated_at = now()
  where id = p_reward_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'reward_lms_ownership_updated',
    'reward',
    p_reward_id,
    jsonb_build_object(
      'ownerScope', v_owner_scope,
      'organizationId', v_organization_id,
      'sponsoredProgrammeId', v_sponsored_programme_id,
      'sharedWithProgrammes', coalesce(p_shared_with_programmes, false),
      'xpAccountId', v_xp_account_id
    )
  );

  return jsonb_build_object('rewardId', p_reward_id, 'status', 'saved');
end;
$$;

revoke execute on function public.admin_set_reward_lms_ownership(text, public.lms_reward_owner_scope, uuid, uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_reward_lms_ownership(text, public.lms_reward_owner_scope, uuid, uuid, boolean) to authenticated, service_role;
