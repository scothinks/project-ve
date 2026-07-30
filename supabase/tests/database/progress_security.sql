begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(11);

select extensions.ok(
  has_function_privilege('authenticated', 'public.complete_lesson_page(text, text)', 'execute')
  and not has_function_privilege('anon', 'public.complete_lesson_page(text, text)', 'execute'),
  'authenticated learners can execute complete_lesson_page while anon cannot'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.lesson_page_completions', 'insert')
  and not has_table_privilege('authenticated', 'public.lesson_page_completions', 'update')
  and not has_table_privilege('authenticated', 'public.lesson_progress', 'insert')
  and not has_table_privilege('authenticated', 'public.lesson_progress', 'update'),
  'authenticated learners cannot directly write progress tables'
);

reset role;
set local role service_role;

create temporary table test_progress_pages (
  page_order integer primary key,
  lesson_id text not null,
  page_id text not null
) on commit drop;

insert into test_progress_pages (page_order, lesson_id, page_id)
select
  row_number() over (order by lp.page_number)::integer as page_order,
  lp.lesson_id,
  lp.id
from public.lesson_pages lp
join public.lessons l
  on l.id = lp.lesson_id
join public.courses c
  on c.id = l.course_id
where l.id = (
  select candidate.lesson_id
  from (
    select lp_candidate.lesson_id, count(*) as page_count
    from public.lesson_pages lp_candidate
    join public.lessons l_candidate
      on l_candidate.id = lp_candidate.lesson_id
     and l_candidate.status = 'published'
    join public.courses c_candidate
      on c_candidate.id = l_candidate.course_id
     and c_candidate.status = 'published'
    group by lp_candidate.lesson_id
    having count(*) >= 2
    order by lp_candidate.lesson_id
    limit 1
  ) candidate
)
order by lp.page_number;

grant select on test_progress_pages to authenticated;

select extensions.ok(
  (select count(*) from test_progress_pages) >= 2,
  'test fixture found a published lesson with multiple pages'
);

delete from public.lesson_page_completions
where user_id = :'TEST_LEARNER_USER_ID'
  and lesson_id = (select lesson_id from test_progress_pages limit 1);

delete from public.lesson_progress
where user_id = :'TEST_LEARNER_USER_ID'
  and lesson_id = (select lesson_id from test_progress_pages limit 1);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;

select extensions.throws_ok(
  format(
    $$ select public.complete_lesson_page(%L, %L) $$,
    (select lesson_id from test_progress_pages where page_order = 1),
    (select page_id from test_progress_pages where page_order = 1)
  ),
  '42501',
  'Authentication required.'
);

select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);

select extensions.throws_ok(
  format(
    $$ insert into public.lesson_page_completions (user_id, lesson_id, page_id) values (%L::uuid, %L, %L) $$,
    :'TEST_LEARNER_USER_ID',
    (select lesson_id from test_progress_pages where page_order = 1),
    (select page_id from test_progress_pages where page_order = 1)
  ),
  '42501',
  'permission denied for table lesson_page_completions'
);

select extensions.throws_ok(
  format(
    $$ insert into public.lesson_progress (user_id, lesson_id, completed_pages, completed_modules) values (%L::uuid, %L, '{}', '{}') $$,
    :'TEST_LEARNER_USER_ID',
    (select lesson_id from test_progress_pages where page_order = 1)
  ),
  '42501',
  'permission denied for table lesson_progress'
);

select extensions.throws_ok(
  format(
    $$ select public.complete_lesson_page(%L, 'missing-page-id') $$,
    (select lesson_id from test_progress_pages where page_order = 1)
  ),
  'P0002',
  'Page not found for lesson.'
);

select extensions.is(
  (
    public.complete_lesson_page(
      (select lesson_id from test_progress_pages where page_order = 1),
      (select page_id from test_progress_pages where page_order = 1)
    ) -> 'completedPages'
  )::jsonb,
  jsonb_build_array((select page_id from test_progress_pages where page_order = 1)),
  'first page completion returns current canonical completed pages'
);

select extensions.is(
  (
    public.complete_lesson_page(
      (select lesson_id from test_progress_pages where page_order = 1),
      (select page_id from test_progress_pages where page_order = 1)
    ) ->> 'completedPageCount'
  )::integer,
  1,
  'duplicate page completion is idempotent'
);

select public.complete_lesson_page(lesson_id, page_id)
from test_progress_pages
where page_order > 1;

reset role;
set local role service_role;

select extensions.is(
  (
    select completed_pages
    from public.lesson_progress
    where user_id = :'TEST_LEARNER_USER_ID'
      and lesson_id = (select lesson_id from test_progress_pages limit 1)
  ),
  (
    select array_agg(page_id order by page_order)
    from test_progress_pages
  ),
  'lesson_progress summary completed_pages is regenerated from page completions'
);

select extensions.ok(
  exists (
    select 1
    from public.lesson_progress
    where user_id = :'TEST_LEARNER_USER_ID'
      and lesson_id = (select lesson_id from test_progress_pages limit 1)
      and completed_modules = completed_pages
      and completed_at is not null
  ),
  'lesson_progress summary marks lesson complete only after every page is complete'
);

select * from finish();

rollback;
