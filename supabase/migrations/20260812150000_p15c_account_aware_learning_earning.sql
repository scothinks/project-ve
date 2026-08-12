alter table public.programmes
  add column if not exists default_xp_account_id uuid references public.xp_accounts(id) on delete restrict;

alter table public.enrolments
  add column if not exists xp_account_id uuid references public.xp_accounts(id) on delete restrict;

alter table public.programme_assessments
  add column if not exists xp_account_id uuid references public.xp_accounts(id) on delete restrict;

alter table public.quiz_attempts
  add column if not exists programme_id uuid references public.programmes(id) on delete restrict,
  add column if not exists xp_account_id uuid references public.xp_accounts(id) on delete restrict;

alter table public.user_assessment_attempts
  add column if not exists programme_id uuid references public.programmes(id) on delete restrict,
  add column if not exists xp_account_id uuid references public.xp_accounts(id) on delete restrict;

alter table public.programme_courses
  add column if not exists prior_completion_policy text not null default 'recognize_prior_completion'
  check (prior_completion_policy in ('recognize_prior_completion', 'require_completion_in_context'));

update public.programmes programme
set default_xp_account_id = account.id
from public.xp_accounts account
where account.organization_id = programme.organization_id
  and account.scope = 'organization'
  and account.status = 'active'
  and account.is_default
  and programme.default_xp_account_id is null;

update public.enrolments enrolment
set xp_account_id = programme.default_xp_account_id
from public.programmes programme
where programme.id = enrolment.programme_id
  and enrolment.xp_account_id is null;

update public.programme_assessments programme_assessment
set xp_account_id = programme.default_xp_account_id
from public.programmes programme
where programme.id = programme_assessment.programme_id
  and programme_assessment.xp_account_id is null;

update public.programme_missions programme_mission
set xp_account_id = programme.default_xp_account_id
from public.programmes programme
where programme.id = programme_mission.programme_id
  and programme_mission.xp_account_id is null;

create or replace function private.assert_programme_xp_account(
  p_programme_id uuid,
  p_xp_account_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  select organization_id into v_organization_id
  from public.programmes
  where id = p_programme_id;

  if v_organization_id is null then
    raise exception 'Programme not found.';
  end if;

  if not exists (
    select 1 from public.xp_accounts
    where id = p_xp_account_id
      and scope = 'organization'
      and organization_id = v_organization_id
      and status = 'active'
  ) then
    raise exception 'Programme XP account must be active and owned by the programme organization.';
  end if;
end;
$$;

revoke execute on function private.assert_programme_xp_account(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.resolve_programme_xp_account(
  p_user_id uuid,
  p_programme_id uuid,
  p_context_type text,
  p_context_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  if p_user_id is null or p_programme_id is null then
    raise exception 'Programme learning context is required.';
  end if;

  if not exists (
    select 1 from public.enrolments
    where user_id = p_user_id
      and programme_id = p_programme_id
      and status in ('active', 'completed')
  ) then
    raise exception 'Active programme enrolment is required.' using errcode = '42501';
  end if;

  if p_context_type = 'course' and not exists (
    select 1 from public.programme_courses
    where programme_id = p_programme_id and course_id = p_context_id
  ) then
    raise exception 'Course is not attached to this programme.';
  elsif p_context_type = 'mission' and not exists (
    select 1 from public.programme_missions
    where programme_id = p_programme_id and mission_id = p_context_id
  ) then
    raise exception 'Mission is not attached to this programme.';
  elsif p_context_type = 'assessment' and not exists (
    select 1 from public.programme_assessments
    where programme_id = p_programme_id and assessment_version_id = p_context_id::uuid
  ) then
    raise exception 'Assessment is not attached to this programme.';
  end if;

  select coalesce(
    case when p_context_type = 'mission' then (
      select xp_account_id from public.programme_missions
      where programme_id = p_programme_id and mission_id = p_context_id
    ) end,
    case when p_context_type = 'assessment' then (
      select xp_account_id from public.programme_assessments
      where programme_id = p_programme_id and assessment_version_id = p_context_id::uuid
    ) end,
    (
      select xp_account_id from public.enrolments
      where user_id = p_user_id and programme_id = p_programme_id
        and status in ('active', 'completed')
      order by assigned_at desc limit 1
    ),
    (select default_xp_account_id from public.programmes where id = p_programme_id)
  ) into v_account_id;

  perform private.assert_programme_xp_account(p_programme_id, v_account_id);
  return v_account_id;
end;
$$;

revoke execute on function private.resolve_programme_xp_account(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;

create or replace function private.enforce_programme_xp_account_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'programmes' then
    if new.default_xp_account_id is not null and not exists (
      select 1 from public.xp_accounts
      where id = new.default_xp_account_id
        and scope = 'organization'
        and organization_id = new.organization_id
        and status = 'active'
    ) then
      raise exception 'Programme XP account must be active and owned by the programme organization.';
    end if;
  elsif tg_table_name = 'programme_missions' and new.xp_account_id is not null then
    perform private.assert_programme_xp_account(new.programme_id, new.xp_account_id);
  elsif tg_table_name = 'programme_assessments' and new.xp_account_id is not null then
    perform private.assert_programme_xp_account(new.programme_id, new.xp_account_id);
  elsif tg_table_name = 'enrolments' and new.programme_id is not null and new.xp_account_id is not null then
    perform private.assert_programme_xp_account(new.programme_id, new.xp_account_id);
  end if;
  return new;
end;
$$;

revoke execute on function private.enforce_programme_xp_account_ownership()
  from public, anon, authenticated, service_role;

create or replace function private.assign_programme_default_xp_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.default_xp_account_id is null then
    select id into new.default_xp_account_id
    from public.xp_accounts
    where organization_id = new.organization_id
      and scope = 'organization'
      and status = 'active'
      and is_default;
  end if;
  return new;
end;
$$;

revoke execute on function private.assign_programme_default_xp_account()
  from public, anon, authenticated, service_role;

drop trigger if exists programmes_assign_default_xp_account on public.programmes;
create trigger programmes_assign_default_xp_account
  before insert on public.programmes
  for each row execute function private.assign_programme_default_xp_account();

drop trigger if exists programmes_enforce_xp_account_ownership on public.programmes;
create trigger programmes_enforce_xp_account_ownership
  before insert or update of default_xp_account_id on public.programmes
  for each row execute function private.enforce_programme_xp_account_ownership();

drop trigger if exists programme_missions_enforce_xp_account_ownership on public.programme_missions;
create trigger programme_missions_enforce_xp_account_ownership
  before insert or update of xp_account_id on public.programme_missions
  for each row execute function private.enforce_programme_xp_account_ownership();

drop trigger if exists programme_assessments_enforce_xp_account_ownership on public.programme_assessments;
create trigger programme_assessments_enforce_xp_account_ownership
  before insert or update of xp_account_id on public.programme_assessments
  for each row execute function private.enforce_programme_xp_account_ownership();

drop trigger if exists enrolments_enforce_xp_account_ownership on public.enrolments;
create trigger enrolments_enforce_xp_account_ownership
  before insert or update of xp_account_id on public.enrolments
  for each row execute function private.enforce_programme_xp_account_ownership();

alter function public.start_quiz_attempt(text, text) rename to start_quiz_attempt_legacy;

create function public.start_quiz_attempt(
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
  v_attempt_id uuid;
  v_account_id uuid := '00000000-0000-4000-8000-00000000e001'::uuid;
  v_course_id text;
begin
  if p_programme_id is not null then
    select lesson.course_id into v_course_id
    from public.quizzes quiz
    join public.lessons lesson on lesson.id = quiz.lesson_id
    where quiz.id = p_quiz_id;
    v_account_id := private.resolve_programme_xp_account(v_user_id, p_programme_id, 'course', v_course_id);
  end if;

  v_result := public.start_quiz_attempt_legacy(p_quiz_id, p_lesson_id);
  v_attempt_id := nullif(v_result ->> 'attemptId', '')::uuid;

  if v_attempt_id is not null then
    update public.quiz_attempts
    set programme_id = p_programme_id,
        xp_account_id = v_account_id
    where id = v_attempt_id and user_id = v_user_id;
  end if;

  return v_result || jsonb_build_object('programmeId', p_programme_id, 'xpAccountId', v_account_id);
end;
$$;

revoke execute on function public.start_quiz_attempt_legacy(text, text) from public, anon, authenticated, service_role;
revoke execute on function public.start_quiz_attempt(text, text, uuid) from public, anon;
grant execute on function public.start_quiz_attempt(text, text, uuid) to authenticated;

create function public.start_quiz_attempt(
  p_quiz_id text,
  p_lesson_id text default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.start_quiz_attempt(p_quiz_id, p_lesson_id, null);
$$;

revoke execute on function public.start_quiz_attempt(text, text) from public, anon;
grant execute on function public.start_quiz_attempt(text, text) to authenticated;

alter function public.complete_values_assessment(uuid, jsonb) rename to complete_values_assessment_legacy;

create function public.complete_values_assessment(
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
    v_account_id := private.resolve_programme_xp_account(v_user_id, p_programme_id, 'assessment', p_assessment_version_id::text);
  end if;

  v_result := public.complete_values_assessment_legacy(p_assessment_version_id, p_answers);
  v_attempt_id := nullif(v_result ->> 'attempt_id', '')::uuid;

  if v_attempt_id is not null then
    update public.user_assessment_attempts
    set programme_id = p_programme_id,
        xp_account_id = v_account_id
    where id = v_attempt_id and user_id = v_user_id;

    update public.xp_transactions transaction
    set xp_account_id = v_account_id,
        metadata = transaction.metadata || jsonb_build_object('programmeId', p_programme_id, 'xpAccountId', v_account_id)
    where id = (select xp_transaction_id from public.user_assessment_attempts where id = v_attempt_id)
      and transaction.xp_account_id <> v_account_id;
  end if;

  return v_result || jsonb_build_object('programme_id', p_programme_id, 'xp_account_id', v_account_id);
end;
$$;

revoke execute on function public.complete_values_assessment_legacy(uuid, jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.complete_values_assessment(uuid, jsonb, uuid) from public, anon;
grant execute on function public.complete_values_assessment(uuid, jsonb, uuid) to authenticated;

create function public.complete_values_assessment(
  p_assessment_version_id uuid,
  p_answers jsonb
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.complete_values_assessment(p_assessment_version_id, p_answers, null);
$$;

revoke execute on function public.complete_values_assessment(uuid, jsonb) from public, anon;
grant execute on function public.complete_values_assessment(uuid, jsonb) to authenticated;

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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid := '00000000-0000-4000-8000-00000000e001'::uuid;
  v_attempt_id uuid := nullif(coalesce(p_metadata, '{}'::jsonb) ->> 'attemptId', '')::uuid;
begin
  if v_attempt_id is not null then
    select xp_account_id into v_account_id
    from public.quiz_attempts
    where id = v_attempt_id
      and user_id = p_user_id;

    v_account_id := coalesce(v_account_id, '00000000-0000-4000-8000-00000000e001'::uuid);
  end if;

  return private.post_xp_transaction(
    p_user_id, v_account_id, p_direction, p_amount, p_source_type,
    p_source_id, p_award_scope, p_metadata
  );
end;
$$;

revoke execute on function private.post_xp_transaction(uuid, public.xp_direction, integer, public.xp_source_type, text, text, jsonb)
  from public, anon, authenticated, service_role;

alter function public.grant_mission_award(uuid, text, text, jsonb) rename to grant_mission_award_legacy;

create function public.grant_mission_award(
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
  v_context jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_programme_id uuid := nullif(v_context ->> 'programmeId', '')::uuid;
  v_programme_mission_id text := nullif(v_context ->> 'programmeMissionId', '');
  v_account_id uuid := '00000000-0000-4000-8000-00000000e001'::uuid;
  v_result jsonb;
  v_transaction_id uuid;
begin
  if v_programme_id is not null then
    if v_programme_mission_id is distinct from p_mission_id then
      raise exception 'Programme mission context does not match the mission.';
    end if;

    v_account_id := private.resolve_programme_xp_account(
      p_user_id, v_programme_id, 'mission', p_mission_id
    );

    v_context := (v_context - 'xpAccountId') || jsonb_build_object(
      'organizationId', (select organization_id from public.programmes where id = v_programme_id),
      'programmeId', v_programme_id,
      'programmeMissionId', p_mission_id,
      'xpAccountId', '00000000-0000-4000-8000-00000000e001'::uuid
    );
  end if;

  v_result := public.grant_mission_award_legacy(p_user_id, p_mission_id, p_award_scope, v_context);

  if v_programme_id is not null and v_result ->> 'status' = 'awarded' then
    select xp_transaction_id into v_transaction_id
    from public.mission_awards
    where user_id = p_user_id
      and mission_id = p_mission_id
      and award_scope = p_award_scope;

    if v_transaction_id is not null then
      update public.xp_transactions transaction
      set xp_account_id = v_account_id,
          metadata = transaction.metadata || jsonb_build_object('xpAccountId', v_account_id)
      where id = v_transaction_id
        and xp_account_id <> v_account_id;

      update public.mission_awards
      set xp_account_id = v_account_id,
          organization_id = (select organization_id from public.programmes where id = v_programme_id),
          programme_id = v_programme_id,
          programme_mission_id = p_mission_id
      where user_id = p_user_id
        and mission_id = p_mission_id
        and award_scope = p_award_scope;
    end if;
  end if;

  return v_result || jsonb_build_object('xpAccountId', v_account_id);
end;
$$;

revoke execute on function public.grant_mission_award_legacy(uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.grant_mission_award(uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;

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
  ('public', 'start_quiz_attempt', 'p_quiz_id text, p_lesson_id text, p_programme_id uuid', 'PUBLIC_AUTHENTICATED_SELF', 'Authenticated learner quiz workflow with optional trusted programme context.', 'Requires auth.uid(); programme context is verified against active enrolment and programme course membership.', array['authenticated', 'service_role']),
  ('public', 'complete_values_assessment', 'p_assessment_version_id uuid, p_answers jsonb, p_programme_id uuid', 'PUBLIC_AUTHENTICATED_SELF', 'Authenticated learner assessment workflow with optional trusted programme context.', 'Requires auth.uid(); programme context is verified against active enrolment and attached assessment.', array['authenticated', 'service_role']),
  ('public', 'start_quiz_attempt_legacy', 'p_quiz_id text, p_lesson_id text', 'INTERNAL_HELPER', 'Compatibility implementation called only by the account-aware quiz RPC.', 'No direct client execution; the public wrapper derives identity and validates programme context.', array[]::text[]),
  ('public', 'complete_values_assessment_legacy', 'p_assessment_version_id uuid, p_answers jsonb', 'INTERNAL_HELPER', 'Compatibility implementation called only by the account-aware assessment RPC.', 'No direct client execution; the public wrapper derives identity and validates programme context.', array[]::text[]),
  ('public', 'grant_mission_award_legacy', 'p_user_id uuid, p_mission_id text, p_award_scope text, p_metadata jsonb', 'INTERNAL_HELPER', 'Compatibility implementation called only by the account-aware mission award helper.', 'No direct client execution; the public wrapper resolves the programme account from trusted database state.', array[]::text[])
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
