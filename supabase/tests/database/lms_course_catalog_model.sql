begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(22);

set local role service_role;

insert into public.organizations (slug, name, status, created_by)
values ('lms-catalog-alpha', 'LMS Catalog Alpha', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status
returning id as catalog_org_id
\gset

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values (
  :'catalog_org_id'::uuid,
  :'TEST_LEARNER_USER_ID'::uuid,
  'content_editor',
  'active',
  :'TEST_ADMIN_USER_ID'::uuid
)
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
  estimated_minutes
)
values (
  'course-lms-catalog-platform',
  'course-lms-catalog-platform',
  'LMS Catalog Platform Course',
  'A platform source course.',
  'Organisation learners',
  array['Understand platform content'],
  'Values Education',
  'beginner',
  'published',
  900,
  12
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

insert into public.lessons (
  id,
  course_id,
  slug,
  title,
  description,
  status,
  sort_order,
  estimated_minutes
)
values (
  'lesson-lms-catalog-platform',
  'course-lms-catalog-platform',
  'lesson-lms-catalog-platform',
  'Catalog Platform Lesson',
  'A platform lesson.',
  'published',
  1,
  12
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

insert into public.lesson_pages (
  id,
  lesson_id,
  page_number,
  title,
  page_type
)
values (
  'page-lms-catalog-platform',
  'lesson-lms-catalog-platform',
  1,
  'Catalog Platform Page',
  'concept'
)
on conflict (id) do update
  set title = excluded.title;

insert into public.lesson_content_blocks (
  id,
  page_id,
  block_type,
  sort_order,
  payload
)
values (
  '11111111-1300-4000-8000-000000000001'::uuid,
  'page-lms-catalog-platform',
  'text',
  1,
  '{"html":"<p>Platform block</p>"}'::jsonb
)
on conflict (id) do update
  set payload = excluded.payload;

insert into public.quizzes (
  id,
  lesson_id,
  title,
  status
)
values (
  'quiz-lms-catalog-platform',
  'lesson-lms-catalog-platform',
  'Catalog Platform Quiz',
  'published'
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

insert into public.quiz_questions (
  id,
  quiz_id,
  question_order,
  question_type,
  prompt,
  xp
)
values (
  'question-lms-catalog-platform',
  'quiz-lms-catalog-platform',
  1,
  'single_choice',
  'What kind of course is this?',
  5
)
on conflict (id) do update
  set prompt = excluded.prompt;

insert into public.quiz_options (
  id,
  question_id,
  option_order,
  label,
  is_correct
)
values (
  '22222222-1300-4000-8000-000000000001'::uuid,
  'question-lms-catalog-platform',
  1,
  'Platform',
  true
)
on conflict (id) do update
  set label = excluded.label;

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
  'course-lms-catalog-private-published',
  'course-lms-catalog-private-published',
  'LMS Catalog Private Published',
  'A private organisation course.',
  'Organisation learners',
  array['Understand private content'],
  'Values Education',
  'beginner',
  'published',
  901,
  8,
  'organization_private',
  :'catalog_org_id'::uuid
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      organization_id = excluded.organization_id;

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
  'course-lms-catalog-private-draft',
  'course-lms-catalog-private-draft',
  'LMS Catalog Private Draft',
  'A private draft course.',
  'Organisation learners',
  array['Understand draft content'],
  'Values Education',
  'beginner',
  'draft',
  902,
  8,
  'organization_private',
  :'catalog_org_id'::uuid
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      organization_id = excluded.organization_id;

select extensions.is(
  (select catalog_scope from public.courses where id = 'course-lms-catalog-platform'),
  'platform'::public.course_catalog_scope,
  'existing and platform-created courses default to platform catalog scope'
);

select extensions.ok(
  (select organization_id is null and source_course_id is null from public.courses where id = 'course-lms-catalog-platform'),
  'platform courses have no tenant owner or adapted-source provenance'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select extensions.is(
  (select count(*)::integer from public.courses where id = 'course-lms-catalog-platform'),
  1,
  'anon can read published platform courses'
);

select extensions.is(
  (select count(*)::integer from public.courses where id = 'course-lms-catalog-private-published'),
  0,
  'anon cannot read published organisation-private courses'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000cafe', true);
set local role authenticated;

select extensions.is(
  (select count(*)::integer from public.courses where id = 'course-lms-catalog-private-published'),
  0,
  'authenticated non-member cannot read organisation-private courses'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_adapt_platform_course(
        'course-lms-catalog-platform',
        %L::uuid,
        'Unauthorized adapted course'
      )
    $$,
    :'catalog_org_id'
  ),
  'P0001',
  'Organization content editor access required.',
  'authenticated non-member cannot adapt platform courses for an organisation'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.is(
  (select role from public.profiles where id = :'TEST_LEARNER_USER_ID'::uuid),
  'learner',
  'contextual content editor remains a learner at platform level'
);

select extensions.is(
  (select count(*)::integer from public.courses where id = 'course-lms-catalog-private-published'),
  1,
  'active organisation member can read published organisation-private courses'
);

select extensions.is(
  (select count(*)::integer from public.courses where id = 'course-lms-catalog-private-draft'),
  1,
  'organisation content editor can read draft organisation-owned courses'
);

select extensions.is(
  (
    select count(*)::integer
    from public.lesson_content_blocks
    where page_id = 'page-lms-catalog-platform'
  ),
  1,
  'published platform course child content remains readable through catalog-aware policies'
);

select public.admin_create_organization_private_course(
  :'catalog_org_id'::uuid,
  'Content Editor Private Course',
  'Created by an organisation content editor.',
  'Organisation learners',
  array['Create a private course'],
  'Values Education',
  'beginner',
  '{}'::jsonb,
  903,
  6
) as private_course_result
\gset

select extensions.is(
  (
    select catalog_scope
    from public.courses
    where id = (:'private_course_result'::jsonb ->> 'courseId')
  ),
  'organization_private'::public.course_catalog_scope,
  'organisation content editor can create organisation-private draft courses'
);

select public.admin_adapt_platform_course(
  'course-lms-catalog-platform',
  :'catalog_org_id'::uuid,
  'Adapted Catalog Course'
) as adapted_course_result
\gset

select extensions.is(
  (
    select catalog_scope
    from public.courses
    where id = (:'adapted_course_result'::jsonb ->> 'courseId')
  ),
  'adapted_platform'::public.course_catalog_scope,
  'organisation content editor can create an adapted platform course'
);

select extensions.ok(
  (
    select organization_id = :'catalog_org_id'::uuid
      and source_course_id = 'course-lms-catalog-platform'
      and source_catalog_version = (:'adapted_course_result'::jsonb ->> 'sourceCatalogVersion')::integer
      and copied_at is not null
      and upstream_update_available = false
    from public.courses
    where id = (:'adapted_course_result'::jsonb ->> 'courseId')
  ),
  'adapted platform course retains organization ownership and source provenance'
);

select extensions.is(
  (
    select count(*)::integer
    from public.lessons
    where course_id = (:'adapted_course_result'::jsonb ->> 'courseId')
  ),
  1,
  'adapted platform course copies lessons into an independent course tree'
);

select extensions.is(
  (
    select count(*)::integer
    from public.quiz_options option
    join public.quiz_questions question
      on question.id = option.question_id
    join public.quizzes quiz
      on quiz.id = question.quiz_id
    join public.lessons lesson
      on lesson.id = quiz.lesson_id
    where lesson.course_id = (:'adapted_course_result'::jsonb ->> 'courseId')
  ),
  1,
  'adapted platform course copies quiz questions and options'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_adapt_platform_course(
        'course-lms-catalog-private-published',
        %L::uuid,
        'Invalid adapted course'
      )
    $$,
    :'catalog_org_id'
  ),
  'P0001',
  'Only canonical platform courses can be adapted.',
  'organisation courses cannot be used as canonical adaptation sources'
);

update public.courses
set title = 'Illicit Platform Edit'
where id = 'course-lms-catalog-platform';

select extensions.is(
  (select title from public.courses where id = 'course-lms-catalog-platform'),
  'LMS Catalog Platform Course',
  'organisation content editor cannot modify canonical platform course rows'
);

update public.courses
set title = 'Adapted Local Edit'
where id = (:'adapted_course_result'::jsonb ->> 'courseId');

select extensions.ok(
  (
    select local_changes ? 'courseMetadataChangedAt'
    from public.courses
    where id = (:'adapted_course_result'::jsonb ->> 'courseId')
  ),
  'editing adapted course metadata records local changes'
);

reset role;
set local role service_role;

update public.courses
set title = 'LMS Catalog Platform Course Updated'
where id = 'course-lms-catalog-platform';

select extensions.ok(
  (
    select upstream_update_available
    from public.courses
    where id = (:'adapted_course_result'::jsonb ->> 'courseId')
  ),
  'adapted course is flagged when source platform version changes'
);

reset role;

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'admin_adapt_platform_course'
      and identity_arguments = 'p_source_course_id text, p_organization_id uuid, p_title text'
      and classification = 'ADMIN_AUTHENTICATED'
  ),
  'adapted course RPC is explicitly classified'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.admin_adapt_platform_course(text, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.admin_adapt_platform_course(text, uuid, text)', 'execute'),
  'adapted course RPC is reachable only by authenticated callers before in-function role checks'
);

select extensions.ok(
  not has_function_privilege('service_role', 'public.enforce_course_catalog_model()', 'execute')
  and not has_function_privilege('authenticated', 'public.enforce_course_catalog_model()', 'execute'),
  'catalog enforcement trigger is not directly executable by API roles'
);

select * from extensions.finish();

rollback;
