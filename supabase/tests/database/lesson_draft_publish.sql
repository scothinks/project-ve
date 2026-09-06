begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, private;
select extensions.plan(66);

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
select extensions.ok(not has_function_privilege('anon', 'public.admin_publish_lesson(text)', 'execute'), 'anonymous cannot execute admin_publish_lesson');
select extensions.ok(not has_function_privilege('anon', 'public.admin_revert_lesson_to_published(text)', 'execute'), 'anonymous cannot execute admin_revert_lesson_to_published');
select extensions.ok(not has_function_privilege('anon', 'public.admin_delete_lesson_page(text,text)', 'execute'), 'anonymous cannot execute admin_delete_lesson_page');
select extensions.ok(not has_function_privilege('authenticated', 'private.lesson_draft_snapshot(text)', 'execute'), 'snapshot helper stays private');
reset role;
select set_config('request.jwt.claim.sub', '90400000-0000-4000-8000-000000000004', true);
set local role authenticated;
select extensions.throws_ok($test$select public.admin_publish_lesson('lesson-publish-main')$test$, 'P0001', 'Lesson content editor access required.', 'learner denied admin_publish_lesson');
select extensions.throws_ok($test$select public.admin_revert_lesson_to_published('lesson-publish-main')$test$, 'P0001', 'Lesson content editor access required.', 'learner denied admin_revert_lesson_to_published');
select extensions.throws_ok($test$select public.admin_delete_lesson_page('lesson-publish-main', 'page-publish-b')$test$, 'P0001', 'Lesson content editor access required.', 'learner denied admin_delete_lesson_page');
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;
select extensions.throws_ok($test$select public.admin_publish_lesson('lesson-publish-main')$test$, 'P0001', 'Lesson content editor access required.', 'service without actor denied admin_publish_lesson');
select extensions.throws_ok($test$select public.admin_revert_lesson_to_published('lesson-publish-main')$test$, 'P0001', 'Lesson content editor access required.', 'service without actor denied admin_revert_lesson_to_published');
select extensions.throws_ok($test$select public.admin_delete_lesson_page('lesson-publish-main', 'page-publish-b')$test$, 'P0001', 'Lesson content editor access required.', 'service without actor denied admin_delete_lesson_page');
reset role;
select set_config('request.jwt.claim.sub', '90400000-0000-4000-8000-000000000003', true);
set local role authenticated;
select extensions.throws_ok($test$select public.admin_publish_lesson('lesson-publish-main')$test$, 'P0001', 'Lesson content editor access required.', 'org owner cannot mutate platform via admin_publish_lesson');
select extensions.throws_ok($test$select public.admin_revert_lesson_to_published('lesson-publish-main')$test$, 'P0001', 'Lesson content editor access required.', 'org owner cannot mutate platform via admin_revert_lesson_to_published');
select extensions.throws_ok($test$select public.admin_delete_lesson_page('lesson-publish-main', 'page-publish-b')$test$, 'P0001', 'Lesson content editor access required.', 'org owner cannot mutate platform via admin_delete_lesson_page');
select extensions.lives_ok($test$select public.admin_publish_lesson('lesson-publish-org')$test$, 'owner can publish own organisation lesson');
select extensions.lives_ok($test$select public.admin_revert_lesson_to_published('lesson-publish-org')$test$, 'owner can restore null and empty fields');
reset role;
select set_config('request.jwt.claim.sub', '90400000-0000-4000-8000-000000000002', true);
set local role authenticated;
select extensions.throws_ok($test$select public.admin_publish_lesson('lesson-publish-org')$test$, 'P0001', 'Lesson content editor access required.', 'catalog editor cannot mutate organisation via admin_publish_lesson');
select extensions.throws_ok($test$select public.admin_revert_lesson_to_published('lesson-publish-org')$test$, 'P0001', 'Lesson content editor access required.', 'catalog editor cannot mutate organisation via admin_revert_lesson_to_published');
select extensions.throws_ok($test$select public.admin_delete_lesson_page('lesson-publish-org', 'page-publish-b')$test$, 'P0001', 'Lesson content editor access required.', 'catalog editor cannot mutate organisation via admin_delete_lesson_page');
select extensions.throws_ok($test$select public.admin_revert_lesson_to_published('lesson-publish-main')$test$, 'P0001', 'This lesson has no published version to revert to.', 'cannot revert never-published lesson');
select extensions.lives_ok($test$select public.admin_publish_lesson('lesson-publish-main')$test$, 'catalog editor can publish platform lesson');
select extensions.is((select status::text from public.lessons where id = 'lesson-publish-main'), 'published', 'publish enables visibility');
select extensions.ok((select published_at is not null from public.lessons where id = 'lesson-publish-main'), 'publish records capture timestamp');
select extensions.is((select published_snapshot->'pages'->0->>'id' from public.lessons where id = 'lesson-publish-main'), 'page-publish-a', 'pages ordered by number');
select extensions.is((select published_snapshot->'blocks'->1->>'block_type' from public.lessons where id = 'lesson-publish-main'), 'callout', 'blocks ordered by page and position');
select extensions.is((select published_snapshot->'lesson' from public.lessons where id = 'lesson-publish-main'),
  '{"title":"Original","description":"Description","cover_image":{"url":"/cover.png"},"estimated_minutes":8,"retry_mode":"cooldown","retry_cooldown_seconds":60,"retry_requires_reread":false,"quiz_requires_lesson_completion":false,"max_earning_attempts":3}'::jsonb,
  'snapshot captures every scoped lesson setting');
select extensions.ok((select not (published_snapshot ? 'quizzes') and not (published_snapshot ? 'tags') from public.lessons where id = 'lesson-publish-main'), 'quiz and tags remain outside snapshot');
reset role;
create temporary table expected_lesson_publish as select published_snapshot, published_at from public.lessons where id = 'lesson-publish-main';
reset role;
select set_config('request.jwt.claim.sub', '90400000-0000-4000-8000-000000000002', true);
set local role authenticated;
select extensions.lives_ok($test$select public.admin_upsert_lesson('lesson-publish-main', 'course-publish-platform', 'Draft title', 'Draft description', '{}', 'published', 0, 99, 'disabled', null, true, true, null)$test$, 'existing upsert keeps compatibility while editing draft settings');
select extensions.lives_ok($test$select public.admin_upsert_lesson_page('page-publish-a', 'lesson-publish-main', 'Draft page', null, 'reflection', 100001, '{}')$test$, 'draft page moves into high autosave range');
select extensions.lives_ok($test$select public.admin_upsert_lesson_page('page-publish-c', 'lesson-publish-main', 'Third edited', null, 'summary', 1, '{}')$test$, 'draft page reordered into original position');
select extensions.lives_ok($test$select public.admin_delete_lesson_page('lesson-publish-main', 'page-publish-b')$test$, 'delete a published page from draft with positive renumbering');
select extensions.is((select array_agg(id order by page_number) from public.lesson_pages where lesson_id = 'lesson-publish-main'), array['page-publish-c','page-publish-a'], 'delete preserves relative order');
select extensions.is((select array_agg(page_number order by page_number) from public.lesson_pages where lesson_id = 'lesson-publish-main'), array[1,2], 'delete compacts page numbers');
select extensions.is((select count(*) from public.lesson_content_blocks where page_id = 'page-publish-b'), 0::bigint, 'delete cascades page blocks');
select extensions.lives_ok($test$select public.admin_upsert_lesson_page('page-publish-new', 'lesson-publish-main', 'Draft only', null, 'concept', 100001, '{}')$test$, 'add draft-only page');
select extensions.lives_ok($test$select public.admin_upsert_lesson_block('90400000-0000-4000-8000-000000000201', 'page-publish-new', 'text', 100001, '{"html":"Draft moved block"}')$test$, 'move existing block onto draft-only page');
select extensions.lives_ok($test$select public.admin_upsert_lesson_block('90400000-0000-4000-8000-000000000204', 'page-publish-a', 'text', 100002, '{}')$test$, 'add draft-only block');
reset role;
select extensions.is((select published_snapshot from public.lessons where id = 'lesson-publish-main'), (select published_snapshot from expected_lesson_publish), 'all draft edits leave published snapshot unchanged');
update public.quizzes set title = 'Edited quiz stays edited' where id = 'quiz-publish-main';
reset role;
select set_config('request.jwt.claim.sub', '90400000-0000-4000-8000-000000000002', true);
set local role authenticated;
select extensions.lives_ok($test$select public.admin_revert_lesson_to_published('lesson-publish-main')$test$, 'restore reordered, deleted, moved and draft-only content');
reset role;
select extensions.is(private.lesson_draft_snapshot('lesson-publish-main'), (select published_snapshot from expected_lesson_publish), 'restored full projection exactly matches published snapshot');
select extensions.is((select published_at from public.lessons where id = 'lesson-publish-main'), (select published_at from expected_lesson_publish), 'revert leaves publication timestamp unchanged');
select extensions.is((select title from public.quizzes where id = 'quiz-publish-main'), 'Edited quiz stays edited', 'revert does not touch quiz');
select extensions.is((select count(*) from public.lesson_page_completions where lesson_id = 'lesson-publish-main' and page_id = 'page-publish-a'), 1::bigint, 'retained page completion survives restore');
select extensions.is((select count(*) from public.lesson_pages where id = 'page-publish-new'), 0::bigint, 'restore drops draft-only page');
select extensions.is((select count(*) from public.lesson_content_blocks where id = '90400000-0000-4000-8000-000000000204'), 0::bigint, 'restore drops draft-only block');
reset role;
select set_config('request.jwt.claim.sub', '90400000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.lives_ok($test$select public.admin_revert_lesson_to_published('lesson-publish-main')$test$, 'platform admin can repeat revert without drift');
select extensions.lives_ok($test$select public.admin_publish_lesson('lesson-publish-empty')$test$, 'empty arrays can be captured with app readiness deferred');
select extensions.lives_ok($test$select public.admin_revert_lesson_to_published('lesson-publish-empty')$test$, 'empty arrays can be restored');
select extensions.throws_ok($test$select public.admin_delete_lesson_page('lesson-publish-org','page-publish-org')$test$, 'P0001', 'A lesson needs at least one page.', 'server rejects deleting final page');
select extensions.throws_ok($test$select public.admin_delete_lesson_page('lesson-publish-main','page-publish-org')$test$, 'P0001', 'Lesson page not found.', 'wrong-lesson page cannot be deleted');
select extensions.throws_ok($test$select public.admin_publish_lesson('lesson-publish-missing')$test$, 'P0001', 'Lesson content editor access required.', 'missing lesson fails closed');
reset role;
update public.lessons set ai_generated = true, ai_publish_status = 'not_ready' where id = 'lesson-publish-empty';
reset role;
select set_config('request.jwt.claim.sub', '90400000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.throws_ok($test$select public.admin_publish_lesson('lesson-publish-empty')$test$, 'P0001', 'AI-generated lessons can only be published after approved text and media.', 'new publish RPC preserves database AI approval guard');
reset role;
update public.lesson_pages set page_number = 2147483647 where id = 'page-publish-c';
update public.lessons set title = 'Overflow draft' where id = 'lesson-publish-main';
reset role;
select set_config('request.jwt.claim.sub', '90400000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.throws_ok($test$select public.admin_revert_lesson_to_published('lesson-publish-main')$test$, 'P0001', 'Lesson content positions exceed the safe renumbering range.', 'overflow fails with recoverable error');
select extensions.is((select title from public.lessons where id = 'lesson-publish-main'), 'Overflow draft', 'failed revert rolls back metadata too');
reset role;
update public.lesson_pages set page_number = 3 where id = 'page-publish-c';
-- Page identity remains reserved even when its editable row is removed.
delete from public.lesson_pages where id = 'page-publish-b';
select extensions.throws_ok($test$insert into public.lesson_pages (id,lesson_id,page_number,title)
values ('page-publish-b','lesson-publish-org',2,'Other tenant')$test$,
'P0001','Lesson page identity belongs to another lesson.','deleted published page ID cannot be reused across tenants');
select extensions.is((select count(*) from public.lesson_pages where id='page-publish-b'),0::bigint,'rejected page reuse leaves no foreign draft row');
insert into public.lesson_content_blocks (id, page_id, block_type, sort_order, payload)
values ('90400000-0000-4000-8000-000000000203','page-publish-org','text',1,'{}');
reset role;
select set_config('request.jwt.claim.sub', '90400000-0000-4000-8000-000000000002', true);
set local role authenticated;
select extensions.throws_ok($test$select public.admin_revert_lesson_to_published('lesson-publish-main')$test$, 'P0001', 'Published content IDs now belong to another lesson.', 'restore rejects reused block ID across tenants');
reset role;
delete from public.lesson_content_blocks where id = '90400000-0000-4000-8000-000000000203';
reset role;
select set_config('request.jwt.claim.sub', '90400000-0000-4000-8000-000000000002', true);
set local role authenticated;
select extensions.lives_ok($test$select public.admin_revert_lesson_to_published('lesson-publish-main')$test$, 'restore succeeds after ID conflict is removed');
select extensions.lives_ok($test$select public.admin_upsert_lesson_page('page-publish-a', 'lesson-publish-main', 'New publication', null, 'concept', 1, '{}')$test$, 'edit page before republishing');
select extensions.lives_ok($test$select public.admin_publish_lesson('lesson-publish-main')$test$, 'republish replaces the single revert point');
select extensions.is((select published_snapshot->'pages'->0->>'title' from public.lessons where id = 'lesson-publish-main'), 'New publication', 'republish captures latest draft');
reset role;
update public.lessons set status = 'archived', title = 'Unpublished draft' where id = 'lesson-publish-main';
reset role;
select set_config('request.jwt.claim.sub', '90400000-0000-4000-8000-000000000002', true);
set local role authenticated;
select extensions.lives_ok($test$select public.admin_revert_lesson_to_published('lesson-publish-main')$test$, 'revert remains available after unpublishing');
select extensions.is((select status::text from public.lessons where id = 'lesson-publish-main'), 'archived', 'revert does not republish archived lesson');
reset role;
select extensions.ok(exists(select 1 from public.audit_events where event_type = 'lesson_published' and entity_id = 'lesson-publish-main' and actor_user_id = '90400000-0000-4000-8000-000000000002' and metadata->>'pageCount' = '3'), 'publish audited with actor and page count');
select extensions.ok(exists(select 1 from public.audit_events where event_type = 'lesson_reverted_to_published' and entity_id = 'lesson-publish-main'), 'revert audited');
select extensions.ok(exists(select 1 from public.audit_events where event_type = 'lesson_page_deleted' and entity_id = 'page-publish-b' and metadata->>'remainingPages' = '2'), 'delete audited');
select * from extensions.finish();
rollback;
