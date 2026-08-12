-- P1.5C focused closure: trusted context, insert-time account attribution,
-- contextual redemption, account-aware adjustments, and single-select claims.

create table if not exists public.programme_lesson_page_completions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,
  page_id text not null references public.lesson_pages(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, programme_id, lesson_id, page_id)
);

create index if not exists programme_lesson_page_completions_lookup_idx
  on public.programme_lesson_page_completions(user_id, programme_id, lesson_id);

alter table public.programme_lesson_page_completions enable row level security;

drop policy if exists "Learners and programme staff can read contextual page completions"
  on public.programme_lesson_page_completions;
create policy "Learners and programme staff can read contextual page completions"
  on public.programme_lesson_page_completions for select
  using (
    auth.uid() = user_id
    or public.current_user_can_read_programme(programme_id)
  );

revoke insert, update, delete on public.programme_lesson_page_completions
  from anon, authenticated;

create or replace function private.apply_quiz_attempt_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid := nullif(current_setting('app.xp_account_id', true), '')::uuid;
  v_programme_id uuid := nullif(current_setting('app.xp_programme_id', true), '')::uuid;
begin
  if v_account_id is not null then
    new.xp_account_id := v_account_id;
    new.programme_id := v_programme_id;
  end if;
  return new;
end;
$$;

revoke execute on function private.apply_quiz_attempt_context()
  from public, anon, authenticated, service_role;

drop trigger if exists quiz_attempts_apply_context on public.quiz_attempts;
create trigger quiz_attempts_apply_context
  before insert on public.quiz_attempts
  for each row execute function private.apply_quiz_attempt_context();

create or replace function private.apply_xp_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid := nullif(current_setting('app.xp_account_id', true), '')::uuid;
  v_programme_id uuid := nullif(current_setting('app.xp_programme_id', true), '')::uuid;
begin
  if v_account_id is not null then
    new.xp_account_id := v_account_id;
    new.metadata := coalesce(new.metadata, '{}'::jsonb)
      || jsonb_build_object('xpAccountId', v_account_id);
    if v_programme_id is not null then
      new.metadata := new.metadata || jsonb_build_object('programmeId', v_programme_id);
      new.programme_id := v_programme_id;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.apply_xp_context()
  from public, anon, authenticated, service_role;

drop trigger if exists xp_transactions_apply_context on public.xp_transactions;
create trigger xp_transactions_apply_context
  before insert on public.xp_transactions
  for each row execute function private.apply_xp_context();

create or replace function public.start_quiz_attempt(
  p_quiz_id text,
  p_lesson_id text,
  p_programme_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_account_id uuid := '00000000-0000-4000-8000-00000000e001'::uuid;
  v_course_id text;
begin
  if p_programme_id is not null then
    select lesson.course_id into v_course_id
    from public.quizzes quiz
    join public.lessons lesson on lesson.id = quiz.lesson_id
    where quiz.id = p_quiz_id;
    v_account_id := private.resolve_programme_xp_account(
      v_user_id, p_programme_id, 'course', v_course_id
    );
    perform set_config('app.xp_account_id', v_account_id::text, true);
    perform set_config('app.xp_programme_id', p_programme_id::text, true);
  end if;

  v_result := public.start_quiz_attempt_legacy(p_quiz_id, p_lesson_id);
  return v_result || jsonb_build_object('programmeId', p_programme_id, 'xpAccountId', v_account_id);
end;
$$;

create or replace function public.complete_values_assessment(
  p_assessment_version_id uuid,
  p_answers jsonb,
  p_programme_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_attempt_id uuid;
  v_account_id uuid := '00000000-0000-4000-8000-00000000e001'::uuid;
begin
  if p_programme_id is not null then
    v_account_id := private.resolve_programme_xp_account(
      v_user_id, p_programme_id, 'assessment', p_assessment_version_id::text
    );
    perform set_config('app.xp_account_id', v_account_id::text, true);
    perform set_config('app.xp_programme_id', p_programme_id::text, true);
  end if;

  begin
    v_result := public.complete_values_assessment_legacy(p_assessment_version_id, p_answers);
  exception when others then
    perform set_config('app.xp_account_id', '', true);
    perform set_config('app.xp_programme_id', '', true);
    raise;
  end;

  v_attempt_id := nullif(v_result ->> 'attempt_id', '')::uuid;
  if v_attempt_id is not null then
    update public.user_assessment_attempts
    set programme_id = p_programme_id,
        xp_account_id = v_account_id
    where id = v_attempt_id and user_id = v_user_id;
  end if;

  perform set_config('app.xp_account_id', '', true);
  perform set_config('app.xp_programme_id', '', true);
  return v_result || jsonb_build_object('programme_id', p_programme_id, 'xp_account_id', v_account_id);
end;
$$;

create or replace function public.grant_mission_award(
  p_user_id uuid,
  p_mission_id text,
  p_award_scope text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
  v_context jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_programme_id uuid := nullif(v_context ->> 'programmeId', '')::uuid;
  v_organization_id uuid := nullif(v_context ->> 'organizationId', '')::uuid;
  v_account_id uuid := nullif(v_context ->> 'xpAccountId', '')::uuid;
  v_transaction_id uuid;
  v_amount integer;
begin
  select * into v_mission from public.missions where id = p_mission_id for update;
  if not found then
    raise exception 'Mission not found.';
  end if;

  if v_programme_id is not null then
    if nullif(v_context ->> 'programmeMissionId', '') is distinct from p_mission_id then
      raise exception 'Programme mission context does not match the mission.';
    end if;
    v_account_id := private.resolve_programme_xp_account(
      p_user_id, v_programme_id, 'mission', p_mission_id
    );
    select organization_id into v_organization_id
    from public.programmes where id = v_programme_id;
  elsif v_organization_id is null and p_award_scope ~ '^organization:[0-9a-fA-F-]{36}:' then
    v_organization_id := split_part(p_award_scope, ':', 2)::uuid;
  end if;

  if v_organization_id is not null and v_programme_id is null then
    if not public.current_user_can_enter_organization(v_organization_id) then
      raise exception 'Organization mission context is not available.' using errcode = '42501';
    end if;
    select id into v_account_id
    from public.xp_accounts
    where organization_id = v_organization_id
      and scope = 'organization' and status = 'active' and is_default;
    if v_account_id is null then
      raise exception 'Organization XP account is not available.';
    end if;
  end if;

  if v_account_id is null then
    return public.grant_mission_award_legacy(p_user_id, p_mission_id, p_award_scope, v_context);
  end if;

  v_context := v_context || jsonb_build_object(
    'organizationId', v_organization_id,
    'programmeId', v_programme_id,
    'programmeMissionId', nullif(v_context ->> 'programmeMissionId', ''),
    'xpAccountId', v_account_id
  );

  if v_mission.reward_type <> 'xp' then
    return public.grant_mission_award_legacy(p_user_id, p_mission_id, p_award_scope, v_context);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    coalesce(p_user_id::text, '') || ':' || p_mission_id || ':' || p_award_scope, 0
  ));

  if exists (
    select 1 from public.mission_awards
    where user_id = p_user_id and mission_id = p_mission_id and award_scope = p_award_scope
  ) then
    return jsonb_build_object('status', 'already_awarded');
  end if;

  v_amount := greatest(1, coalesce(nullif(v_context ->> 'rewardXpOverride', '')::integer, v_mission.reward_xp, 1));
  insert into public.xp_transactions (
    user_id, xp_account_id, amount, direction, source_type, source_id, award_scope, metadata
  ) values (
    p_user_id, v_account_id, v_amount, 'earn', 'mission', v_mission.id,
    'mission:' || v_mission.id || ':' || p_award_scope,
    v_context || jsonb_build_object('missionId', v_mission.id, 'awardScope', p_award_scope, 'awardedXp', v_amount)
  )
  on conflict (user_id, xp_account_id, award_scope) where direction = 'earn' and award_scope is not null
  do nothing
  returning id into v_transaction_id;

  if v_transaction_id is null then
    return jsonb_build_object('status', 'already_awarded');
  end if;

  insert into public.mission_awards (
    user_id, mission_id, award_scope, xp_transaction_id,
    organization_id, programme_id, programme_mission_id, xp_account_id
  ) values (
    p_user_id, p_mission_id, p_award_scope, v_transaction_id,
    v_organization_id, v_programme_id,
    nullif(v_context ->> 'programmeMissionId', ''), v_account_id
  );

  if v_account_id = '00000000-0000-4000-8000-00000000e001'::uuid then
    perform private.increment_profile_xp(p_user_id, v_amount);
  end if;
  return jsonb_build_object(
    'status', 'awarded', 'missionId', p_mission_id, 'awardScope', p_award_scope,
    'rewardType', 'xp', 'awardedXp', v_amount,
    'organizationId', v_organization_id, 'programmeId', v_programme_id,
    'programmeMissionId', nullif(v_context ->> 'programmeMissionId', ''),
    'xpAccountId', v_account_id
  );
end;
$$;

insert into private.rpc_security_classifications (
  function_schema, function_name, identity_arguments, classification,
  intended_callers, authorization_rule, execute_roles
)
values
  (
    'public', 'complete_lesson_page', 'p_lesson_id text, p_page_id text, p_programme_id uuid',
    'PUBLIC_AUTHENTICATED_SELF', 'Authenticated learner contextual lesson progress.',
    'Requires auth.uid(); programme enrolment and course attachment are verified by the trusted resolver.',
    array['authenticated', 'service_role']
  ),
  (
    'public', 'admin_adjust_xp_account', 'p_xp_account_id uuid, p_target_user_id uuid, p_amount integer, p_direction xp_direction, p_reason text',
    'ADMIN_AUTHENTICATED', 'Organisation administrators adjusting an organisation XP account.',
    'Requires a platform admin or organisation owner/admin for the account organisation and an active member target.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();

create or replace function public.complete_lesson_page(
  p_lesson_id text,
  p_page_id text,
  p_programme_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_course_id text;
  v_result jsonb;
begin
  select course_id into v_course_id from public.lessons where id = p_lesson_id;
  if p_programme_id is null then
    return public.complete_lesson_page(p_lesson_id, p_page_id);
  end if;
  perform private.resolve_programme_xp_account(v_user_id, p_programme_id, 'course', v_course_id);
  v_result := public.complete_lesson_page(p_lesson_id, p_page_id);
  insert into public.programme_lesson_page_completions(user_id, programme_id, lesson_id, page_id)
  values (v_user_id, p_programme_id, p_lesson_id, p_page_id)
  on conflict (user_id, programme_id, lesson_id, page_id) do update set completed_at = excluded.completed_at;
  perform public.upsert_programme_completion_for_user(v_user_id, p_programme_id);
  return v_result || jsonb_build_object('programmeId', p_programme_id, 'contextual', true);
end;
$$;

revoke execute on function public.complete_lesson_page(text, text, uuid) from public, anon;
grant execute on function public.complete_lesson_page(text, text, uuid) to authenticated;

create or replace function private.enforce_manual_claim_field_options()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_field jsonb;
  v_value text;
begin
  if new.claim_data is null then return new; end if;
  for v_field in select value from jsonb_array_elements(coalesce(new.fulfillment_config_snapshot -> 'fields', '[]'::jsonb)) loop
    if coalesce(v_field ->> 'type', 'text') = 'select'
       and coalesce(new.claim_data ? (v_field ->> 'id'), false) then
      v_value := trim(coalesce(new.claim_data ->> (v_field ->> 'id'), ''));
      if not exists (
        select 1 from jsonb_array_elements_text(coalesce(v_field -> 'options', '[]'::jsonb)) option_value
        where option_value = v_value
      ) then
        raise exception 'Please choose a valid option for %.', coalesce(v_field ->> 'label', 'this field');
      end if;
    end if;
  end loop;
  return new;
end;
$$;

revoke execute on function private.enforce_manual_claim_field_options() from public, anon, authenticated, service_role;
drop trigger if exists reward_redemptions_validate_claim_options on public.reward_redemptions;
create trigger reward_redemptions_validate_claim_options
  before update of claim_data on public.reward_redemptions
  for each row execute function private.enforce_manual_claim_field_options();

create or replace function private.enforce_xp_account_issuance_controls()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.xp_accounts%rowtype;
  v_period_start timestamptz;
  v_issued_period bigint;
  v_issued_user bigint;
  v_current_exposure numeric(14, 2);
  v_projected_exposure numeric(14, 2);
begin
  if new.direction <> 'earn'
     or (new.source_type = 'reward_redemption' and new.award_scope like 'reward_refund:%') then
    return new;
  end if;
  select * into v_account from public.xp_accounts where id = new.xp_account_id for update;
  if not found or v_account.scope <> 'organization' then return new; end if;
  if new.award_scope is not null and exists (
    select 1 from public.xp_transactions transaction
    where transaction.user_id = new.user_id and transaction.xp_account_id = new.xp_account_id
      and transaction.direction = 'earn' and transaction.award_scope = new.award_scope
  ) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('xp-issuance:' || new.xp_account_id::text, 0));
  v_period_start := now() - make_interval(days => v_account.issuance_period_days);
  select coalesce(sum(amount), 0) into v_issued_period from public.xp_transactions
  where xp_account_id = new.xp_account_id and direction = 'earn' and created_at >= v_period_start;
  if v_account.issuance_cap_per_period is not null and v_issued_period + new.amount > v_account.issuance_cap_per_period then
    raise exception 'XP account period issuance cap reached. % XP remains.', greatest(v_account.issuance_cap_per_period - v_issued_period, 0);
  end if;
  select coalesce(sum(amount), 0) into v_issued_user from public.xp_transactions
  where xp_account_id = new.xp_account_id and user_id = new.user_id and direction = 'earn' and created_at >= v_period_start;
  if v_account.issuance_cap_per_user is not null and v_issued_user + new.amount > v_account.issuance_cap_per_user then
    raise exception 'XP account learner issuance cap reached. % XP remains.', greatest(v_account.issuance_cap_per_user - v_issued_user, 0);
  end if;
  if v_account.exposure_hard_threshold is not null then
    select coalesce(sum(balance_cached), 0) * v_account.accounting_value_per_unit into v_current_exposure
    from public.user_xp_balances where xp_account_id = new.xp_account_id;
    v_projected_exposure := v_current_exposure + new.amount * v_account.accounting_value_per_unit;
    if v_projected_exposure > v_account.exposure_hard_threshold then
      raise exception 'XP account exposure hard threshold reached. Estimated liability is %.', v_current_exposure;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.admin_adjust_xp_account(
  p_xp_account_id uuid,
  p_target_user_id uuid,
  p_amount integer,
  p_direction public.xp_direction,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_account public.xp_accounts%rowtype;
  v_transaction_id uuid;
  v_direction public.xp_direction := p_direction;
  v_source_id text := gen_random_uuid()::text;
begin
  if v_actor_id is null then raise exception 'Authentication is required.'; end if;
  if p_target_user_id is null or p_amount is null or p_amount <= 0 then
    raise exception 'A positive adjustment amount and target learner are required.';
  end if;
  if v_direction not in ('earn', 'spend') then raise exception 'Adjustment direction is invalid.'; end if;

  select * into v_account from public.xp_accounts
  where id = p_xp_account_id and status = 'active' for update;
  if not found or v_account.scope <> 'organization' then
    raise exception 'An active organisation XP account is required.';
  end if;
  if not public.current_user_is_admin()
     and not public.current_user_has_organization_role(
       v_account.organization_id,
       array['organisation_owner', 'organisation_admin']::public.organization_role_key[]
     ) then
    raise exception 'You cannot adjust this organisation XP account.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = v_account.organization_id
      and membership.user_id = p_target_user_id
      and membership.status = 'active'
  ) then
    raise exception 'The target learner is not an active organisation member.';
  end if;

  v_transaction_id := private.post_xp_transaction(
    p_target_user_id,
    v_account.id,
    v_direction,
    p_amount,
    'adjustment',
    v_source_id,
    'admin_adjustment:' || v_source_id,
    jsonb_build_object(
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'organizationId', v_account.organization_id,
      'xpAccountId', v_account.id,
      'adjustedBy', v_actor_id
    )
  );

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id, 'xp_account_adjusted', 'xp_account', v_account.id::text,
    jsonb_build_object(
      'organizationId', v_account.organization_id,
      'targetUserId', p_target_user_id,
      'amount', p_amount,
      'direction', v_direction,
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'transactionId', v_transaction_id
    )
  );

  return jsonb_build_object('transactionId', v_transaction_id, 'xpAccountId', v_account.id);
end;
$$;

revoke execute on function public.admin_adjust_xp_account(uuid, uuid, integer, public.xp_direction, text)
  from public, anon;
grant execute on function public.admin_adjust_xp_account(uuid, uuid, integer, public.xp_direction, text)
  to authenticated;

create or replace function public.refund_reward_redemption(p_redemption_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_result jsonb;
begin
  select xp_account_id into v_account_id from public.reward_redemptions where id = p_redemption_id for update;
  if v_account_id is not null then perform set_config('app.xp_account_id', v_account_id::text, true); end if;
  begin
    v_result := public.refund_reward_redemption_legacy(p_redemption_id, p_reason);
  exception when others then
    perform set_config('app.xp_account_id', '', true);
    raise;
  end;
  perform set_config('app.xp_account_id', '', true);
  return v_result || jsonb_build_object('xpAccountId', coalesce(v_account_id, '00000000-0000-4000-8000-00000000e001'::uuid));
end;
$$;

create or replace function public.redeem_reward(p_reward_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_account_balance integer;
  v_result jsonb;
  v_redemption_id uuid;
  v_temporary_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'You need an account to exchange XP for rewards.';
  end if;
  select * into v_reward from public.rewards where id = p_reward_id for update;
  if not found or not public.current_user_can_access_reward(p_reward_id) then
    raise exception 'This reward is not available right now.';
  end if;
  select balance_cached into v_account_balance
  from public.user_xp_balances
  where user_id = v_user_id and xp_account_id = v_reward.xp_account_id
  for update;
  if coalesce(v_account_balance, 0) < v_reward.cost_xp then
    raise exception 'You need more XP to exchange for this reward.';
  end if;

  if v_reward.xp_account_id <> '00000000-0000-4000-8000-00000000e001'::uuid then
    v_temporary_transaction_id := private.post_xp_transaction(
      v_user_id, '00000000-0000-4000-8000-00000000e001'::uuid,
      'earn', v_reward.cost_xp, 'adjustment', 'reward-account-bridge:' || gen_random_uuid()::text,
      null, jsonb_build_object('internal', true)
    );
    perform set_config('app.xp_account_id', v_reward.xp_account_id::text, true);
  end if;

  begin
    v_result := public.redeem_reward_legacy(p_reward_id);
  exception when others then
    perform set_config('app.xp_account_id', '', true);
    raise;
  end;
  v_redemption_id := (v_result ->> 'id')::uuid;
  perform set_config('app.xp_account_id', '', true);

  if v_temporary_transaction_id is not null then
    delete from public.xp_transactions where id = v_temporary_transaction_id;
  end if;
  update public.reward_redemptions
  set xp_account_id = v_reward.xp_account_id
  where id = v_redemption_id;
  return v_result || jsonb_build_object('xpAccountId', v_reward.xp_account_id);
end;
$$;
