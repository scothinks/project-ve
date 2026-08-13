begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, private;

select extensions.plan(32);

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (:'TEST_LEARNER_USER_ID'::uuid, 'authenticated', 'authenticated', 'pgtap-assessment-manager@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('99999999-9999-4999-8999-999999999904'::uuid, 'authenticated', 'authenticated', 'pgtap-assessment-learner@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('99999998-9999-4999-8999-999999999905'::uuid, 'authenticated', 'authenticated', 'pgtap-assessment-content-editor@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('99999997-9999-4999-8999-999999999906'::uuid, 'authenticated', 'authenticated', 'pgtap-assessment-member-learner@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('99999996-9999-4999-8999-999999999907'::uuid, 'authenticated', 'authenticated', 'pgtap-assessment-reviewer@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('99999995-9999-4999-8999-999999999908'::uuid, 'authenticated', 'authenticated', 'pgtap-assessment-report-viewer@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do update set email = excluded.email, updated_at = now();

set local role service_role;

insert into public.profiles (id, display_name, role)
values
  (:'TEST_LEARNER_USER_ID'::uuid, 'P15 Assessment Manager', 'learner'),
  ('99999999-9999-4999-8999-999999999904'::uuid, 'P15 Assessment Learner', 'learner'),
  ('99999998-9999-4999-8999-999999999905'::uuid, 'P15 Assessment Content Editor', 'learner'),
  ('99999997-9999-4999-8999-999999999906'::uuid, 'P15 Assessment Member Learner', 'learner'),
  ('99999996-9999-4999-8999-999999999907'::uuid, 'P15 Assessment Reviewer', 'learner'),
  ('99999995-9999-4999-8999-999999999908'::uuid, 'P15 Assessment Report Viewer', 'learner')
on conflict (id) do update
  set display_name = excluded.display_name,
      role = excluded.role;

insert into public.organizations (slug, name, status, created_by)
values
  ('p15-asmt-starter-org', 'P15 Assessment Starter Org', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('p15-asmt-team-org', 'P15 Assessment Team Org', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('p15-asmt-professional-org', 'P15 Assessment Professional Org', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('p15-asmt-other-org', 'P15 Assessment Other Org', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status;

select id as starter_org_id from public.organizations where slug = 'p15-asmt-starter-org' \gset
select id as team_org_id from public.organizations where slug = 'p15-asmt-team-org' \gset
select id as professional_org_id from public.organizations where slug = 'p15-asmt-professional-org' \gset
select id as other_org_id from public.organizations where slug = 'p15-asmt-other-org' \gset

insert into public.organization_plan_assignments (organization_id, plan_key, billing_status, assigned_by)
values
  (:'starter_org_id'::uuid, 'starter', 'free', :'TEST_ADMIN_USER_ID'::uuid),
  (:'team_org_id'::uuid, 'team', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'professional_org_id'::uuid, 'professional', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'other_org_id'::uuid, 'professional', 'active', :'TEST_ADMIN_USER_ID'::uuid)
on conflict do nothing;

insert into public.organization_memberships (organization_id, user_id, role, status, invited_by)
values
  (:'starter_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'programme_manager', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'team_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'programme_manager', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'professional_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'programme_manager', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'other_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'programme_manager', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'professional_org_id'::uuid, '99999998-9999-4999-8999-999999999905'::uuid, 'content_editor', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'professional_org_id'::uuid, '99999997-9999-4999-8999-999999999906'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'professional_org_id'::uuid, '99999996-9999-4999-8999-999999999907'::uuid, 'reviewer', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'professional_org_id'::uuid, '99999995-9999-4999-8999-999999999908'::uuid, 'report_viewer', 'active', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (organization_id, user_id, role) do update
  set status = excluded.status,
      invited_by = excluded.invited_by;

insert into public.courses (
  id,
  slug,
  title,
  description,
  intended_audience,
  learning_outcomes,
  category,
  level,
  status,
  sort_order,
  estimated_minutes,
  catalog_scope
)
values (
  'course-p15d-assessment-delivery',
  'course-p15d-assessment-delivery',
  'P15D Assessment Delivery Course',
  'Programme course fixture for assessment delivery checks.',
  'Programme learners',
  array['Complete the assessment delivery fixture'],
  'Values Education',
  'beginner',
  'published',
  994,
  5,
  'platform'
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      catalog_scope = excluded.catalog_scope;

insert into public.courses (
  id,
  slug,
  title,
  description,
  intended_audience,
  learning_outcomes,
  category,
  level,
  status,
  sort_order,
  estimated_minutes,
  catalog_scope,
  organization_id
)
values (
  'course-p15d-assessment-delivery-private',
  'course-p15d-assessment-delivery-private',
  'P15D Private Assessment Delivery Course',
  'Organisation-private programme course fixture for assessment delivery checks.',
  'Programme learners',
  array['Complete the private assessment delivery fixture'],
  'Values Education',
  'beginner',
  'published',
  995,
  5,
  'organization_private',
  :'professional_org_id'::uuid
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      catalog_scope = excluded.catalog_scope,
      organization_id = excluded.organization_id;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  format(
    $$
      select public.admin_upsert_programme(
        null,
        %L::uuid,
        'Starter Assessment Programme',
        'starter-assessment-programme',
        'Starter should not attach assessments.',
        'Starter learners',
        'draft',
        null,
        null,
        '{}'::jsonb,
        '{}'::text[],
        '{}'::text[],
        '{}'::text[],
        array['3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001'::uuid]::uuid[]
      )
    $$,
    :'starter_org_id'
  ),
  'P0001',
  'Programme assessments require a Team or higher plan and must use published Project Ve templates or organisation assessments available to this programme.',
  'Starter cannot attach programme assessment checkpoints'
);

select public.admin_upsert_programme(
  null,
  :'team_org_id'::uuid,
  'Team Assessment Programme',
  'team-assessment-programme',
  'Team can use published Project Ve templates.',
  'Team learners',
  'draft',
  null,
  null,
  '{}'::jsonb,
  '{}'::text[],
  '{}'::text[],
  '{}'::text[],
  array['3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001'::uuid]::uuid[]
) as team_programme_result
\gset

select public.admin_update_programme_assessment_delivery(
  (:'team_programme_result'::jsonb ->> 'programmeId')::uuid,
  jsonb_build_object(
    '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001',
    jsonb_build_object(
      'isRequired', false,
      'introductionCopy', 'Team introduction copy',
      'completionCopy', 'Team completion copy',
      'deliveryConfig', jsonb_build_object('previewEnabled', true)
    )
  )
) as team_assessment_delivery_result
\gset

select extensions.ok(
  exists (
    select 1
    from public.programme_assessments
    where programme_id = (:'team_programme_result'::jsonb ->> 'programmeId')::uuid
      and assessment_version_id = '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001'::uuid
      and not is_required
      and introduction_copy = 'Team introduction copy'
      and completion_copy = 'Team completion copy'
  ),
  'Team can attach a published Project Ve template and configure delivery copy'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_create_organization_assessment_revision(
        %L::uuid,
        '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001'::uuid,
        'Team Adapted Assessment',
        'team-adapted-assessment',
        'Team should not adapt.',
        '',
        ''
      )
    $$,
    :'team_org_id'
  ),
  'P0001',
  'Assessment adaptation requires a Professional or higher organization plan.',
  'Team cannot adapt Project Ve assessment templates'
);

select public.admin_create_organization_assessment_revision(
  :'professional_org_id'::uuid,
  '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001'::uuid,
  'Professional Adapted Assessment',
  'professional-adapted-assessment',
  'Professional adaptation fixture.',
  'Professional introduction',
  'Professional completion'
) as professional_revision_result
\gset

select extensions.ok(
  (
    select owner_scope = 'organization'
      and organization_id = :'professional_org_id'::uuid
      and status = 'draft'
      and version_number = 1
    from public.assessment_versions
    where id = (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid
  ),
  'Professional adaptation creates a draft organisation-owned assessment version'
);

select extensions.is(
  (
    select count(*)::integer
    from public.assessment_questions
    where assessment_version_id = (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid
  ),
  (
    select count(*)::integer
    from public.assessment_questions
    where assessment_version_id = '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001'::uuid
  ),
  'Professional adaptation copies the source template questions'
);

select id as dimension_id_one
from public.value_dimensions
where status = 'active'
order by sort_order
limit 1
\gset

select id as dimension_id_two
from public.value_dimensions
where status = 'active'
order by sort_order
offset 1
limit 1
\gset

reset role;
select set_config('request.jwt.claim.sub', '99999998-9999-4999-8999-999999999905', true);
set local role authenticated;

select extensions.ok(
  public.current_user_can_manage_organization_assessments(:'professional_org_id'::uuid)
  and not public.current_user_can_manage_organization_programmes(:'professional_org_id'::uuid),
  'content_editor can manage organisation assessments without gaining generic programme-management rights'
);

select extensions.ok(
  exists (
    select 1
    from public.assessment_versions
    where id = (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid
      and owner_scope = 'organization'
      and status = 'draft'
  )
  and exists (
    select 1
    from public.assessment_questions
    where assessment_version_id = (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid
  ),
  'content_editor can reopen draft organisation assessment content'
);

select public.admin_update_organization_assessment_overview(
  (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid,
  'Professional Adapted Assessment Updated',
  'professional-adapted-assessment-updated',
  'Professional adaptation fixture updated.',
  'Professional introduction updated',
  'Professional completion updated',
  jsonb_build_object('preview', true)
) as professional_overview_result
\gset

select extensions.ok(
  (
    select title = 'Professional Adapted Assessment Updated'
      and slug = 'professional-adapted-assessment-updated'
      and scoring_config = jsonb_build_object('preview', true)
    from public.assessment_versions
    where id = (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid
  ),
  'content_editor can update draft assessment overview and scoring config'
);

reset role;
select set_config('request.jwt.claim.sub', '99999997-9999-4999-8999-999999999906', true);
set local role authenticated;

select extensions.ok(
  not public.current_user_can_manage_organization_assessments(:'professional_org_id'::uuid),
  'learner organisation membership cannot manage organisation assessments'
);

reset role;
select set_config('request.jwt.claim.sub', '99999996-9999-4999-8999-999999999907', true);
set local role authenticated;

select extensions.ok(
  not public.current_user_can_manage_organization_assessments(:'professional_org_id'::uuid),
  'reviewer organisation membership cannot manage organisation assessments'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_update_organization_assessment_overview(
        %L::uuid,
        'Reviewer mutation',
        'reviewer-mutation',
        '',
        '',
        '',
        '{}'::jsonb
      )
    $$,
    :'professional_revision_result'::jsonb ->> 'assessmentVersionId'
  ),
  'P0001',
  'Assessment manager access required.',
  'reviewer cannot execute assessment authoring RPCs'
);

reset role;
select set_config('request.jwt.claim.sub', '99999995-9999-4999-8999-999999999908', true);
set local role authenticated;

select extensions.ok(
  not public.current_user_can_manage_organization_assessments(:'professional_org_id'::uuid),
  'report_viewer organisation membership cannot manage organisation assessments'
);

reset role;
select set_config('request.jwt.claim.sub', '99999998-9999-4999-8999-999999999905', true);
set local role authenticated;

select extensions.throws_ok(
  format(
    $$
      select public.admin_upsert_organization_assessment_question(
        %L::uuid,
        null,
        'Invalid professional scenario',
        '',
        99,
        jsonb_build_array(
          jsonb_build_object('label', 'Option A', 'sort_order', 1, 'weights', jsonb_build_object(%L, -1)),
          jsonb_build_object('label', 'Option B', 'sort_order', 2, 'weights', jsonb_build_object(%L, 0.5))
        )
      )
    $$,
    :'professional_revision_result'::jsonb ->> 'assessmentVersionId',
    :'dimension_id_one',
    :'dimension_id_two'
  ),
  'P0001',
  'Assessment option weights cannot be negative.',
  'draft assessment question editing rejects negative weights'
);

select public.admin_upsert_organization_assessment_question(
  (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid,
  null,
  'Custom professional scenario',
  'Choose the closest response.',
  99,
  jsonb_build_array(
    jsonb_build_object(
      'label',
      'Pause and ask for guidance',
      'description',
      'The learner chooses a cautious option.',
      'sort_order',
      1,
      'weights',
      jsonb_build_object(:'dimension_id_one', 1, :'dimension_id_two', 0.25)
    ),
    jsonb_build_object(
      'label',
      'Move ahead alone',
      'description',
      'The learner acts without support.',
      'sort_order',
      2,
      'weights',
      jsonb_build_object(:'dimension_id_one', 0.1, :'dimension_id_two', 1)
    )
  )
) as professional_question_result
\gset

select extensions.ok(
  (
    select count(*)::integer = 2
    from public.assessment_question_options
    where question_id = (:'professional_question_result'::jsonb ->> 'questionId')::uuid
  )
  and exists (
    select 1
    from public.assessment_question_options option
    join public.assessment_option_dimension_weights weight
      on weight.option_id = option.id
    where option.question_id = (:'professional_question_result'::jsonb ->> 'questionId')::uuid
      and weight.dimension_id = :'dimension_id_one'
      and weight.weight > 0
  ),
  'draft assessment question editing saves accessible options and approved dimension weights'
);

select public.admin_preview_organization_assessment_scoring(
  (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid,
  jsonb_build_array(
    jsonb_build_object(
      'question_id',
      :'professional_question_result'::jsonb ->> 'questionId',
      'option_id',
      (
        select id::text
        from public.assessment_question_options
        where question_id = (:'professional_question_result'::jsonb ->> 'questionId')::uuid
        order by sort_order
        limit 1
      )
    )
  )
) as professional_preview_result
\gset

select extensions.ok(
  (:'professional_preview_result'::jsonb ->> 'readinessLevel') in ('beginner', 'intermediate', 'advanced')
  and jsonb_typeof(:'professional_preview_result'::jsonb -> 'dimensionScores') = 'array',
  'assessment workspace scoring preview returns readiness and dimension scores without persisting an attempt'
);

select public.admin_delete_organization_assessment_question(
  (:'professional_question_result'::jsonb ->> 'questionId')::uuid
) as professional_delete_question_result
\gset

select extensions.ok(
  not exists (
    select 1
    from public.assessment_questions
    where id = (:'professional_question_result'::jsonb ->> 'questionId')::uuid
  ),
  'draft assessment question deletion removes the question before publication'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  format(
    $$
      select public.admin_upsert_programme(
        null,
        %L::uuid,
        'Draft Assessment Programme',
        'draft-assessment-programme',
        'Draft assessments cannot be attached.',
        'Professional learners',
        'draft',
        null,
        null,
        '{}'::jsonb,
        '{}'::text[],
        '{}'::text[],
        '{}'::text[],
        array[%L::uuid]::uuid[]
      )
    $$,
    :'professional_org_id',
    :'professional_revision_result'::jsonb ->> 'assessmentVersionId'
  ),
  'P0001',
  'Programme assessments require a Team or higher plan and must use published Project Ve templates or organisation assessments available to this programme.',
  'Draft organisation assessment versions cannot be attached to programmes'
);

set local role service_role;

update public.assessment_versions
set xp_award = 20
where id = (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid;

reset role;
select set_config('request.jwt.claim.sub', '99999998-9999-4999-8999-999999999905', true);
set local role authenticated;

select public.admin_publish_organization_assessment_version(
  (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid
) as professional_publish_result
\gset

select extensions.is(
  (
    select status
    from public.assessment_versions
    where id = (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid
  ),
  'published',
  'content_editor can publish a ready organisation assessment version'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.admin_upsert_programme(
  null,
  :'professional_org_id'::uuid,
  'Professional Assessment Delivery Programme',
  'professional-assessment-delivery-programme',
  'Professional programme attaches an organisation-owned assessment.',
  'Programme-only learners',
  'published',
  null,
  null,
  '{}'::jsonb,
  array['course-p15d-assessment-delivery-private']::text[],
  '{}'::text[],
  '{}'::text[],
  array[(:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid]::uuid[]
) as professional_programme_result
\gset

set local role service_role;

select id as professional_org_xp_account_id
from public.xp_accounts
where organization_id = :'professional_org_id'::uuid
  and scope = 'organization'
  and is_default
limit 1
\gset

insert into public.enrolments (
  organization_id,
  user_id,
  programme_id,
  assignment_source,
  status,
  xp_account_id
)
values (
  :'professional_org_id'::uuid,
  '99999999-9999-4999-8999-999999999904'::uuid,
  (:'professional_programme_result'::jsonb ->> 'programmeId')::uuid,
  'manual',
  'active',
  :'professional_org_xp_account_id'::uuid
);

insert into public.xp_transactions (
  user_id,
  xp_account_id,
  amount,
  direction,
  source_type,
  source_id,
  award_scope
)
values (
  '99999999-9999-4999-8999-999999999904'::uuid,
  '00000000-0000-4000-8000-00000000e001'::uuid,
  100,
  'earn',
  'adjustment',
  'p15d-public-baseline',
  'p15d-public-baseline'
)
on conflict do nothing;

reset role;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999904', true);
set local role authenticated;

select extensions.ok(
  exists (
    select 1
    from public.assessment_versions
    where id = (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid
      and owner_scope = 'organization'
      and status = 'published'
  )
  and exists (
    select 1
    from public.assessment_questions
    where assessment_version_id = (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid
  ),
  'programme-only learners can read attached published organisation assessment content'
);

select extensions.ok(
  exists (
    select 1
    from public.programme_courses
    where programme_id = (:'professional_programme_result'::jsonb ->> 'programmeId')::uuid
      and course_id = 'course-p15d-assessment-delivery-private'
  ),
  'programme-only learners can read course links for enrolled programmes'
);

select extensions.ok(
  exists (
    select 1
    from public.courses
    where id = 'course-p15d-assessment-delivery-private'
      and catalog_scope = 'organization_private'
      and organization_id = :'professional_org_id'::uuid
  ),
  'programme-only learners can read published organisation courses attached to enrolled programmes'
);

select public.complete_values_assessment(
  (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid,
  (
    select jsonb_agg(
      jsonb_build_object(
        'question_id',
        question.id,
        'option_id',
        (
          select option.id
          from public.assessment_question_options option
          where option.question_id = question.id
          order by option.sort_order
          limit 1
        )
      )
      order by question.sort_order
    )
    from public.assessment_questions question
    where question.assessment_version_id = (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid
  ),
  (:'professional_programme_result'::jsonb ->> 'programmeId')::uuid
) as professional_programme_attempt_result
\gset

select extensions.ok(
  exists (
    select 1
    from public.user_value_profiles
    where user_id = '99999999-9999-4999-8999-999999999904'::uuid
      and context_scope = 'organization'
      and organization_id = :'professional_org_id'::uuid
      and assessment_version_id = (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid
  )
  and not exists (
    select 1
    from public.user_value_profiles
    where user_id = '99999999-9999-4999-8999-999999999904'::uuid
      and context_scope = 'platform'
      and organization_id is null
  ),
  'programme assessment completion writes organisation profile without creating public profile'
);

select extensions.ok(
  (
    select balance_cached = 20
    from public.user_xp_balances
    where user_id = '99999999-9999-4999-8999-999999999904'::uuid
      and xp_account_id = :'professional_org_xp_account_id'::uuid
  )
  and (
    select xp_balance_cached = 100
    from public.profiles
    where id = '99999999-9999-4999-8999-999999999904'::uuid
  ),
  'non-zero organisation assessment awards organisation points without mutating public XP compatibility balance'
);

select extensions.is(
  (
    select entitlements ->> 'assessment_capability'
    from public.organization_plans
    where key = 'enterprise'
  ),
  'template_adaptation',
  'Enterprise assessment capability remains on implemented template adaptation until custom scoring is explicitly delivered'
);

set local role service_role;

select extensions.throws_ok(
  format(
    $$
      update public.assessment_versions
      set title = 'Mutated title'
      where id = %L::uuid
    $$,
    :'professional_revision_result'::jsonb ->> 'assessmentVersionId'
  ),
  'P0001',
  'Published assessment versions are immutable.',
  'published assessment version metadata is immutable'
);

-- PostgreSQL does not support UPDATE ... LIMIT; use a subquery so the immutability trigger is tested.
select extensions.throws_ok(
  format(
    $$
      update public.assessment_questions
      set prompt = 'Mutated prompt'
      where id = (
        select id
        from public.assessment_questions
        where assessment_version_id = %L::uuid
        order by sort_order
        limit 1
      )
    $$,
    :'professional_revision_result'::jsonb ->> 'assessmentVersionId'
  ),
  'P0001',
  'Published assessment versions are immutable.',
  'published assessment question content is immutable'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  format(
    $$
      select public.admin_update_organization_assessment_overview(
        %L::uuid,
        'Published mutation',
        'published-mutation',
        '',
        '',
        '',
        '{}'::jsonb
      )
    $$,
    :'professional_revision_result'::jsonb ->> 'assessmentVersionId'
  ),
  'P0001',
  'Published assessment versions are immutable.',
  'published assessment editor RPCs cannot mutate locked versions'
);

set local role service_role;

insert into public.user_assessment_attempts (
  user_id,
  assessment_version_id,
  status,
  completed_at,
  organization_id
)
values (
  '99999999-9999-4999-8999-999999999904'::uuid,
  (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid,
  'completed',
  now(),
  :'professional_org_id'::uuid
)
returning id as historical_attempt_id
\gset

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.admin_create_organization_assessment_revision(
  :'professional_org_id'::uuid,
  (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid,
  'Professional Adapted Assessment v2',
  'professional-adapted-assessment-v2',
  'Professional revision fixture.',
  'Professional introduction v2',
  'Professional completion v2'
) as professional_second_revision_result
\gset

set local role service_role;

select extensions.ok(
  (
    select version_number = 2
    from public.assessment_versions
    where id = (:'professional_second_revision_result'::jsonb ->> 'assessmentVersionId')::uuid
  )
  and (
    select assessment_version_id = (:'professional_revision_result'::jsonb ->> 'assessmentVersionId')::uuid
    from public.user_assessment_attempts
    where id = :'historical_attempt_id'::uuid
  ),
  'editing a published organisation assessment creates a new draft version and preserves historical attempts'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  format(
    $$
      select public.admin_create_organization_assessment_revision(
        %L::uuid,
        %L::uuid,
        'Cross Tenant Revision',
        'cross-tenant-revision',
        'Other org should not revise this.',
        '',
        ''
      )
    $$,
    :'other_org_id',
    :'professional_revision_result'::jsonb ->> 'assessmentVersionId'
  ),
  'P0001',
  'Organization assessment versions can only be revised by their owning organization.',
  'organisation cannot revise another organisation assessment version'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_upsert_programme(
        null,
        %L::uuid,
        'Team Cross Org Assessment Programme',
        'team-cross-org-assessment-programme',
        'Team should not attach another organisation assessment.',
        'Team learners',
        'draft',
        null,
        null,
        '{}'::jsonb,
        '{}'::text[],
        '{}'::text[],
        '{}'::text[],
        array[%L::uuid]::uuid[]
      )
    $$,
    :'team_org_id',
    :'professional_revision_result'::jsonb ->> 'assessmentVersionId'
  ),
  'P0001',
  'Programme assessments require a Team or higher plan and must use published Project Ve templates or organisation assessments available to this programme.',
  'organisation cannot attach another organisation assessment'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select extensions.throws_ok(
  $$ select public.admin_publish_organization_assessment_version('11111111-1111-4111-8111-111111111111'::uuid) $$,
  '42501',
  'permission denied for function admin_publish_organization_assessment_version',
  'anon cannot execute assessment authoring RPCs'
);

reset role;

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'admin_create_organization_assessment_revision'
      and classification = 'ADMIN_AUTHENTICATED'
  )
  and exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'current_user_can_manage_organization_assessments'
      and authorization_rule like '%content_editor%'
  )
  and exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'enforce_published_assessment_immutability'
      and classification = 'TRIGGER_ONLY'
  ),
  'assessment authoring helper, RPC and immutability trigger are classified'
);

select * from extensions.finish();

rollback;
