begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(17);

insert into auth.users (
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  :'TEST_ADMIN_USER_ID'::uuid,
  'authenticated',
  'authenticated',
  'pgtap-p15-org-content-admin@example.test',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do update
  set email = excluded.email,
      aud = excluded.aud,
      role = excluded.role,
      email_confirmed_at = excluded.email_confirmed_at,
      updated_at = now();

set local role service_role;

insert into public.profiles (
  id,
  display_name,
  xp,
  xp_balance_cached,
  role
)
values (
  :'TEST_ADMIN_USER_ID'::uuid,
  'Local pgTAP P15 Org Content Admin',
  0,
  0,
  'admin'
)
on conflict (id) do update
  set display_name = excluded.display_name,
      xp = excluded.xp,
      xp_balance_cached = excluded.xp_balance_cached,
      role = excluded.role,
      updated_at = now();

insert into public.organizations (id, slug, name, status, created_by)
values
  ('15150600-0000-4000-8000-000000000001'::uuid, 'p15-org-006-starter', 'P15 ORG 006 Starter', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('15150600-0000-4000-8000-000000000002'::uuid, 'p15-org-006-empty-starter', 'P15 ORG 006 Empty Starter', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('15150600-0000-4000-8000-000000000003'::uuid, 'p15-org-006-team', 'P15 ORG 006 Team', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (id) do update
  set slug = excluded.slug,
      name = excluded.name,
      status = excluded.status;

insert into public.organization_plan_assignments (organization_id, plan_key, billing_status, assigned_by)
values (
  '15150600-0000-4000-8000-000000000003'::uuid,
  'team',
  'active',
  :'TEST_ADMIN_USER_ID'::uuid
)
on conflict (organization_id) where ended_at is null do update
  set plan_key = excluded.plan_key,
      billing_status = excluded.billing_status,
      assigned_by = excluded.assigned_by;

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
  'course-p15-org-006-platform-large',
  'course-p15-org-006-platform-large',
  'P15 ORG 006 Platform Large',
  'A platform course with too many lessons for Starter adaptation.',
  'Organisation learners',
  array['Understand content limits'],
  'Values Education',
  'beginner',
  'published',
  9600,
  30
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
select
  'lesson-p15-org-006-platform-' || item.index,
  'course-p15-org-006-platform-large',
  'lesson-p15-org-006-platform-' || item.index,
  'Platform limit lesson ' || item.index,
  'Platform source lesson.',
  'published',
  item.index,
  5
from generate_series(1, 6) as item(index)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select extensions.lives_ok(
  $$
    select public.admin_create_organization_private_course(
      '15150600-0000-4000-8000-000000000001'::uuid,
      'Starter Allowed Course',
      'One allowed Starter course.',
      'Organisation learners',
      array['Create one private course'],
      'Values Education',
      'beginner',
      '{}'::jsonb,
      1,
      10
    )
  $$,
  'Starter can create its first private course through the organization course RPC'
);

select extensions.throws_ok(
  $$
    select public.admin_create_organization_private_course(
      '15150600-0000-4000-8000-000000000001'::uuid,
      'Starter Blocked Course',
      'Second Starter course should be blocked.',
      'Organisation learners',
      array['Attempt a second course'],
      'Values Education',
      'beginner',
      '{}'::jsonb,
      2,
      10
    )
  $$,
  '23514',
  'You have used your Starter course allowance. Upgrade to create another course.',
  'Starter cannot exceed one organization course through the course creation RPC'
);

select extensions.throws_ok(
  $$
    select public.admin_adapt_platform_course(
      'course-p15-org-006-platform-large',
      '15150600-0000-4000-8000-000000000002'::uuid,
      'Starter Large Adaptation'
    )
  $$,
  '23514',
  'Starter organisations can create up to five lessons.',
  'Starter cannot adapt a platform course with more than five lessons'
);

select extensions.is(
  (
    select count(*)::integer
    from public.courses
    where organization_id = '15150600-0000-4000-8000-000000000002'::uuid
  ),
  0,
  'failed over-limit adaptation rolls back the copied course'
);

select public.admin_upsert_lesson(
  null,
  'course-starter-allowed-course',
  'Starter Lesson 1',
  'Allowed lesson.',
  '{}'::jsonb,
  'draft',
  1,
  5,
  'anytime',
  null,
  true,
  true,
  null
) as starter_lesson_one
\gset

select extensions.lives_ok(
  $$
    select public.admin_upsert_lesson(null, 'course-starter-allowed-course', 'Starter Lesson 2', 'Allowed lesson.', '{}'::jsonb, 'draft', 2, 5, 'anytime', null, true, true, null);
    select public.admin_upsert_lesson(null, 'course-starter-allowed-course', 'Starter Lesson 3', 'Allowed lesson.', '{}'::jsonb, 'draft', 3, 5, 'anytime', null, true, true, null);
    select public.admin_upsert_lesson(null, 'course-starter-allowed-course', 'Starter Lesson 4', 'Allowed lesson.', '{}'::jsonb, 'draft', 4, 5, 'anytime', null, true, true, null);
    select public.admin_upsert_lesson(null, 'course-starter-allowed-course', 'Starter Lesson 5', 'Allowed lesson.', '{}'::jsonb, 'draft', 5, 5, 'anytime', null, true, true, null);
  $$,
  'Starter can create five total lessons through the lesson RPC'
);

select extensions.throws_ok(
  $$
    select public.admin_upsert_lesson(null, 'course-starter-allowed-course', 'Starter Lesson 6', 'Blocked lesson.', '{}'::jsonb, 'draft', 6, 5, 'anytime', null, true, true, null)
  $$,
  '23514',
  'Starter organisations can create up to five lessons.',
  'Starter cannot create a sixth lesson through the lesson RPC'
);

insert into public.lesson_pages (id, lesson_id, page_number, title, page_type)
values (
  'page-p15-org-006-starter',
  (:'starter_lesson_one'::jsonb ->> 'lessonId'),
  1,
  'Starter Page',
  'concept'
);

select extensions.lives_ok(
  $$
    select public.admin_upsert_lesson_block(
      null,
      'page-p15-org-006-starter',
      'text',
      1,
      '{"html":"<p>Allowed Starter text.</p>"}'::jsonb
    )
  $$,
  'Starter can create allowed text lesson blocks'
);

select extensions.throws_ok(
  $$
    select public.admin_upsert_lesson_block(
      null,
      'page-p15-org-006-starter',
      'video',
      2,
      '{"url":"https://example.test/video.mp4"}'::jsonb
    )
  $$,
  '23514',
  'Video and audio lessons are available on paid organisation plans.',
  'Starter cannot create video blocks through the block RPC'
);

select extensions.throws_ok(
  $$
    insert into public.lesson_content_blocks (page_id, block_type, sort_order, payload)
    values ('page-p15-org-006-starter', 'audio', 3, '{"url":"https://example.test/audio.mp3"}'::jsonb)
  $$,
  '23514',
  'Video and audio lessons are available on paid organisation plans.',
  'Starter cannot create audio blocks through direct table writes'
);

reset role;
set local role service_role;

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
  'course-p15-org-006-team',
  'course-p15-org-006-team',
  'P15 ORG 006 Team Course',
  'Paid organization media support.',
  'Organisation learners',
  array['Use paid media'],
  'Values Education',
  'beginner',
  'draft',
  1,
  10,
  'organization_private',
  '15150600-0000-4000-8000-000000000003'::uuid
);

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
  'lesson-p15-org-006-team',
  'course-p15-org-006-team',
  'lesson-p15-org-006-team',
  'Team Lesson',
  'Paid lesson.',
  'draft',
  1,
  5
);

insert into public.lesson_pages (id, lesson_id, page_number, title, page_type)
values ('page-p15-org-006-team', 'lesson-p15-org-006-team', 1, 'Team Page', 'concept');

select extensions.lives_ok(
  $$
    insert into public.lesson_content_blocks (page_id, block_type, sort_order, payload)
    values
      ('page-p15-org-006-team', 'video', 1, '{"url":"https://example.test/video.mp4"}'::jsonb),
      ('page-p15-org-006-team', 'audio', 2, '{"url":"https://example.test/audio.mp3"}'::jsonb)
  $$,
  'paid organization plans retain video and audio content support'
);

select extensions.lives_ok(
  $$
    insert into public.learning_media_assets (
      id,
      course_id,
      asset_type,
      placement,
      source,
      url,
      storage_path,
      metadata,
      review_status
    )
    values (
      '15150600-0000-4000-8000-000000000101'::uuid,
      'course-starter-allowed-course',
      'image',
      'course_cover',
      'uploaded',
      'https://example.test/60mb.png',
      'p15/starter/60mb.png',
      '{"size":62914560}'::jsonb,
      'approved'
    )
  $$,
  'Starter can store uploaded images within its 100 MB quota'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select extensions.is(
  public.organization_learning_storage_bytes('15150600-0000-4000-8000-000000000001'::uuid),
  62914560::bigint,
  'organization storage usage is calculated from stored image asset rows'
);

reset role;
set local role service_role;

select extensions.throws_ok(
  $$
    insert into public.learning_media_assets (
      course_id,
      asset_type,
      placement,
      source,
      url,
      storage_path,
      metadata,
      review_status
    )
    values (
      'course-starter-allowed-course',
      'image',
      'course_inline',
      'uploaded',
      'https://example.test/50mb.png',
      'p15/starter/50mb.png',
      '{"size":52428800}'::jsonb,
      'approved'
    )
  $$,
  '23514',
  'Starter organisations include 100 MB of image storage.',
  'Starter direct media inserts cannot exceed the image storage quota'
);

insert into public.learning_media_assets (
  id,
  course_id,
  asset_type,
  placement,
  source,
  url,
  storage_path,
  metadata,
  review_status
)
values (
  '15150600-0000-4000-8000-000000000201'::uuid,
  'course-p15-org-006-team',
  'image',
  'course_cover',
  'uploaded',
  'https://example.test/team-80mb.png',
  'p15/team/80mb.png',
  '{"size":83886080}'::jsonb,
  'approved'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select extensions.is(
  public.organization_learning_storage_bytes('15150600-0000-4000-8000-000000000001'::uuid),
  62914560::bigint,
  'storage usage remains scoped to the selected organization'
);

reset role;
set local role service_role;

delete from public.learning_media_assets
where id = '15150600-0000-4000-8000-000000000101'::uuid;

select extensions.lives_ok(
  $$
    insert into public.learning_media_assets (
      course_id,
      asset_type,
      placement,
      source,
      url,
      storage_path,
      metadata,
      review_status
    )
    values (
      'course-starter-allowed-course',
      'image',
      'course_inline',
      'uploaded',
      'https://example.test/50mb-after-delete.png',
      'p15/starter/50mb-after-delete.png',
      '{"size":52428800}'::jsonb,
      'approved'
    )
  $$,
  'deleting a stored image row releases quota for a later safe upload'
);

select extensions.throws_ok(
  $$
    insert into public.learning_media_assets (
      course_id,
      asset_type,
      placement,
      source,
      url,
      storage_path,
      metadata,
      review_status
    )
    values (
      'course-starter-allowed-course',
      'video',
      'lesson_video',
      'uploaded',
      'https://example.test/video.mp4',
      'p15/starter/video.mp4',
      '{"size":1048576}'::jsonb,
      'approved'
    )
  $$,
  '23514',
  'Video and audio lessons are available on paid organisation plans.',
  'Starter cannot attach video media assets through direct table writes'
);

reset role;

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'organization_learning_storage_bytes'
      and identity_arguments = 'p_organization_id uuid'
      and classification = 'PUBLIC_AUTHENTICATED_SELF'
      and execute_roles = array['authenticated', 'service_role']
  ),
  'organization storage usage RPC has a reviewed security classification'
);

select * from extensions.finish();

rollback;
