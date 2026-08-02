begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(19);

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
  thumbnail,
  status,
  sort_order,
  estimated_minutes,
  ai_text_status,
  ai_media_status,
  ai_publish_status,
  ai_generated,
  ai_generation_notes,
  text_approved_at,
  text_approved_by,
  media_approved_at,
  media_approved_by
)
values (
  'course-cms-template-source',
  'course-cms-template-source',
  'CMS Template Source',
  'Source description',
  'Editors building values education pathways',
  array['Map a CMS authoring journey', 'Publish a reviewed course'],
  'Integrity',
  'intermediate',
  '{"src":"https://example.test/source.png","alt":"Source thumbnail"}'::jsonb,
  'published',
  42,
  22,
  'approved',
  'approved',
  'published',
  true,
  '{"provider":"seed"}'::jsonb,
  now(),
  :'TEST_ADMIN_USER_ID'::uuid,
  now(),
  :'TEST_ADMIN_USER_ID'::uuid
);

insert into public.lessons (
  id,
  course_id,
  slug,
  title,
  subtitle,
  description,
  cover_image,
  status,
  sort_order,
  estimated_minutes,
  ai_text_status,
  ai_media_status,
  ai_publish_status,
  ai_generated,
  ai_generation_notes,
  text_approved_at,
  text_approved_by,
  media_approved_at,
  media_approved_by
)
values
  (
    'lesson-cms-template-source-a',
    'course-cms-template-source',
    'lesson-cms-template-source-a',
    'Template Lesson A',
    'A subtitle',
    'A description',
    '{"src":"https://example.test/lesson-a.png","alt":"Lesson A"}'::jsonb,
    'published',
    2,
    12,
    'approved',
    'approved',
    'published',
    true,
    '{"kind":"lesson"}'::jsonb,
    now(),
    :'TEST_ADMIN_USER_ID'::uuid,
    now(),
    :'TEST_ADMIN_USER_ID'::uuid
  ),
  (
    'lesson-cms-template-source-b',
    'course-cms-template-source',
    'lesson-cms-template-source-b',
    'Template Lesson B',
    null,
    'B description',
    null,
    'published',
    1,
    10,
    'approved',
    'approved',
    'published',
    true,
    '{}'::jsonb,
    now(),
    :'TEST_ADMIN_USER_ID'::uuid,
    now(),
    :'TEST_ADMIN_USER_ID'::uuid
  );

insert into public.lesson_pages (
  id,
  lesson_id,
  page_number,
  title,
  subtitle,
  page_type,
  cover_image
)
values
  ('page-cms-template-source-a1', 'lesson-cms-template-source-a', 1, 'Lesson A Page 1', null, 'concept', null),
  ('page-cms-template-source-a2', 'lesson-cms-template-source-a', 2, 'Lesson A Page 2', null, 'reflection', null),
  ('page-cms-template-source-b1', 'lesson-cms-template-source-b', 1, 'Lesson B Page 1', null, 'summary', null);

insert into public.learning_media_assets (
  id,
  course_id,
  lesson_id,
  asset_type,
  placement,
  source,
  prompt,
  url,
  storage_path,
  alt_text,
  caption,
  metadata,
  review_status,
  generation_status,
  sort_order
)
values
  (
    '11111111-1111-4111-8111-111111111111'::uuid,
    'course-cms-template-source',
    'lesson-cms-template-source-a',
    'image',
    'image_block',
    'uploaded',
    null,
    'https://example.test/source-media.png',
    'cms/source/2026/08/source.png',
    'Source media alt',
    'Source caption',
    '{"width":1,"height":1}'::jsonb,
    'approved',
    'completed',
    1
  );

insert into public.lesson_content_blocks (
  id,
  page_id,
  block_type,
  sort_order,
  payload
)
values
  (
    '22222222-2222-4222-8222-222222222222'::uuid,
    'page-cms-template-source-a1',
    'text',
    1,
    '{"body":"Source body"}'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333333'::uuid,
    'page-cms-template-source-a1',
    'image',
    2,
    '{"src":"https://example.test/source-media.png","alt":"Source media alt","aiManagedByAssetId":"11111111-1111-4111-8111-111111111111"}'::jsonb
  ),
  (
    '44444444-4444-4444-8444-444444444444'::uuid,
    'page-cms-template-source-b1',
    'callout',
    1,
    '{"title":"Source callout","body":"Callout body"}'::jsonb
  );

insert into public.quizzes (
  id,
  lesson_id,
  title,
  version,
  status,
  ai_text_status,
  ai_generated,
  ai_generation_notes,
  text_approved_at,
  text_approved_by
)
values (
  'quiz-cms-template-source-a',
  'lesson-cms-template-source-a',
  'Template Quiz',
  3,
  'published',
  'approved',
  true,
  '{"kind":"quiz"}'::jsonb,
  now(),
  :'TEST_ADMIN_USER_ID'::uuid
);

insert into public.quiz_questions (
  id,
  quiz_id,
  question_order,
  question_type,
  prompt,
  explanation,
  xp
)
values
  ('question-cms-template-source-a1', 'quiz-cms-template-source-a', 2, 'multiple_choice', 'Second source question?', 'Second explanation', 5),
  ('question-cms-template-source-a2', 'quiz-cms-template-source-a', 1, 'single_choice', 'First source question?', 'First explanation', 5);

insert into public.quiz_options (
  id,
  question_id,
  option_order,
  label,
  is_correct
)
values
  ('option-cms-template-source-a1-1', 'question-cms-template-source-a1', 1, 'Second A', true),
  ('option-cms-template-source-a1-2', 'question-cms-template-source-a1', 2, 'Second B', false),
  ('option-cms-template-source-a2-1', 'question-cms-template-source-a2', 2, 'First B', false),
  ('option-cms-template-source-a2-2', 'question-cms-template-source-a2', 1, 'First A', true);

insert into public.content_value_tags (
  content_type,
  content_id,
  dimension_id,
  weight,
  recommended_level,
  outcome_type
)
select 'course', 'course-cms-template-source', id, 0.7, 'intermediate', 'practice'
from public.value_dimensions
order by id
limit 1;

insert into public.content_value_tags (
  content_type,
  content_id,
  dimension_id,
  weight,
  recommended_level,
  outcome_type
)
select 'lesson', 'lesson-cms-template-source-a', id, 0.6, 'intermediate', 'reflection'
from public.value_dimensions
order by id desc
limit 1;

insert into public.lesson_progress (
  user_id,
  lesson_id,
  completed_pages,
  completed_modules,
  quiz_score
)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  'lesson-cms-template-source-a',
  array['page-cms-template-source-a1'],
  array[]::text[],
  100
);

insert into public.quiz_attempts (
  id,
  user_id,
  lesson_id,
  quiz_id,
  quiz_version,
  status,
  seed
)
values (
  '55555555-5555-4555-8555-555555555555'::uuid,
  :'TEST_LEARNER_USER_ID'::uuid,
  'lesson-cms-template-source-a',
  'quiz-cms-template-source-a',
  3,
  'graded',
  'cms-template-seed'
);

reset role;

select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

create temp table test_template_result as
select public.admin_duplicate_course_template(
  'course-cms-template-source',
  'CMS Template Copy'
) ->> 'courseId' as course_id;

grant select on test_template_result to authenticated, service_role;

select extensions.isnt(
  (select course_id from test_template_result),
  'course-cms-template-source',
  'template duplication creates a new course id'
);

select extensions.is(
  (
    select count(*)::integer
    from public.lessons
    where course_id = (select course_id from test_template_result)
  ),
  2,
  'template duplication copies every lesson'
);

select extensions.is(
  (
    select intended_audience || '/' || array_to_string(learning_outcomes, '|')
    from public.courses
    where id = (select course_id from test_template_result)
  ),
  'Editors building values education pathways/Map a CMS authoring journey|Publish a reviewed course',
  'template duplication copies canonical audience and learning outcomes'
);

select extensions.is(
  (
    select count(*)::integer
    from public.lesson_pages lp
    join public.lessons l on l.id = lp.lesson_id
    where l.course_id = (select course_id from test_template_result)
  ),
  3,
  'template duplication copies every lesson page'
);

select extensions.is(
  (
    select count(*)::integer
    from public.lesson_content_blocks lcb
    join public.lesson_pages lp on lp.id = lcb.page_id
    join public.lessons l on l.id = lp.lesson_id
    where l.course_id = (select course_id from test_template_result)
  ),
  3,
  'template duplication copies every content block'
);

select extensions.is(
  (
    select count(*)::integer
    from public.quizzes q
    join public.lessons l on l.id = q.lesson_id
    where l.course_id = (select course_id from test_template_result)
  ),
  1,
  'template duplication copies quizzes'
);

select extensions.is(
  (
    select count(*)::integer
    from public.quiz_questions qq
    join public.quizzes q on q.id = qq.quiz_id
    join public.lessons l on l.id = q.lesson_id
    where l.course_id = (select course_id from test_template_result)
  ) || '/' || (
    select count(*)::integer
    from public.quiz_options qo
    join public.quiz_questions qq on qq.id = qo.question_id
    join public.quizzes q on q.id = qq.quiz_id
    join public.lessons l on l.id = q.lesson_id
    where l.course_id = (select course_id from test_template_result)
  ),
  '2/4',
  'template duplication copies quiz questions and options'
);

select extensions.is(
  (
    select string_agg(title, ',' order by sort_order)
    from public.lessons
    where course_id = (select course_id from test_template_result)
  ),
  'Template Lesson B,Template Lesson A',
  'template duplication preserves lesson order'
);

select extensions.is(
  (
    select string_agg(lp.title, ',' order by l.sort_order, lp.page_number)
    from public.lesson_pages lp
    join public.lessons l on l.id = lp.lesson_id
    where l.course_id = (select course_id from test_template_result)
  ),
  'Lesson B Page 1,Lesson A Page 1,Lesson A Page 2',
  'template duplication preserves page order'
);

select extensions.is(
  (
    select string_agg(lcb.block_type || ':' || lcb.sort_order::text, ',' order by l.sort_order, lp.page_number, lcb.sort_order)
    from public.lesson_content_blocks lcb
    join public.lesson_pages lp on lp.id = lcb.page_id
    join public.lessons l on l.id = lp.lesson_id
    where l.course_id = (select course_id from test_template_result)
  ),
  'callout:1,text:1,image:2',
  'template duplication preserves block order'
);

select extensions.is(
  (
    select string_agg(qq.prompt || ':' || qo.label, ',' order by qq.question_order, qo.option_order)
    from public.quiz_options qo
    join public.quiz_questions qq on qq.id = qo.question_id
    join public.quizzes q on q.id = qq.quiz_id
    join public.lessons l on l.id = q.lesson_id
    where l.course_id = (select course_id from test_template_result)
  ),
  'First source question?:First A,First source question?:First B,Second source question?:Second A,Second source question?:Second B',
  'template duplication preserves question and option order'
);

select extensions.is_empty(
  $$
    select 1
    from public.lesson_pages lp
    join public.lessons l on l.id = lp.lesson_id
    where l.course_id = (select course_id from test_template_result)
      and lp.id in ('page-cms-template-source-a1', 'page-cms-template-source-a2', 'page-cms-template-source-b1')
    union all
    select 1
    from public.lesson_content_blocks lcb
    join public.lesson_pages lp on lp.id = lcb.page_id
    join public.lessons l on l.id = lp.lesson_id
    where l.course_id = (select course_id from test_template_result)
      and lcb.id in (
        '22222222-2222-4222-8222-222222222222'::uuid,
        '33333333-3333-4333-8333-333333333333'::uuid,
        '44444444-4444-4444-8444-444444444444'::uuid
      )
  $$,
  'template duplication gives copied child records new identities'
);

select extensions.is_empty(
  $$
    select 1
    from public.courses c
    where c.id = (select course_id from test_template_result)
      and (
        c.status <> 'draft'
        or c.ai_text_status <> 'draft'
        or c.ai_media_status <> 'draft'
        or c.ai_publish_status <> 'not_ready'
        or c.text_approved_at is not null
        or c.media_approved_at is not null
      )
    union all
    select 1
    from public.lessons l
    where l.course_id = (select course_id from test_template_result)
      and (
        l.status <> 'draft'
        or l.ai_text_status <> 'draft'
        or l.ai_media_status <> 'draft'
        or l.ai_publish_status <> 'not_ready'
        or l.text_approved_at is not null
        or l.media_approved_at is not null
      )
    union all
    select 1
    from public.quizzes q
    join public.lessons l on l.id = q.lesson_id
    where l.course_id = (select course_id from test_template_result)
      and (
        q.status <> 'draft'
        or q.ai_text_status <> 'draft'
        or q.text_approved_at is not null
      )
  $$,
  'template duplication resets copied editorial state to draft'
);

select extensions.ok(
  exists (
    select 1
    from public.courses
    where id = 'course-cms-template-source'
      and status = 'published'
      and ai_text_status = 'approved'
      and ai_media_status = 'approved'
      and ai_publish_status = 'published'
      and text_approved_at is not null
      and media_approved_at is not null
  ),
  'template duplication leaves source publishing and approval state unchanged'
);

select extensions.is(
  (
    select count(*)::integer
    from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
    where l.course_id = (select course_id from test_template_result)
  ) || '/' || (
    select count(*)::integer
    from public.quiz_attempts qa
    join public.lessons l on l.id = qa.lesson_id
    where l.course_id = (select course_id from test_template_result)
  ),
  '0/0',
  'template duplication does not copy learner progress or quiz attempts'
);

select extensions.ok(
  exists (
    select 1
    from public.learning_media_assets lma
    join public.lessons l on l.id = lma.lesson_id
    where l.course_id = (select course_id from test_template_result)
      and lma.id <> '11111111-1111-4111-8111-111111111111'::uuid
      and lma.storage_path = 'cms/source/2026/08/source.png'
      and lma.review_status = 'draft'
  )
  and exists (
    select 1
    from public.lesson_content_blocks lcb
    join public.lesson_pages lp on lp.id = lcb.page_id
    join public.lessons l on l.id = lp.lesson_id
    join public.learning_media_assets lma
      on lma.id::text = lcb.payload ->> 'aiManagedByAssetId'
    where l.course_id = (select course_id from test_template_result)
      and lcb.block_type = 'image'
      and lma.id <> '11111111-1111-4111-8111-111111111111'::uuid
  ),
  'template duplication copies media usage records and remaps image block asset references'
);

update public.lesson_content_blocks lcb
set payload = jsonb_set(lcb.payload, '{body}', '"Copied body"', true)
from public.lesson_pages lp
join public.lessons l on l.id = lp.lesson_id
where lcb.page_id = lp.id
  and l.course_id = (select course_id from test_template_result)
  and lcb.block_type = 'text';

select extensions.is(
  (
    select payload ->> 'body'
    from public.lesson_content_blocks
    where id = '22222222-2222-4222-8222-222222222222'::uuid
  ),
  'Source body',
  'editing copied content does not modify the source content block'
);

reset role;

select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

do $$
begin
  perform set_config('project_ve.simulate_template_duplication_failure', '1', true);
  perform public.admin_duplicate_course_template('course-cms-template-source', 'Rollback Course');
exception when others then
  perform set_config('project_ve.simulate_template_duplication_failure', '', true);
end;
$$;

select extensions.is(
  (
    select count(*)::integer
    from public.courses
    where title = 'Rollback Course'
  ),
  0,
  'template duplication rolls back the copied course when a later copy step fails'
);

reset role;

select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  $$ select public.admin_duplicate_course_template('course-cms-template-source', 'Learner Copy') $$,
  'Only an admin can duplicate course templates.',
  'learners cannot duplicate course templates'
);

select extensions.finish();

rollback;
