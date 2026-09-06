begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, private;
select extensions.plan(47);

select extensions.ok(not exists (
  select 1 from public.lessons where status = 'published' and published_snapshot is null
), 'migration backfills already published lessons');

-- Fixture setup only; all mutations under test below use the public RPCs.
set local session_replication_role = replica;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
select ('90400000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'authenticated', 'authenticated', 'lesson-publish-' || n || '@example.test', '{}'::jsonb, '{}'::jsonb
from generate_series(1, 4) n;
set local session_replication_role = origin;
set local role service_role;
insert into public.profiles (id, display_name, role)
select ('90400000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'Lesson Publish ' || n, 'learner'
from generate_series(1, 4) n;
update public.profiles set role = 'admin' where id = '90400000-0000-4000-8000-000000000001';
insert into public.organizations (id, slug, name, status, created_by)
values ('90400000-0000-4000-8000-000000000101', 'lesson-publish-org', 'Lesson Publish Org', 'published', '90400000-0000-4000-8000-000000000003');
insert into public.organization_memberships (organization_id, user_id, role, status)
values ('90400000-0000-4000-8000-000000000101', '90400000-0000-4000-8000-000000000003', 'organisation_owner', 'active');
insert into public.platform_catalog_memberships (user_id, role, status)
values ('90400000-0000-4000-8000-000000000002', 'content_editor', 'active');
insert into public.courses (id, slug, title, description, category, status, catalog_scope, organization_id)
values
  ('course-publish-platform', 'course-publish-platform', 'Platform', 'Test', 'Values', 'published', 'platform', null),
  ('course-publish-org', 'course-publish-org', 'Org', 'Test', 'Values', 'draft', 'organization_private', '90400000-0000-4000-8000-000000000101');
insert into public.lessons (id, course_id, slug, title, description, cover_image, estimated_minutes, retry_mode,
  retry_cooldown_seconds, retry_requires_reread, quiz_requires_lesson_completion, max_earning_attempts)
values
  ('lesson-publish-main', 'course-publish-platform', 'main', 'Original', 'Description', '{"url":"/cover.png"}', 8, 'cooldown', 60, false, false, 3),
  ('lesson-publish-org', 'course-publish-org', 'org', 'Org', null, null, 0, 'anytime', null, true, true, null),
  ('lesson-publish-empty', 'course-publish-platform', 'empty', 'Empty', null, null, 0, 'anytime', null, true, true, null);
insert into public.lesson_pages (id, lesson_id, page_number, title, subtitle, page_type, cover_image)
values
  ('page-publish-a', 'lesson-publish-main', 1, 'First', 'Subtitle', 'primer', '{"url":"/page.png"}'),
  ('page-publish-b', 'lesson-publish-main', 2, 'Second', null, 'concept', null),
  ('page-publish-c', 'lesson-publish-main', 3, 'Third', null, 'summary', '{}'),
  ('page-publish-org', 'lesson-publish-org', 1, 'Org', null, 'concept', '{}');
insert into public.lesson_content_blocks (id, page_id, block_type, sort_order, payload)
values
  ('90400000-0000-4000-8000-000000000201', 'page-publish-a', 'text', 1, '{"html":"<p>Original</p>"}'),
  ('90400000-0000-4000-8000-000000000202', 'page-publish-a', 'callout', 2, '{"text":"Original callout"}'),
  ('90400000-0000-4000-8000-000000000203', 'page-publish-b', 'text', 1, '{"html":"<p>Second</p>"}');
insert into public.quizzes (id, lesson_id, title, status)
values ('quiz-publish-main', 'lesson-publish-main', 'Quiz outside snapshot', 'draft');
insert into public.lesson_page_completions (user_id, lesson_id, page_id)
values ('90400000-0000-4000-8000-000000000004', 'lesson-publish-main', 'page-publish-a');
reset role;
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000001',true);
set local role authenticated;
select extensions.lives_ok($test$select public.admin_publish_lesson('lesson-publish-main')$test$, 'publish baseline');
reset role;
create temp table cutover_state as select draft_revision as revision,
 private.lesson_draft_snapshot(id) as content, published_snapshot
 from public.lessons where id='lesson-publish-main';
grant select on cutover_state to authenticated;
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000004',true);
set local role authenticated;
select extensions.is((select count(*) from public.lessons where id='lesson-publish-main'), 0::bigint, 'learner cannot read raw lesson metadata');
select extensions.is((select count(*) from public.lesson_pages where lesson_id='lesson-publish-main'), 0::bigint, 'learner cannot read draft pages');
select extensions.is((select count(*) from public.lesson_content_blocks where page_id='page-publish-a'), 0::bigint, 'learner cannot read draft blocks');
select extensions.is((select title from public.learner_lessons where id='lesson-publish-main'), 'Original', 'learner reads published metadata');
select extensions.is((select count(*) from public.learner_lesson_page_references where lesson_id='lesson-publish-main'), 3::bigint, 'learner page references match publication');
select extensions.is((select count(*) from public.learner_lessons where id='lesson-publish-org'), 0::bigint, 'unpublished tenant lesson is hidden');
select extensions.is((select public.complete_lesson_page('lesson-publish-main','page-publish-b')->>'totalPageCount'), '3', 'learner completes published page before draft deletion');
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000002',true);
set local role authenticated;
select extensions.lives_ok($test$select public.admin_save_lesson_builder('lesson-publish-main',(select revision from cutover_state), (select jsonb_agg(p || jsonb_build_object('title','Draft title')) from cutover_state c, lateral jsonb_array_elements(c.content->'pages') p where p->>'id' <> 'page-publish-b'), (select jsonb_agg(b) from cutover_state c, lateral jsonb_array_elements(c.content->'blocks') b where b->>'page_id' <> 'page-publish-b'))$test$, 'atomic builder removes a page and edits retained draft content');
reset role;
select extensions.is((select count(*) from public.lesson_page_completions where page_id='page-publish-b'),1::bigint,'draft deletion preserves existing completion');
select extensions.is((select count(*) from public.lesson_pages where id='page-publish-b'),0::bigint,'draft page is physically removed');
select extensions.is((select published_snapshot from public.lessons where id='lesson-publish-main'),(select published_snapshot from cutover_state),'atomic draft save leaves snapshot unchanged');
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000004',true);
set local role authenticated;
select extensions.is((select public.complete_lesson_page('lesson-publish-main','page-publish-b')->>'totalPageCount'), '3', 'deleted draft page still completes against published identity');
select extensions.is((select published_snapshot->'pages'->0->>'title' from public.learner_lessons where id='lesson-publish-main'), 'First', 'published content ignores edited draft titles');
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000002',true);
set local role authenticated;
select extensions.throws_ok($test$select public.admin_save_lesson_builder('lesson-publish-main',(select revision from cutover_state),(select content->'pages' from cutover_state),(select content->'blocks' from cutover_state))$test$,'PT409','This lesson changed in another session. Reload before saving, publishing or reverting.','admin_save_lesson_builder rejects stale revision');
select extensions.throws_ok($test$select public.admin_publish_lesson_checked('lesson-publish-main',(select revision from cutover_state))$test$,'PT409','This lesson changed in another session. Reload before saving, publishing or reverting.','admin_publish_lesson_checked rejects stale revision');
select extensions.throws_ok($test$select public.admin_revert_lesson_checked('lesson-publish-main',(select revision from cutover_state))$test$,'PT409','This lesson changed in another session. Reload before saving, publishing or reverting.','admin_revert_lesson_checked rejects stale revision');
reset role;
update cutover_state set revision=(select draft_revision from public.lessons where id='lesson-publish-main'), content=private.lesson_draft_snapshot('lesson-publish-main');
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000002',true);
set local role authenticated;
select extensions.throws_ok($test$select public.admin_save_lesson_builder('lesson-publish-main',(select revision from cutover_state),(select content->'pages' from cutover_state),jsonb_build_array(jsonb_build_object('id','draft-bad','page_id','page-publish-a','block_type','invalid','sort_order',1,'payload','{}'::jsonb)))$test$,'22P02','invalid input value for enum lesson_content_block_type: "invalid"','late save failure rolls back the whole transaction');
reset role;
select extensions.is(private.lesson_draft_snapshot('lesson-publish-main'),(select content from cutover_state),'failed save leaves all draft content intact');
select extensions.is((select draft_revision from public.lessons where id='lesson-publish-main'),(select revision from cutover_state),'failed save leaves revision intact');
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000002',true);
set local role authenticated;
select extensions.lives_ok($test$select public.admin_revert_lesson_checked('lesson-publish-main',(select revision from cutover_state))$test$, 'current revision can restore publication');
reset role;
select extensions.is((select count(*) from public.lesson_page_completions where page_id='page-publish-b'),1::bigint,'restored page retains its original completion');
update public.lessons set retry_mode='disabled', quiz_requires_lesson_completion=true where id='lesson-publish-main';
update public.quizzes set status='published' where id='quiz-publish-main';
insert into public.quiz_questions(id,quiz_id,question_order,question_type,prompt,xp)
values('question-cutover','quiz-publish-main',1,'single_choice','Test',1);
insert into public.quiz_options(id,question_id,option_order,label,is_correct)
values('option-cutover-a','question-cutover',1,'Correct',true),('option-cutover-b','question-cutover',2,'Incorrect',false);
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000004',true);
set local role authenticated;
select extensions.is((select retry_mode::text from public.learner_lessons where id='lesson-publish-main'), 'cooldown', 'learner metadata keeps published retry policy');
select extensions.is((select public.start_quiz_attempt('quiz-publish-main','lesson-publish-main')->>'status'), 'started', 'quiz eligibility uses published completion setting');
reset role;
update public.quiz_attempts set ended_at=now()-interval '10 minutes',status='graded' where lesson_id='lesson-publish-main' and user_id='90400000-0000-4000-8000-000000000004';
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000004',true);
set local role authenticated;
select extensions.is((select public.start_quiz_attempt('quiz-publish-main','lesson-publish-main')->>'status'), 'started', 'quiz retry uses published cooldown rather than draft disabled policy');
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000001',true);
set local role authenticated;
select extensions.lives_ok($test$select public.admin_upsert_lesson_page('page-cutover-draft-only','lesson-publish-main','Draft only',null,'concept',4,'{}')$test$, 'editor adds draft-only page');
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000004',true);
set local role authenticated;
select extensions.throws_ok($test$select public.complete_lesson_page('lesson-publish-main','page-cutover-draft-only')$test$,'P0002','Page not found for lesson.','draft-only page cannot be completed');
reset role;
update cutover_state set revision=(select draft_revision from public.lessons where id='lesson-publish-main'),content=private.lesson_draft_snapshot('lesson-publish-main');
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000002',true);
set local role authenticated;
select extensions.lives_ok($test$select public.admin_publish_lesson_checked('lesson-publish-main',(select revision from cutover_state))$test$, 'publish exposes complete new draft in one transaction');
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000004',true);
set local role authenticated;
select extensions.is((select count(*) from public.learner_lesson_page_references where lesson_id='lesson-publish-main'), 4::bigint, 'page set changes only after publish');
select extensions.is((select public.complete_lesson_page('lesson-publish-main','page-cutover-draft-only')->>'totalPageCount'), '4', 'newly published page can be completed');
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000003',true);
set local role authenticated;
select extensions.lives_ok($test$select public.admin_publish_lesson('lesson-publish-org')$test$, 'organisation owner can publish private lesson');
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000004',true);
set local role authenticated;
select extensions.is((select count(*) from public.learner_lessons where id='lesson-publish-org'), 0::bigint, 'outsider cannot read another tenant publication');
reset role;
set local role anon;
select extensions.is((select count(*) from public.lesson_pages where lesson_id='lesson-publish-main'), 0::bigint, 'anonymous draft access denied');
select extensions.lives_ok('select id from public.quizzes limit 1', 'anonymous quiz projection does not invoke editor helpers');
select extensions.is((select count(*) from public.learning_media_assets), 0::bigint, 'anonymous media library read returns no draft assets');
select extensions.is((select title from public.learner_lessons where id='lesson-publish-main'), 'Original', 'anonymous public publication remains readable');
select extensions.is((select count(*) from public.learner_lessons where id='lesson-publish-org'), 0::bigint, 'anonymous private publication denied');
reset role;
select extensions.ok(not has_table_privilege('authenticated','private.lesson_page_identities','select'),'durable identity table is private');
select extensions.ok(not has_function_privilege('anon','public.admin_save_lesson_builder(text,bigint,jsonb,jsonb)','execute'),'anonymous cannot call atomic builder');
select extensions.ok(not has_function_privilege('authenticated','private.lock_lesson_revision(text,bigint)','execute'),'revision lock helper stays private');
-- Retained history must never satisfy a different, smaller published page set.
insert into public.missions(id,title,description,category,reward_type,reward_xp,repeatability,validation_type,validation_config,status)
values('mission-cutover-history','Publication history','Test','course','xp',1,'once','lesson_completed','{"lessonId":"lesson-publish-main"}','published');
update public.lesson_progress set completed_at=now() where user_id='90400000-0000-4000-8000-000000000004' and lesson_id='lesson-publish-main';
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.admin_save_lesson_builder('lesson-publish-main',
  (select draft_revision from public.lessons where id='lesson-publish-main'),
  '[{"id":"page-publish-c","page_number":1,"title":"Remaining uncompleted page","page_type":"concept","cover_image":{}}]', '[]');
select public.admin_publish_lesson('lesson-publish-main');
reset role;
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000004',true);
set local role authenticated;
select extensions.ok(not public.lesson_is_complete_for_user(auth.uid(),'lesson-publish-main'), 'historical timestamp cannot complete newly published page set');
select extensions.is((public.get_dashboard_mission_state('[{"missionId":"mission-cutover-history"}]')->0->>'valid'), 'false', 'mission ignores completions for pages absent from current publication');
select extensions.ok((select count(*) from public.lesson_page_completions where lesson_id='lesson-publish-main') >= 2, 'historical completions remain stored after new publication');
reset role;
update public.missions set validation_type='lesson_count_completed',mission_type_key='lesson_count_completed',validation_config='{"count":1,"withinDays":30}' where id='mission-cutover-history';
select set_config('request.jwt.claim.sub','90400000-0000-4000-8000-000000000004',true);
set local role authenticated;
select extensions.is((public.get_dashboard_mission_state('[{"missionId":"mission-cutover-history"}]')->0->>'valid'), 'false', 'time-bounded mission also rejects stale completion history');
select extensions.throws_ok($test$select public.award_valid_mission_xp('mission-cutover-history','once')$test$,'P0001','Mission is not complete.','time-bounded mission cannot award XP for historical pages');
reset role;
select extensions.is((public.upsert_course_completion_for_user('90400000-0000-4000-8000-000000000004','course-publish-platform')).completed_required_lessons, '{}'::text[], 'course completion excludes stale lesson timestamp');
select * from extensions.finish();
rollback;
