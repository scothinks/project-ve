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
    or not public.current_user_can_manage_organization_programmes(v_assessment.organization_id)
  then
    raise exception 'Programme manager access required.';
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

create or replace function public.admin_update_organization_assessment_overview(
  p_assessment_version_id uuid,
  p_title text,
  p_slug text,
  p_description text,
  p_introduction_copy text,
  p_completion_copy text,
  p_scoring_config jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment public.assessment_versions%rowtype;
  v_title text := trim(coalesce(p_title, ''));
  v_slug text := public.admin_slugify(coalesce(nullif(trim(coalesce(p_slug, '')), ''), p_title));
  v_scoring_config jsonb := coalesce(p_scoring_config, '{}'::jsonb);
begin
  v_assessment := private.assert_manage_draft_organization_assessment(p_assessment_version_id);

  if v_title = '' then
    raise exception 'Assessment title is required.';
  end if;

  if v_slug = '' then
    v_slug := 'assessment';
  end if;

  if jsonb_typeof(v_scoring_config) <> 'object' then
    raise exception 'Assessment scoring config must be a JSON object.';
  end if;

  if exists (
    select 1
    from public.assessment_versions
    where slug = v_slug
      and id <> p_assessment_version_id
  ) then
    raise exception 'Assessment slug is already in use.';
  end if;

  update public.assessment_versions
  set title = v_title,
      slug = v_slug,
      description = nullif(trim(coalesce(p_description, '')), ''),
      introduction_copy = trim(coalesce(p_introduction_copy, '')),
      completion_copy = trim(coalesce(p_completion_copy, '')),
      scoring_config = v_scoring_config
  where id = p_assessment_version_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'organization_assessment_overview_updated',
    'assessment_version',
    p_assessment_version_id::text,
    jsonb_build_object('organizationId', v_assessment.organization_id)
  );

  return jsonb_build_object('assessmentVersionId', p_assessment_version_id, 'status', 'saved');
end;
$$;

revoke execute on function public.admin_update_organization_assessment_overview(uuid, text, text, text, text, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_update_organization_assessment_overview(uuid, text, text, text, text, text, jsonb)
  to authenticated, service_role;

create or replace function public.admin_upsert_organization_assessment_question(
  p_assessment_version_id uuid,
  p_question_id uuid,
  p_prompt text,
  p_helper_text text,
  p_sort_order integer,
  p_options jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment public.assessment_versions%rowtype;
  v_question_id uuid := coalesce(p_question_id, gen_random_uuid());
  v_prompt text := trim(coalesce(p_prompt, ''));
  v_sort_order integer := greatest(1, coalesce(p_sort_order, 1));
  v_option_count integer := 0;
  v_option record;
  v_weight record;
  v_option_id uuid;
  v_seen_option_ids uuid[] := '{}'::uuid[];
begin
  v_assessment := private.assert_manage_draft_organization_assessment(p_assessment_version_id);

  if v_prompt = '' then
    raise exception 'Question prompt is required.';
  end if;

  if jsonb_typeof(coalesce(p_options, '[]'::jsonb)) <> 'array' then
    raise exception 'Assessment options are invalid.';
  end if;

  select count(*)::integer
    into v_option_count
  from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) option_payload
  where trim(coalesce(option_payload ->> 'label', '')) <> '';

  if v_option_count < 2 then
    raise exception 'Assessment questions require at least two options.';
  end if;

  if p_question_id is not null and not exists (
    select 1
    from public.assessment_questions
    where id = p_question_id
      and assessment_version_id = p_assessment_version_id
  ) then
    raise exception 'Assessment question not found.';
  end if;

  insert into public.assessment_questions (
    id,
    assessment_version_id,
    prompt,
    helper_text,
    question_type,
    sort_order
  )
  values (
    v_question_id,
    p_assessment_version_id,
    v_prompt,
    nullif(trim(coalesce(p_helper_text, '')), ''),
    'single_select',
    v_sort_order
  )
  on conflict (id) do update
    set prompt = excluded.prompt,
        helper_text = excluded.helper_text,
        question_type = excluded.question_type,
        sort_order = excluded.sort_order;

  for v_option in
    select *
    from jsonb_to_recordset(coalesce(p_options, '[]'::jsonb)) as option_input(
      id text,
      label text,
      description text,
      sort_order integer,
      weights jsonb
    )
  loop
    if trim(coalesce(v_option.label, '')) = '' then
      continue;
    end if;

    v_option_id := nullif(trim(coalesce(v_option.id, '')), '')::uuid;
    v_option_id := coalesce(v_option_id, gen_random_uuid());

    if v_option.id is not null and not exists (
      select 1
      from public.assessment_question_options
      where id = v_option_id
        and question_id = v_question_id
    ) then
      raise exception 'Assessment option not found.';
    end if;

    insert into public.assessment_question_options (
      id,
      question_id,
      label,
      description,
      sort_order
    )
    values (
      v_option_id,
      v_question_id,
      trim(v_option.label),
      nullif(trim(coalesce(v_option.description, '')), ''),
      greatest(1, coalesce(v_option.sort_order, 1))
    )
    on conflict (id) do update
      set label = excluded.label,
          description = excluded.description,
          sort_order = excluded.sort_order;

    v_seen_option_ids := array_append(v_seen_option_ids, v_option_id);

    if jsonb_typeof(coalesce(v_option.weights, '{}'::jsonb)) <> 'object' then
      raise exception 'Assessment option weights must be a JSON object.';
    end if;

    delete from public.assessment_option_dimension_weights
    where option_id = v_option_id;

    for v_weight in
      select key as dimension_id, value as weight_value
      from jsonb_each(coalesce(v_option.weights, '{}'::jsonb))
    loop
      if jsonb_typeof(v_weight.weight_value) <> 'number' then
        raise exception 'Assessment option weights must be numeric.';
      end if;

      if not exists (
        select 1
        from public.value_dimensions
        where id = v_weight.dimension_id
          and status = 'active'
      ) then
        raise exception 'Assessment option weights must reference approved Project Ve dimensions.';
      end if;

      if (v_weight.weight_value #>> '{}')::numeric < 0 then
        raise exception 'Assessment option weights cannot be negative.';
      end if;

      if (v_weight.weight_value #>> '{}')::numeric > 0 then
        insert into public.assessment_option_dimension_weights (
          option_id,
          dimension_id,
          weight
        )
        values (
          v_option_id,
          v_weight.dimension_id,
          (v_weight.weight_value #>> '{}')::numeric
        );
      end if;
    end loop;
  end loop;

  delete from public.assessment_question_options
  where question_id = v_question_id
    and not (id = any(v_seen_option_ids));

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'organization_assessment_question_saved',
    'assessment_question',
    v_question_id::text,
    jsonb_build_object('assessmentVersionId', p_assessment_version_id, 'organizationId', v_assessment.organization_id)
  );

  return jsonb_build_object('assessmentVersionId', p_assessment_version_id, 'questionId', v_question_id, 'status', 'saved');
end;
$$;

revoke execute on function public.admin_upsert_organization_assessment_question(uuid, uuid, text, text, integer, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_upsert_organization_assessment_question(uuid, uuid, text, text, integer, jsonb)
  to authenticated, service_role;

create or replace function public.admin_delete_organization_assessment_question(
  p_question_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment_id uuid;
  v_assessment public.assessment_versions%rowtype;
begin
  select assessment_version_id
    into v_assessment_id
  from public.assessment_questions
  where id = p_question_id;

  if v_assessment_id is null then
    raise exception 'Assessment question not found.';
  end if;

  v_assessment := private.assert_manage_draft_organization_assessment(v_assessment_id);

  delete from public.assessment_questions
  where id = p_question_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'organization_assessment_question_deleted',
    'assessment_question',
    p_question_id::text,
    jsonb_build_object('assessmentVersionId', v_assessment_id, 'organizationId', v_assessment.organization_id)
  );

  return jsonb_build_object('assessmentVersionId', v_assessment_id, 'questionId', p_question_id, 'status', 'deleted');
end;
$$;

revoke execute on function public.admin_delete_organization_assessment_question(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_delete_organization_assessment_question(uuid)
  to authenticated, service_role;

create or replace function public.admin_preview_organization_assessment_scoring(
  p_assessment_version_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_average_score numeric := 0;
  v_readiness_level text := 'beginner';
  v_scores jsonb := '[]'::jsonb;
begin
  if not public.current_user_can_read_assessment_version(p_assessment_version_id) then
    raise exception 'Assessment version not found.';
  end if;

  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then
    raise exception 'Assessment preview answers are invalid.';
  end if;

  with submitted_answers as (
    select
      nullif(trim(question_id), '')::uuid as question_id,
      nullif(trim(option_id), '')::uuid as option_id
    from jsonb_to_recordset(coalesce(p_answers, '[]'::jsonb)) as submitted(question_id text, option_id text)
  ),
  assessment_questions as (
    select id
    from public.assessment_questions
    where assessment_version_id = p_assessment_version_id
  ),
  dimensions as (
    select id, label, sort_order
    from public.value_dimensions
    where status = 'active'
  ),
  question_dimension_max as (
    select
      question.id as question_id,
      dimension.id as dimension_id,
      coalesce(max(weight.weight), 0) as max_weight
    from assessment_questions question
    cross join dimensions dimension
    left join public.assessment_question_options option
      on option.question_id = question.id
    left join public.assessment_option_dimension_weights weight
      on weight.option_id = option.id
     and weight.dimension_id = dimension.id
    group by question.id, dimension.id
  ),
  dimension_max as (
    select
      dimension_id,
      sum(max_weight) as max_possible_score
    from question_dimension_max
    group by dimension_id
  ),
  raw_scores as (
    select
      dimension.id as dimension_id,
      coalesce(sum(weight.weight), 0) as raw_score
    from dimensions dimension
    left join submitted_answers answer
      on true
    left join public.assessment_question_options option
      on option.id = answer.option_id
    left join public.assessment_questions question
      on question.id = option.question_id
     and question.assessment_version_id = p_assessment_version_id
    left join public.assessment_option_dimension_weights weight
      on weight.option_id = option.id
     and weight.dimension_id = dimension.id
    where answer.question_id is null
       or question.id = answer.question_id
    group by dimension.id
  ),
  normalized_scores as (
    select
      dimension.id as dimension_id,
      dimension.label,
      dimension.sort_order,
      round(
        case
          when coalesce(dimension_max.max_possible_score, 0) > 0
            then greatest(0::numeric, least(1::numeric, raw_scores.raw_score / dimension_max.max_possible_score))
          else 0::numeric
        end,
        4
      ) as score,
      case
        when coalesce(dimension_max.max_possible_score, 0) > 0 then 1::numeric
        else 0.2::numeric
      end as confidence
    from dimensions dimension
    left join raw_scores on raw_scores.dimension_id = dimension.id
    left join dimension_max on dimension_max.dimension_id = dimension.id
  )
  select
    coalesce(avg(score), 0),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'dimension_id', dimension_id,
          'label', label,
          'score', score,
          'confidence', confidence
        )
        order by sort_order
      ),
      '[]'::jsonb
    )
    into v_average_score, v_scores
  from normalized_scores;

  v_readiness_level := case
    when v_average_score < 0.45 then 'beginner'
    when v_average_score < 0.70 then 'intermediate'
    else 'advanced'
  end;

  return jsonb_build_object(
    'readinessLevel', v_readiness_level,
    'averageScore', round(v_average_score, 4),
    'dimensionScores', v_scores
  );
end;
$$;

revoke execute on function public.admin_preview_organization_assessment_scoring(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_preview_organization_assessment_scoring(uuid, jsonb)
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
values
  (
    'public',
    'admin_update_organization_assessment_overview',
    'p_assessment_version_id uuid, p_title text, p_slug text, p_description text, p_introduction_copy text, p_completion_copy text, p_scoring_config jsonb',
    'ADMIN_AUTHENTICATED',
    'Professional or Enterprise organisation assessment workspace overview editing.',
    'Requires auth.uid(), programme management rights in the owning organisation, Professional-or-higher assessment capability, and draft organisation assessment status.',
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
  ),
  (
    'public',
    'admin_preview_organization_assessment_scoring',
    'p_assessment_version_id uuid, p_answers jsonb',
    'ADMIN_AUTHENTICATED',
    'Assessment workspace scoring preview.',
    'Requires assessment read access and computes non-persistent scoring output from submitted option selections.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
