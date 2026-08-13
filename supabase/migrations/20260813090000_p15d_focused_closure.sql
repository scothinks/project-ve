-- P1.5D focused closure: assessment delivery visibility, contextual XP
-- compatibility, and explicit Enterprise assessment contract.

update public.organization_plans
set entitlements = entitlements || jsonb_build_object('assessment_capability', 'template_adaptation'),
    updated_at = now()
where key = 'enterprise'
  and entitlements ->> 'assessment_capability' = 'custom';

create or replace function public.current_user_can_read_programme(p_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.programmes programme
    where programme.id = p_programme_id
      and (
        public.current_user_can_manage_organization_programmes(programme.organization_id)
        or (
          public.organization_allows_learner_entry(programme.organization_id)
          and (
            public.current_user_has_programme_enrolment(programme.id)
            or public.current_user_has_organization_role(
              programme.organization_id,
              array['content_editor', 'reviewer', 'instructor', 'report_viewer']::public.organization_role_key[]
            )
            or (
              programme.status = 'published'
              and (
                public.current_user_has_organization_role(programme.organization_id, null)
                or exists (
                  select 1
                  from public.enrolments enrolment
                  where enrolment.programme_id = programme.id
                    and enrolment.organization_id = programme.organization_id
                    and enrolment.user_id = auth.uid()
                    and enrolment.status in ('active', 'completed')
                )
              )
            )
          )
        )
      )
  );
$$;

revoke execute on function public.current_user_can_read_programme(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_programme(uuid)
  to anon, authenticated, service_role;

create or replace function public.current_user_can_read_course(p_course_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses course
    where course.id = p_course_id
      and (
        public.current_user_is_admin()
        or (
          public.current_user_has_course_enrolment(course.id)
          and (
            course.organization_id is null
            or public.organization_allows_learner_entry(course.organization_id)
          )
        )
        or (
          course.catalog_scope = 'platform'
          and course.status = 'published'
        )
        or (
          course.organization_id is not null
          and public.organization_allows_learner_entry(course.organization_id)
          and (
            public.current_user_has_organization_role(
              course.organization_id,
              array[
                'organisation_owner',
                'organisation_admin',
                'programme_manager',
                'content_editor',
                'reviewer',
                'instructor',
                'report_viewer'
              ]::public.organization_role_key[]
            )
            or (
              course.status = 'published'
              and (
                public.current_user_has_organization_role(course.organization_id, null)
                or exists (
                  select 1
                  from public.programme_courses programme_course
                  join public.programmes programme
                    on programme.id = programme_course.programme_id
                  join public.enrolments enrolment
                    on enrolment.programme_id = programme.id
                   and enrolment.organization_id = programme.organization_id
                  where programme_course.course_id = course.id
                    and programme.organization_id = course.organization_id
                    and programme.status = 'published'
                    and enrolment.user_id = auth.uid()
                    and enrolment.status in ('active', 'completed')
                )
              )
            )
          )
        )
      )
  );
$$;

revoke execute on function public.current_user_can_read_course(text)
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_course(text)
  to anon, authenticated, service_role;

create or replace function public.current_user_can_read_assessment_version(
  p_assessment_version_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assessment_versions version
    where version.id = p_assessment_version_id
      and (
        (
          version.owner_scope = 'platform'
          and version.status = 'published'
        )
        or public.current_user_is_admin()
        or (
          version.owner_scope = 'organization'
          and version.organization_id is not null
          and (
            (
              version.status = 'published'
              and (
                public.current_user_has_organization_role(version.organization_id, null)
                or exists (
                  select 1
                  from public.programme_assessments programme_assessment
                  join public.programmes programme
                    on programme.id = programme_assessment.programme_id
                  join public.enrolments enrolment
                    on enrolment.programme_id = programme.id
                   and enrolment.organization_id = programme.organization_id
                  where programme_assessment.assessment_version_id = version.id
                    and programme.organization_id = version.organization_id
                    and programme.status <> 'archived'
                    and enrolment.user_id = auth.uid()
                    and enrolment.status in ('active', 'completed')
                )
              )
            )
            or (
              version.status <> 'published'
              and public.current_user_can_manage_organization_programmes(version.organization_id)
            )
          )
        )
      )
  );
$$;

revoke execute on function public.current_user_can_read_assessment_version(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_assessment_version(uuid)
  to anon, authenticated, service_role;

do $$
declare
  v_definition text;
  v_legacy_profile_update constant text := $legacy_update$
      update public.profiles
      set xp = xp + v_assessment.xp_award,
          xp_balance_cached = xp_balance_cached + v_assessment.xp_award
      where id = v_user_id;
$legacy_update$;
begin
  select pg_get_functiondef('public.complete_values_assessment_legacy(uuid,jsonb)'::regprocedure)
    into v_definition;

  if position(v_legacy_profile_update in v_definition) = 0 then
    raise exception 'Could not locate legacy assessment profile XP update.';
  end if;

  v_definition := replace(
    v_definition,
    v_legacy_profile_update,
    $replacement$
      -- Account-aware XP balance projection is handled by the xp_transactions
      -- balance trigger. Organisation-context assessments must not mutate the
      -- platform compatibility profile balance.
      null;
$replacement$
  );

  execute v_definition;
end;
$$;

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
    'public',
    'current_user_can_read_assessment_version',
    'p_assessment_version_id uuid',
    'PUBLIC_AUTHENTICATED_READ',
    'Assessment RLS policies for learner delivery and admin authoring reads.',
    'Published platform assessments are public; published organisation assessments are readable by active organisation members or learners enrolled in an attached programme; drafts are restricted to organisation programme managers and platform admins.',
    array['anon', 'authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
