begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public,private;
select no_plan();

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
values ('90600000-0000-4000-8000-000000000001','authenticated','authenticated','authoring-editor@example.test','{}','{}'),
('90610000-0000-4000-8000-000000000002','authenticated','authenticated','authoring-outsider@example.test','{}','{}');
insert into profiles(id,display_name,role) values
('90600000-0000-4000-8000-000000000001','Editor','admin'),('90610000-0000-4000-8000-000000000002','Outsider','learner')
on conflict(id) do update set role=excluded.role;
insert into courses(id,slug,title,description,category,catalog_scope,status)
values('authoring-course','authoring-course','Authoring','Fixture','Values','platform','draft');
insert into lessons(id,slug,course_id,title,status) values('authoring-lesson','authoring-lesson','authoring-course','A lesson','draft');
insert into lesson_pages(id,lesson_id,page_number,title,page_type) values('authoring-existing','authoring-lesson',1,'Existing','concept');

select ok(not has_table_privilege('authenticated','private.ai_authoring_results','select'),'candidate storage is private');
select ok(not has_function_privilege('authenticated','public.service_claim_ai_page(uuid,text)','execute'),'claim is worker only');
select ok(not has_function_privilege('anon','public.admin_read_ai_results(uuid,text,uuid,integer,text)','execute'),'anonymous results denied');
select set_config('test.revision',(select draft_revision::text from lessons where id='authoring-lesson'),true);
select set_config('request.jwt.claim.sub','90600000-0000-4000-8000-000000000001',true);
set local role authenticated;
select set_config('test.result',public.admin_quote_ai_page('authoring-lesson',current_setting('test.revision')::bigint,'A useful idea','concept',1)->>'id',true);
select is(public.admin_read_ai_results(current_setting('test.result')::uuid)->>'stage','quote','quote has no generation');
select is(public.admin_start_ai_page(current_setting('test.result')::uuid)->>'stage','starting','accepted request is durable');
select is(public.admin_start_ai_page(current_setting('test.result')::uuid)->>'id',current_setting('test.result'),'start retry retains intent');
reset role;
select is((select count(*) from ai_generation_jobs where prompt->>'operationId'=current_setting('test.result')),1::bigint,'one job for repeated start');
set local role service_role;
select set_config('test.claim',(select to_jsonb(j)::text from public.service_claim_ai_page(current_setting('test.result')::uuid,'pilot-worker') j),true);
select is((select count(*) from public.service_claim_ai_page(current_setting('test.result')::uuid,'other-worker')),0::bigint,'second worker cannot claim active lease');
select lives_ok($$select public.service_ai_page_checkpoint((current_setting('test.claim')::jsonb->>'id')::uuid,'pilot-worker',
 (current_setting('test.claim')::jsonb->>'lock_token')::uuid,(current_setting('test.claim')::jsonb->>'lock_version')::integer,'begin')$$,'worker begins once');
select throws_ok($$select public.service_ai_page_checkpoint((current_setting('test.claim')::jsonb->>'id')::uuid,'pilot-worker',
 (current_setting('test.claim')::jsonb->>'lock_token')::uuid,(current_setting('test.claim')::jsonb->>'lock_version')::integer,'begin')$$,
 'P0001','A previous provider outcome needs reconciliation.','uncertain call cannot replay');
select lives_ok($$select public.service_ai_page_checkpoint((current_setting('test.claim')::jsonb->>'id')::uuid,'pilot-worker',
 (current_setting('test.claim')::jsonb->>'lock_token')::uuid,(current_setting('test.claim')::jsonb->>'lock_version')::integer,'ready',
 '{"title":"Generated idea","subtitle":"Try it","pageType":"concept","blocks":[{"blockType":"text","payload":{"body":"A useful idea."}},{"blockType":"image","payload":{"mediaIntent":{"version":1,"kind":"image","purpose":"A diagram of shared responsibilities","aspectRatio":"16:9","required":false,"style":"inherit"}}}]}')$$,'validated candidate retained');
reset role;
select is((select count(*) from lesson_pages where lesson_id='authoring-lesson'),1::bigint,'generation does not insert');
set local role authenticated;
select is(public.admin_read_ai_results(current_setting('test.result')::uuid)->>'stage','ready','reopen result after generation');
select is(public.admin_stop_ai_result(current_setting('test.result')::uuid)->>'stage','ready','stop cannot change completed generation');
select is(public.admin_read_ai_results(p_lesson_id=>'authoring-lesson')->'items'->0->>'id',current_setting('test.result'),'lesson results list recovers candidate');
select is(public.admin_read_ai_results(p_lesson_id=>'authoring-lesson')->>'unusedCount','1','lesson results count includes unused candidate');
select ok(exists(select 1 from jsonb_array_elements(public.admin_read_ai_results()->'items') item where item->>'id'=current_setting('test.result')),'catalogue list includes the new candidate');
select lives_ok($$select public.admin_prepare_ai_page_apply(current_setting('test.result')::uuid)$$,'application records durable intent');
select is(public.admin_read_ai_results(current_setting('test.result')::uuid)->>'applicationState','checking','interrupted apply is not falsely not-saved');
select set_config('test.receipt',public.admin_apply_ai_page(current_setting('test.result')::uuid)::text,true);
select is(current_setting('test.receipt')::jsonb->>'status','saved','candidate applies');
select is(public.admin_apply_ai_page(current_setting('test.result')::uuid),current_setting('test.receipt')::jsonb,'apply retry returns same receipt');
select is(public.admin_read_ai_results(current_setting('test.result')::uuid)->>'applicationState','saved','recovered application confirms saved');
reset role;
select is((select count(*) from lesson_pages where lesson_id='authoring-lesson'),2::bigint,'apply inserts exactly once');
select is((select page_number from lesson_pages where id='authoring-existing'),2,'insertion preserves existing page and order');
select ok((select published_snapshot is null from lessons where id='authoring-lesson'),'application does not publish');
select is((select count(*) from learning_media_assets where course_id='authoring-course'),0::bigint,'no media seeded or generated');
delete from ai_generation_jobs where id=(current_setting('test.claim')::jsonb->>'id')::uuid;
set local role authenticated;
select is(public.admin_read_ai_results(current_setting('test.result')::uuid)->>'stage','ready','job pruning preserves candidate and receipt');
select set_config('test.stale',public.admin_quote_ai_page('authoring-lesson',(current_setting('test.receipt')::jsonb->>'draftRevision')::bigint,'Another','concept',3)->>'id',true);
select public.admin_start_ai_page(current_setting('test.stale')::uuid);
select is(public.admin_stop_ai_result(current_setting('test.stale')::uuid)->>'stage','stopped','stop before provider is terminal');
reset role;
select is((select status from ai_generation_jobs where prompt->>'operationId'=current_setting('test.stale')),'failed','stopped request cannot be claimed');
select set_config('request.jwt.claim.sub','90610000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok($$select public.admin_read_ai_results(current_setting('test.result')::uuid)$$,'42501','Result unavailable.','outsider cannot recover another result');
select throws_ok($$select public.admin_apply_ai_page(current_setting('test.result')::uuid)$$,'42501','Page result unavailable.','receipt does not bypass current access');
reset role;
select set_config('request.jwt.claim.sub','90600000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.admin_delete_ai_result(current_setting('test.result')::uuid)$$,'editor can explicitly remove retained candidate');
select is(public.admin_read_ai_results(current_setting('test.result')::uuid)->'candidate','null'::jsonb,'deleted candidate body removed');
select is(public.admin_read_ai_results(current_setting('test.result')::uuid)->'receipt'->>'status','saved','deletion preserves saved outcome');
reset role;
select is((select count(*) from lesson_pages where lesson_id='authoring-lesson'),2::bigint,'deleting result retains applied content');

-- Organisation allocation: reservation at start, release before provider,
-- started work charged once, and insufficient-credit rejection.
insert into organizations(id,slug,name,status,created_by) values('90600000-0000-4000-8000-000000000101','authoring-org','Authoring org','published','90600000-0000-4000-8000-000000000001');
insert into organization_memberships(organization_id,user_id,role,status) values('90600000-0000-4000-8000-000000000101','90600000-0000-4000-8000-000000000001','organisation_owner','active');
insert into courses(id,slug,title,description,category,catalog_scope,organization_id,status)
values('authoring-org-course','authoring-org-course','Organisation course','Fixture','Values','organization_private','90600000-0000-4000-8000-000000000101','draft');
insert into lessons(id,slug,course_id,title,status) values('authoring-org-lesson','authoring-org-lesson','authoring-org-course','Organisation lesson','draft');
set local role authenticated;
select public.admin_upsert_organization_temporary_entitlement_grant(null,'90600000-0000-4000-8000-000000000101','granular_override',null,
 '{"ai_authoring_enabled":true,"ai_monthly_allocation":80,"ai_hard_limit":80,"ai_user_rate_limit_per_day":20,"ai_organization_concurrency_limit":3,"allowed_ai_operation_types":["ai_lesson_page_extension"],"allowed_ai_roles":["organisation_owner"]}',
 now()-interval '1 minute',now()+interval '1 day','Authoring fixture');
select set_config('test.org',public.admin_quote_ai_page('authoring-org-lesson',0,'Org idea','concept',1)->>'id',true);
select is(public.admin_read_ai_results(current_setting('test.org')::uuid)->'credit','{}'::jsonb,'quote reserves no allocation');
select public.admin_start_ai_page(current_setting('test.org')::uuid);
select public.admin_start_ai_page(current_setting('test.org')::uuid);
reset role;
select is((select sum(reserved_units) from organization_ai_usage_records where organization_id='90600000-0000-4000-8000-000000000101'),40::numeric,'repeated start reserves only 40 credits');
set local role authenticated;
select public.admin_stop_ai_result(current_setting('test.org')::uuid);
select is(public.admin_read_ai_results(current_setting('test.org')::uuid)->'credit'->>'status','released','stop before dispatch releases credits');
select set_config('test.org2',public.admin_quote_ai_page('authoring-org-lesson',0,'Org second','concept',1)->>'id',true);
select public.admin_start_ai_page(current_setting('test.org2')::uuid);
reset role;
set local role service_role;
select set_config('test.claim',(select to_jsonb(j)::text from public.service_claim_ai_page(current_setting('test.org2')::uuid,'org-worker') j),true);
select public.service_ai_page_checkpoint((current_setting('test.claim')::jsonb->>'id')::uuid,'org-worker',
 (current_setting('test.claim')::jsonb->>'lock_token')::uuid,(current_setting('test.claim')::jsonb->>'lock_version')::integer,'begin');
reset role;
set local role authenticated;
select is(public.admin_stop_ai_result(current_setting('test.org2')::uuid)->>'stage','writing','stop during provider waits for its outcome');
reset role;
set local role service_role;
select public.service_ai_page_checkpoint((current_setting('test.claim')::jsonb->>'id')::uuid,'org-worker',
 (current_setting('test.claim')::jsonb->>'lock_token')::uuid,(current_setting('test.claim')::jsonb->>'lock_version')::integer,'ready',
 '{"title":"Org generated","subtitle":"","pageType":"concept","blocks":[{"blockType":"text","payload":{"body":"An idea."}}]}');
reset role;
set local role authenticated;
select is(public.admin_read_ai_results(current_setting('test.org2')::uuid)->>'stage','ready','stopping retains completed output');
select is(public.admin_read_ai_results(current_setting('test.org2')::uuid)->'credit'->>'used','40','completed call settles 40 credits');
select public.admin_stop_ai_result(current_setting('test.org2')::uuid);
select is(public.admin_read_ai_results(current_setting('test.org2')::uuid)->'credit'->>'used','40','stop on ready does not imply refund');
reset role;
update lessons set title='Edited during generation' where id='authoring-org-lesson';
set local role authenticated;
select public.admin_prepare_ai_page_apply(current_setting('test.org2')::uuid);
select is(public.admin_apply_ai_page(current_setting('test.org2')::uuid)->>'status','not_saved','stale source cannot overwrite current lesson');
select is(public.admin_read_ai_results(current_setting('test.org2')::uuid)->>'applicationState','not_saved','confirmed conflict is recoverable after navigation');
select ok(public.admin_read_ai_results(current_setting('test.org2')::uuid)->'candidate'<>'null'::jsonb,'conflict retains candidate');
reset role;
select is((select count(*) from lesson_pages where lesson_id='authoring-org-lesson'),0::bigint,'stale apply made no writes');
select set_config('test.revision',(select draft_revision::text from lessons where id='authoring-org-lesson'),true);
set local role authenticated;
select set_config('test.org3',public.admin_quote_ai_page('authoring-org-lesson',current_setting('test.revision')::bigint,'Refine','concept',1,current_setting('test.org2')::uuid,'Use the revised lesson')->>'id',true);
select public.admin_start_ai_page(current_setting('test.org3')::uuid);
reset role;
set local role service_role;
select set_config('test.claim',(select to_jsonb(j)::text from public.service_claim_ai_page(current_setting('test.org3')::uuid,'org-worker') j),true);
select public.service_ai_page_checkpoint((current_setting('test.claim')::jsonb->>'id')::uuid,'org-worker',
 (current_setting('test.claim')::jsonb->>'lock_token')::uuid,(current_setting('test.claim')::jsonb->>'lock_version')::integer,'begin');
select public.service_ai_page_checkpoint((current_setting('test.claim')::jsonb->>'id')::uuid,'org-worker',
 (current_setting('test.claim')::jsonb->>'lock_token')::uuid,(current_setting('test.claim')::jsonb->>'lock_version')::integer,'failed');
reset role;
set local role authenticated;
select is(public.admin_read_ai_results(current_setting('test.org3')::uuid)->'credit'->>'used','40','uncertain started call charges accepted estimate');
select ok(public.admin_read_ai_results(current_setting('test.org2')::uuid)->'candidate'<>'null'::jsonb,'failed refinement preserves previous candidate');
select set_config('test.org4',public.admin_quote_ai_page('authoring-org-lesson',current_setting('test.revision')::bigint,'Another','concept',1)->>'id',true);
select throws_ok($$select public.admin_start_ai_page(current_setting('test.org4')::uuid)$$,'P0001','Organization AI hard limit would be exceeded.','hard limit blocks another reservation');
reset role;
select is((select sum(final_charged_units) from organization_ai_usage_records where organization_id='90600000-0000-4000-8000-000000000101'),80::numeric,'no double charge or leaked reservation');
select set_config('request.jwt.claim.sub','90600000-0000-4000-8000-000000000001',true);
select is((select count(*) from lesson_content_blocks b join lesson_pages p on p.id=b.page_id where p.lesson_id='authoring-lesson' and b.payload->'mediaIntent'->>'purpose'='A diagram of shared responsibilities'),1::bigint,'media intent persists on application');
select set_config('test.publish_revision',(select draft_revision::text from lessons where id='authoring-lesson'),true);
set local role authenticated;
select lives_ok($$select public.admin_publish_lesson_checked('authoring-lesson',current_setting('test.publish_revision')::bigint)$$,'optional placeholder does not block publication');
reset role;
update lesson_content_blocks set payload=jsonb_set(payload,'{mediaIntent,required}','true') where page_id in (select id from lesson_pages where lesson_id='authoring-lesson') and payload ? 'mediaIntent';
select set_config('test.publish_revision',(select draft_revision::text from lessons where id='authoring-lesson'),true);
set local role authenticated;
select lives_ok($$select public.admin_publish_lesson_checked('authoring-lesson',current_setting('test.publish_revision')::bigint)$$,'legacy required inline placeholder does not block publication');
reset role;

-- Assistant requests infer scope and placement from private lesson content.
select set_config('test.revision',(select draft_revision::text from lessons where id='authoring-lesson'),true);
set local role authenticated;
select set_config('test.assistant',public.admin_quote_ai_page('authoring-lesson',current_setting('test.revision')::bigint,'','auto',1)->>'id',true);
select is(public.admin_read_ai_results(current_setting('test.assistant')::uuid)->>'assistant','true','assistant quote requires no editorial decisions');
select is(public.admin_read_ai_results(current_setting('test.assistant')::uuid)->'credit','{}'::jsonb,'assistant quote costs nothing until accepted');
select ok(not (public.admin_read_ai_results(current_setting('test.assistant')::uuid) ? 'context'),'private teaching context is not exposed by result reads');
select public.admin_start_ai_page(current_setting('test.assistant')::uuid);
reset role;
set local role service_role;
select set_config('test.assistant_claim',(select to_jsonb(j)::text from public.service_claim_ai_page(current_setting('test.assistant')::uuid,'assistant-worker') j),true);
select set_config('test.assistant_context',public.service_ai_page_checkpoint((current_setting('test.assistant_claim')::jsonb->>'id')::uuid,'assistant-worker',
 (current_setting('test.assistant_claim')::jsonb->>'lock_token')::uuid,(current_setting('test.assistant_claim')::jsonb->>'lock_version')::integer,'begin')::text,true);
select ok((current_setting('test.assistant_context')::jsonb->'existingPages'->0->>'content') like '%A useful idea.%','worker sees actual teaching content, not just titles');
select throws_ok($$select public.service_ai_page_checkpoint((current_setting('test.assistant_claim')::jsonb->>'id')::uuid,'assistant-worker',
 (current_setting('test.assistant_claim')::jsonb->>'lock_token')::uuid,(current_setting('test.assistant_claim')::jsonb->>'lock_version')::integer,'ready',
 '{"decision":"page","reason":"A useful example","position":99,"title":"New example","subtitle":"","pageType":"scenario","blocks":[{"blockType":"text","payload":{"body":"An example."}}]}')$$,
 'P0001','Invalid recommended position.','worker cannot persist an out-of-range inferred placement');
select lives_ok($$select public.service_ai_page_checkpoint((current_setting('test.assistant_claim')::jsonb->>'id')::uuid,'assistant-worker',
 (current_setting('test.assistant_claim')::jsonb->>'lock_token')::uuid,(current_setting('test.assistant_claim')::jsonb->>'lock_version')::integer,'ready',
 '{"decision":"page","reason":"An example makes the idea practical.","position":1,"title":"New example","subtitle":"","pageType":"scenario","blocks":[{"blockType":"text","payload":{"body":"An example."}}]}')$$,'valid assistant page retained');
reset role;
set local role authenticated;
select is(public.admin_read_ai_results(current_setting('test.assistant')::uuid)->>'position','1','recommendation overrides the initial end-of-lesson position');
select is(public.admin_apply_ai_page(current_setting('test.assistant')::uuid)->'page'->>'page_number','1','explicit application honours recommended placement');
reset role;
select set_config('test.revision',(select draft_revision::text from lessons where id='authoring-lesson'),true);
select set_config('test.page_count',(select count(*)::text from lesson_pages where lesson_id='authoring-lesson'),true);
set local role authenticated;
select set_config('test.complete',public.admin_quote_ai_page('authoring-lesson',current_setting('test.revision')::bigint,'','auto',1)->>'id',true);
select public.admin_start_ai_page(current_setting('test.complete')::uuid);
reset role;
set local role service_role;
select set_config('test.complete_claim',(select to_jsonb(j)::text from public.service_claim_ai_page(current_setting('test.complete')::uuid,'assistant-worker') j),true);
select public.service_ai_page_checkpoint((current_setting('test.complete_claim')::jsonb->>'id')::uuid,'assistant-worker',
 (current_setting('test.complete_claim')::jsonb->>'lock_token')::uuid,(current_setting('test.complete_claim')::jsonb->>'lock_version')::integer,'begin');
select lives_ok($$select public.service_ai_page_checkpoint((current_setting('test.complete_claim')::jsonb->>'id')::uuid,'assistant-worker',
 (current_setting('test.complete_claim')::jsonb->>'lock_token')::uuid,(current_setting('test.complete_claim')::jsonb->>'lock_version')::integer,'ready',
 '{"decision":"review_quiz","reason":"The explanation and example cover this lesson.","position":1,"title":"Review the quiz","subtitle":"","pageType":"concept","blocks":[]}')$$,'assistant can finish without inventing another page');
reset role;
set local role authenticated;
select is(public.admin_read_ai_results(current_setting('test.complete')::uuid)->'candidate'->>'decision','review_quiz','no-page suggestion survives recovery');
select throws_ok($$select public.admin_prepare_ai_page_apply(current_setting('test.complete')::uuid)$$,'PT409','This recommendation does not add a page.','cannot begin applying a no-page recommendation');
select throws_ok($$select public.admin_apply_ai_page(current_setting('test.complete')::uuid)$$,'PT409','This recommendation does not add a page.','direct RPC cannot bypass no-page boundary');
select is(public.admin_read_ai_results(current_setting('test.complete')::uuid)->>'applicationState','not_started','recommendation is not marked as saving or published');
reset role;
select is((select count(*)::text from lesson_pages where lesson_id='authoring-lesson'),current_setting('test.page_count'),'no-page recommendation inserts nothing');

select * from finish();
rollback;
