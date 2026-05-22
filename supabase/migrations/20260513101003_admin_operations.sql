create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all lesson progress" on public.lesson_progress;
create policy "Admins can read all lesson progress"
  on public.lesson_progress for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all quiz attempts" on public.quiz_attempts;
create policy "Admins can read all quiz attempts"
  on public.quiz_attempts for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all XP transactions" on public.xp_transactions;
create policy "Admins can read all XP transactions"
  on public.xp_transactions for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all missions" on public.missions;
create policy "Admins can read all missions"
  on public.missions for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all mission awards" on public.mission_awards;
create policy "Admins can read all mission awards"
  on public.mission_awards for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all mission proofs" on public.mission_proofs;
create policy "Admins can read all mission proofs"
  on public.mission_proofs for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all referrals" on public.referral_attributions;
create policy "Admins can read all referrals"
  on public.referral_attributions for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all rewards" on public.rewards;
create policy "Admins can read all rewards"
  on public.rewards for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all reward redemptions" on public.reward_redemptions;
create policy "Admins can read all reward redemptions"
  on public.reward_redemptions for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read audit events" on public.audit_events;
create policy "Admins can read audit events"
  on public.audit_events for select
  using (public.current_user_is_admin());

create or replace function public.admin_review_mission_proof_submission(
  p_user_id uuid,
  p_mission_id text,
  p_award_scope text,
  p_status public.review_status,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_required_fields text[];
  v_valid boolean := false;
  v_transaction_id uuid;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can review mission proof.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected.';
  end if;

  select *
    into v_mission
  from public.missions
  where id = p_mission_id
  for update;

  if not found or v_mission.validation_type <> 'proof_upload' then
    raise exception 'Mission proof submission was not found.';
  end if;

  update public.mission_proofs
  set status = p_status,
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      rejection_reason = case when p_status = 'rejected' then nullif(trim(coalesce(p_rejection_reason, '')), '') else null end,
      updated_at = now()
  where user_id = p_user_id
    and mission_id = p_mission_id
    and award_scope = p_award_scope;

  if not found then
    raise exception 'Mission proof submission was not found.';
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
    'mission_proof_' || p_status::text,
    'mission_proof',
    p_user_id::text || ':' || p_mission_id || ':' || p_award_scope,
    jsonb_build_object(
      'userId', p_user_id,
      'missionId', p_mission_id,
      'awardScope', p_award_scope,
      'rejectionReason', p_rejection_reason
    )
  );

  if p_status = 'rejected' then
    return jsonb_build_object('status', 'rejected');
  end if;

  select array_agg(value::text)
    into v_required_fields
    from jsonb_array_elements_text(
      coalesce(v_mission.validation_config -> 'requiredFields', '["text"]'::jsonb)
    ) as value;

  select bool_and(exists (
    select 1
      from public.mission_proofs mp
     where mp.user_id = p_user_id
       and mp.mission_id = p_mission_id
       and mp.award_scope = p_award_scope
       and mp.proof_type::text = required_field
       and mp.status = 'approved'
  ))
    into v_valid
    from unnest(v_required_fields) required_field;

  if not coalesce(v_valid, false) then
    return jsonb_build_object('status', 'approved_pending_required_fields');
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
    p_user_id,
    v_mission.reward_xp,
    'earn',
    'mission',
    v_mission.id,
    'mission:' || v_mission.id || ':' || p_award_scope,
    jsonb_build_object(
      'missionId', v_mission.id,
      'awardScope', p_award_scope,
      'reviewedBy', v_actor_id
    )
  )
  on conflict (user_id, award_scope)
    where direction = 'earn' and award_scope is not null
    do nothing
  returning id into v_transaction_id;

  if v_transaction_id is null then
    return jsonb_build_object('status', 'already_awarded');
  end if;

  insert into public.mission_awards (
    user_id,
    mission_id,
    award_scope,
    xp_transaction_id
  )
  values (
    p_user_id,
    v_mission.id,
    p_award_scope,
    v_transaction_id
  )
  on conflict (user_id, mission_id, award_scope) do nothing;

  perform public.increment_profile_xp(p_user_id, v_mission.reward_xp);

  return jsonb_build_object(
    'status', 'awarded',
    'missionId', v_mission.id,
    'awardScope', p_award_scope,
    'awardedXp', v_mission.reward_xp
  );
end;
$$;
