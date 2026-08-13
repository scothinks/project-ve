create or replace function public.current_user_can_manage_organization_assessments(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or public.current_user_has_organization_role(
      p_organization_id,
      array[
        'organisation_owner',
        'organisation_admin',
        'programme_manager',
        'content_editor'
      ]::public.organization_role_key[]
    );
$$;

revoke execute on function public.current_user_can_manage_organization_assessments(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_manage_organization_assessments(uuid)
  to authenticated, service_role;

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
              and public.current_user_can_manage_organization_assessments(version.organization_id)
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

create or replace function public.admin_create_organization_assessment_revision(
  p_organization_id uuid,
  p_source_assessment_version_id uuid,
  p_title text,
  p_slug text,
  p_description text,
  p_introduction_copy text,
  p_completion_copy text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_source public.assessment_versions%rowtype;
  v_new_assessment_id uuid := gen_random_uuid();
  v_new_question_id uuid;
  v_new_option_id uuid;
  v_question record;
  v_option record;
  v_title text := trim(coalesce(p_title, ''));
  v_slug text := public.admin_slugify(coalesce(nullif(trim(coalesce(p_slug, '')), ''), p_title));
  v_version_number integer := 1;
begin
  if v_actor_id is null or not public.current_user_can_manage_organization_assessments(p_organization_id) then
    raise exception 'Assessment manager access required.';
  end if;

  if not private.organization_has_assessment_capability_unchecked(p_organization_id, 'template_adaptation') then
    raise exception 'Assessment adaptation requires a Professional or higher organization plan.';
  end if;

  select *
    into v_source
  from public.assessment_versions
  where id = p_source_assessment_version_id
    and status = 'published';

  if not found then
    raise exception 'Source assessment version must be published.';
  end if;

  if v_source.owner_scope = 'organization' and v_source.organization_id <> p_organization_id then
    raise exception 'Organization assessment versions can only be revised by their owning organization.';
  end if;

  if v_title = '' then
    raise exception 'Assessment title is required.';
  end if;

  if v_slug = '' then
    v_slug := 'assessment';
  end if;

  if exists(select 1 from public.assessment_versions where slug = v_slug) then
    raise exception 'Assessment slug is already in use.';
  end if;

  if v_source.owner_scope = 'organization' then
    select coalesce(max(version_number), 0) + 1
      into v_version_number
    from public.assessment_versions
    where owner_scope = 'organization'
      and organization_id = p_organization_id
      and coalesce(source_assessment_version_id, id) = coalesce(v_source.source_assessment_version_id, v_source.id);
  end if;

  insert into public.assessment_versions (
    id,
    slug,
    title,
    description,
    xp_award,
    status,
    owner_scope,
    organization_id,
    source_assessment_version_id,
    version_number,
    introduction_copy,
    completion_copy,
    scoring_config
  )
  values (
    v_new_assessment_id,
    v_slug,
    v_title,
    nullif(trim(coalesce(p_description, '')), ''),
    v_source.xp_award,
    'draft',
    'organization',
    p_organization_id,
    v_source.id,
    v_version_number,
    trim(coalesce(p_introduction_copy, '')),
    trim(coalesce(p_completion_copy, '')),
    coalesce(v_source.scoring_config, '{}'::jsonb)
  );

  for v_question in
    select *
    from public.assessment_questions
    where assessment_version_id = v_source.id
    order by sort_order, id
  loop
    insert into public.assessment_questions (
      assessment_version_id,
      prompt,
      helper_text,
      question_type,
      sort_order
    )
    values (
      v_new_assessment_id,
      v_question.prompt,
      v_question.helper_text,
      v_question.question_type,
      v_question.sort_order
    )
    returning id into v_new_question_id;

    for v_option in
      select *
      from public.assessment_question_options
      where question_id = v_question.id
      order by sort_order, id
    loop
      insert into public.assessment_question_options (
        question_id,
        label,
        description,
        sort_order
      )
      values (
        v_new_question_id,
        v_option.label,
        v_option.description,
        v_option.sort_order
      )
      returning id into v_new_option_id;

      insert into public.assessment_option_dimension_weights (
        option_id,
        dimension_id,
        weight
      )
      select
        v_new_option_id,
        weight.dimension_id,
        weight.weight
      from public.assessment_option_dimension_weights weight
      where weight.option_id = v_option.id;
    end loop;
  end loop;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_assessment_revision_created',
    'assessment_version',
    v_new_assessment_id::text,
    jsonb_build_object(
      'organizationId', p_organization_id,
      'sourceAssessmentVersionId', v_source.id,
      'versionNumber', v_version_number
    )
  );

  return jsonb_build_object(
    'assessmentVersionId', v_new_assessment_id,
    'status', 'draft',
    'versionNumber', v_version_number
  );
end;
$$;

revoke execute on function public.admin_create_organization_assessment_revision(uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_create_organization_assessment_revision(uuid, uuid, text, text, text, text, text)
  to authenticated, service_role;

create or replace function public.admin_publish_organization_assessment_version(
  p_assessment_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_assessment public.assessment_versions%rowtype;
  v_question_count integer := 0;
begin
  select *
    into v_assessment
  from public.assessment_versions
  where id = p_assessment_version_id;

  if not found then
    raise exception 'Assessment version not found.';
  end if;

  if v_actor_id is null
    or v_assessment.owner_scope <> 'organization'
    or not public.current_user_can_manage_organization_assessments(v_assessment.organization_id)
  then
    raise exception 'Assessment manager access required.';
  end if;

  if not private.organization_has_assessment_capability_unchecked(v_assessment.organization_id, 'template_adaptation') then
    raise exception 'Assessment adaptation requires a Professional or higher organization plan.';
  end if;

  if v_assessment.status <> 'draft' then
    raise exception 'Only draft organization assessment versions can be published.';
  end if;

  select count(*)::integer
    into v_question_count
  from public.assessment_questions
  where assessment_version_id = v_assessment.id;

  if v_question_count = 0 then
    raise exception 'Assessment requires at least one question before publishing.';
  end if;

  if exists (
    select 1
    from public.assessment_questions question
    left join lateral (
      select count(*)::integer as option_count
      from public.assessment_question_options option
      where option.question_id = question.id
    ) options on true
    where question.assessment_version_id = v_assessment.id
      and coalesce(options.option_count, 0) < 2
  ) then
    raise exception 'Every assessment question requires at least two options before publishing.';
  end if;

  update public.assessment_versions
  set status = 'published',
      published_at = coalesce(published_at, now())
  where id = v_assessment.id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_assessment_published',
    'assessment_version',
    v_assessment.id::text,
    jsonb_build_object('organizationId', v_assessment.organization_id)
  );

  return jsonb_build_object('assessmentVersionId', v_assessment.id, 'status', 'published');
end;
$$;

revoke execute on function public.admin_publish_organization_assessment_version(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_publish_organization_assessment_version(uuid)
  to authenticated, service_role;

create or replace function private.assert_manage_draft_organization_assessment(
  p_assessment_version_id uuid
)
returns public.assessment_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_assessment public.assessment_versions%rowtype;
begin
  select *
    into v_assessment
  from public.assessment_versions
  where id = p_assessment_version_id;

  if not found then
    raise exception 'Assessment version not found.';
  end if;

  if v_actor_id is null
    or v_assessment.owner_scope <> 'organization'
    or v_assessment.organization_id is null
    or not public.current_user_can_manage_organization_assessments(v_assessment.organization_id)
  then
    raise exception 'Assessment manager access required.';
  end if;

  if not private.organization_has_assessment_capability_unchecked(v_assessment.organization_id, 'template_adaptation') then
    raise exception 'Assessment editing requires a Professional or higher organization plan.';
  end if;

  if v_assessment.status <> 'draft' then
    raise exception 'Published assessment versions are immutable.';
  end if;

  return v_assessment;
end;
$$;

revoke execute on function private.assert_manage_draft_organization_assessment(uuid)
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
  (
    'public',
    'current_user_can_manage_organization_assessments',
    'p_organization_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app, assessment RLS policies and organisation assessment authoring RPCs checking contextual assessment management rights.',
    'Allows platform admins or active organisation_owner, organisation_admin, programme_manager or content_editor memberships for the requested organization id.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'current_user_can_read_assessment_version',
    'p_assessment_version_id uuid',
    'PUBLIC_AUTHENTICATED_READ',
    'Assessment RLS policies for learner delivery and admin authoring reads.',
    'Published platform assessments are public; published organisation assessments are readable by active organisation members or learners enrolled in an attached programme; drafts are restricted to organisation assessment managers and platform admins.',
    array['anon', 'authenticated', 'service_role']
  ),
  (
    'public',
    'admin_create_organization_assessment_revision',
    'p_organization_id uuid, p_source_assessment_version_id uuid, p_title text, p_slug text, p_description text, p_introduction_copy text, p_completion_copy text',
    'ADMIN_AUTHENTICATED',
    'Professional or Enterprise organisation assessment adaptation workflow.',
    'Requires auth.uid(), assessment management rights in the organisation, Professional-or-higher assessment capability, and a published platform or same-organisation source version.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_publish_organization_assessment_version',
    'p_assessment_version_id uuid',
    'ADMIN_AUTHENTICATED',
    'Professional or Enterprise organisation assessment publish workflow.',
    'Requires auth.uid(), assessment management rights in the owning organisation, Professional-or-higher assessment capability, draft status, and minimum question readiness.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_update_organization_assessment_overview',
    'p_assessment_version_id uuid, p_title text, p_slug text, p_description text, p_introduction_copy text, p_completion_copy text, p_scoring_config jsonb',
    'ADMIN_AUTHENTICATED',
    'Professional or Enterprise organisation assessment workspace overview editing.',
    'Requires auth.uid(), assessment management rights in the owning organisation, Professional-or-higher assessment capability, and draft organisation assessment status.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_upsert_organization_assessment_question',
    'p_assessment_version_id uuid, p_question_id uuid, p_prompt text, p_helper_text text, p_sort_order integer, p_options jsonb',
    'ADMIN_AUTHENTICATED',
    'Professional or Enterprise organisation assessment question and option editing.',
    'Requires draft organisation assessment management rights and validates option count plus approved Project Ve dimension weights.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_delete_organization_assessment_question',
    'p_question_id uuid',
    'ADMIN_AUTHENTICATED',
    'Professional or Enterprise organisation assessment draft question deletion.',
    'Resolves the owning assessment, requires draft organisation assessment management rights, and relies on cascading option and weight deletion.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
