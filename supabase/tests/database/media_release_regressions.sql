begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public,private;
select no_plan();
set local session_replication_role=replica;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
select ('90500000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'authenticated','authenticated','media-'||n||'@example.test','{}','{}' from generate_series(1,5) n;
set local session_replication_role=origin;
set local role service_role;
insert into public.profiles(id,display_name,role) select ('90500000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Media '||n,'learner' from generate_series(1,5)n;
insert into public.organizations(id,slug,name,status,created_by) values
('90500000-0000-4000-8000-000000000101','media-org-a','Media A','published','90500000-0000-4000-8000-000000000001'),
('90500000-0000-4000-8000-000000000102','media-org-b','Media B','published','90500000-0000-4000-8000-000000000002');
insert into public.organization_memberships(organization_id,user_id,role,status) values
('90500000-0000-4000-8000-000000000101','90500000-0000-4000-8000-000000000001','organisation_owner','active'),
('90500000-0000-4000-8000-000000000102','90500000-0000-4000-8000-000000000002','organisation_owner','active'),
('90500000-0000-4000-8000-000000000101','90500000-0000-4000-8000-000000000004','content_editor','active');
insert into public.platform_catalog_memberships(user_id,role,status) values('90500000-0000-4000-8000-000000000003','organisation_admin','active');
insert into public.courses(id,slug,title,description,category,status,catalog_scope,organization_id) values
('media-a','media-a','Media A','Test','Values','draft','organization_private','90500000-0000-4000-8000-000000000101'),
('media-b','media-b','Media B','Test','Values','draft','organization_private','90500000-0000-4000-8000-000000000102'),
('media-platform','media-platform','Platform','Test','Values','published','platform',null);
insert into public.lessons(id,course_id,slug,title,status) values('media-lesson','media-a','media-lesson','Media lesson','draft'),('media-platform-lesson','media-platform','media-platform-lesson','Platform lesson','draft');
insert into public.lesson_pages(id,lesson_id,page_number,title,page_type) values('media-page','media-lesson',1,'Page','concept'),('media-page-two','media-lesson',2,'Page Two','concept'),('media-public-page','media-platform-lesson',1,'Page','concept');
reset role;
-- Deterministic registry fixtures; all behaviours below use supported RPCs or
-- the same row triggers used by public content-save RPCs.
insert into private.media_assets(id,organization_id,title,media_type) values
('90500000-0000-4000-8000-000000000201','90500000-0000-4000-8000-000000000101','Org image','image'),
('90500000-0000-4000-8000-000000000202',null,'Stock image','image');
insert into private.media_versions(id,asset_id,bucket,storage_path,byte_size,mime_type,rights_profile,rights_evidence) values
('90500000-0000-4000-8000-000000000301','90500000-0000-4000-8000-000000000201','learning-media-private','registry/media-a.png',100,'image/png','project_reuse','Test permission'),
('90500000-0000-4000-8000-000000000302','90500000-0000-4000-8000-000000000202','learning-media-private','registry/stock.png',100,'image/png','project_reuse','Test permission'),
('90500000-0000-4000-8000-000000000303','90500000-0000-4000-8000-000000000202','learning-media-private','registry/stock-v2.png',100,'image/png','unverified','');
-- These rollback-only fixtures exercise accepted release rules through public APIs.
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000003',true); set local role authenticated;
select lives_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000302','share',p_audience=>'all',p_organizations=>array[]::uuid[])$$,'all-org stock grant succeeds');
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000002',true); set local role authenticated;
select is(jsonb_array_length(public.admin_media_library('90500000-0000-4000-8000-000000000102','platform')->'assets'),1,'all-org grant includes org B');
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000001',true); set local role authenticated;
select lives_ok($$select public.admin_save_lesson_builder('media-lesson',(select draft_revision from public.lessons where id='media-lesson'),'[{"id":"media-page","page_number":1,"title":"Page","page_type":"concept","cover_image":{"url":"/api/media/90500000-0000-4000-8000-000000000302"}}]','[]')$$,'save stock placement before audience removal');
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000003',true); set local role authenticated;
select lives_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000302','share',p_audience=>'selected',p_organizations=>array['90500000-0000-4000-8000-000000000102'::uuid]::uuid[])$$,'selected removal');
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000001',true); set local role authenticated;
select is(jsonb_array_length(public.admin_media_library('90500000-0000-4000-8000-000000000101','platform')->'assets'),0,'selected removal: stock hidden for new selections');
select lives_ok($$select public.admin_save_lesson_builder('media-lesson',(select draft_revision from public.lessons where id='media-lesson'),'[{"id":"media-page","page_number":1,"title":"Page","page_type":"concept","cover_image":{"url":"/api/media/90500000-0000-4000-8000-000000000302"}}]','[]')$$,'selected removal: existing placement can save');
select lives_ok($$select public.admin_publish_lesson('media-lesson')$$,'selected removal: existing draft publishes');
select lives_ok($$select public.admin_revert_lesson_to_published('media-lesson')$$,'selected removal: trusted revert succeeds');
select ok(public.media_delivery('90500000-0000-4000-8000-000000000302','90500000-0000-4000-8000-000000000101') is not null,'selected removal: saved delivery continues');
select throws_ok($$select public.admin_upsert_lesson_page('new-use','media-lesson','New',p_subtitle=>'',p_page_type=>'concept',p_page_number=>4,p_cover_image=>'{"url":"/api/media/90500000-0000-4000-8000-000000000302"}')$$,'42501','Media permission has changed. Choose a permitted replacement.','selected removal: new placement denied');
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000003',true); set local role authenticated;
select lives_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000302','share',p_audience=>'all',p_organizations=>array[]::uuid[])$$,'restore all-org grant before narrowing');
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000003',true); set local role authenticated;
select lives_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000302','share',p_audience=>'selected',p_organizations=>array['90500000-0000-4000-8000-000000000102'::uuid]::uuid[])$$,'all to selected');
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000001',true); set local role authenticated;
select is(jsonb_array_length(public.admin_media_library('90500000-0000-4000-8000-000000000101','platform')->'assets'),0,'all to selected: stock hidden for new selections');
select lives_ok($$select public.admin_save_lesson_builder('media-lesson',(select draft_revision from public.lessons where id='media-lesson'),'[{"id":"media-page","page_number":1,"title":"Page","page_type":"concept","cover_image":{"url":"/api/media/90500000-0000-4000-8000-000000000302"}}]','[]')$$,'all to selected: existing placement can save');
select lives_ok($$select public.admin_publish_lesson('media-lesson')$$,'all to selected: existing draft publishes');
select lives_ok($$select public.admin_revert_lesson_to_published('media-lesson')$$,'all to selected: trusted revert succeeds');
select ok(public.media_delivery('90500000-0000-4000-8000-000000000302','90500000-0000-4000-8000-000000000101') is not null,'all to selected: saved delivery continues');
select throws_ok($$select public.admin_upsert_lesson_page('new-use','media-lesson','New',p_subtitle=>'',p_page_type=>'concept',p_page_number=>4,p_cover_image=>'{"url":"/api/media/90500000-0000-4000-8000-000000000302"}')$$,'42501','Media permission has changed. Choose a permitted replacement.','all to selected: new placement denied');
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000003',true); set local role authenticated;
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000302','rights',p_rights_evidence=>'Changed rights')$$,'23514','Rights changes require a new version with new evidence.','rights cannot rewrite authorised version');
select is((public.admin_media_library(null,'organization',p_manage=>true)->'assets'->0->>'rights_evidence') is not null,true,'manager can inspect rights evidence');
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000004',true); set local role authenticated;
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','describe',p_title=>'Change',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'42501','Media manager access required.','content editor denied describe');
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','share',p_title=>'Change',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'42501','Media manager access required.','content editor denied share');
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','rights',p_title=>'Change',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'42501','Media manager access required.','content editor denied rights');
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','withdraw',p_title=>'Change',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'42501','Media manager access required.','content editor denied withdraw');
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','revoke',p_title=>'Change',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'42501','Media manager access required.','content editor denied revoke');
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','revoke_asset',p_title=>'Change',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'42501','Media manager access required.','content editor denied revoke_asset');
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','delete',p_title=>'Change',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'42501','Media manager access required.','content editor denied delete');
reset role; update public.organization_memberships set role='programme_manager' where user_id='90500000-0000-4000-8000-000000000004';
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000004',true); set local role authenticated;
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','describe',p_title=>'Change',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'42501','Media manager access required.','programme manager denied describe');
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','share',p_title=>'Change',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'42501','Media manager access required.','programme manager denied share');
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','rights',p_title=>'Change',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'42501','Media manager access required.','programme manager denied rights');
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','withdraw',p_title=>'Change',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'42501','Media manager access required.','programme manager denied withdraw');
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','revoke',p_title=>'Change',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'42501','Media manager access required.','programme manager denied revoke');
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','revoke_asset',p_title=>'Change',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'42501','Media manager access required.','programme manager denied revoke_asset');
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','delete',p_title=>'Change',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'42501','Media manager access required.','programme manager denied delete');
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000001',true); set local role authenticated;
select lives_ok($$select public.admin_upsert_lesson_page('org-draft','media-lesson','Org image',p_subtitle=>'',p_page_type=>'concept',p_page_number=>4,p_cover_image=>'{"url":"/api/media/90500000-0000-4000-8000-000000000301"}')$$,'draft-only org placement');
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','delete',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'23514','This version is still used by content.','draft-only reference prevents deletion');
select lives_ok($$select public.admin_save_lesson_builder('media-lesson',(select draft_revision from public.lessons where id='media-lesson'),'[{"id":"org-draft","page_number":1,"title":"Org image","page_type":"concept"}]','[]')$$,'remove draft stock while retaining published version');
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000003',true); set local role authenticated;
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000302','delete')$$,'23514','This version is still used by content.','published-only reference prevents deletion');
reset role; create function pg_temp.fail_media_notification() returns trigger language plpgsql as $$ begin if new.event_type='media_revoked' then raise exception 'Injected notification failure'; end if; return new; end $$; create trigger test_media_notification_failure before insert on public.user_notifications for each row execute function pg_temp.fail_media_notification();
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000003',true); set local role authenticated;
select lives_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000302','revoke')$$,'revocation committed before dispatch transaction');
select throws_ok($$select public.admin_dispatch_media_notifications()$$,'P0001','Injected notification failure','notification failure is observable');
reset role; select ok(exists(select 1 from private.media_review_flags where version_id='90500000-0000-4000-8000-000000000302'),'review flag survives dispatch failure'); select ok(exists(select 1 from private.media_notification_outbox where version_id='90500000-0000-4000-8000-000000000302' and delivered_at is null),'failed dispatch remains retryable'); drop trigger test_media_notification_failure on public.user_notifications;
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000003',true); set local role authenticated;
select lives_ok($$select public.admin_dispatch_media_notifications()$$,'retry after notification failure succeeds');
select is(public.admin_dispatch_media_notifications(),0,'successful retry is deduplicated');
reset role; select is((select count(*)::integer from public.user_notifications where data->>'versionId'='90500000-0000-4000-8000-000000000302'),1,'exactly affected owner receives notification'); select is((select cta_href from public.user_notifications where data->>'versionId'='90500000-0000-4000-8000-000000000302'),'/admin/media','notification opens replacement review');
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000001',true); set local role authenticated;
select ok(public.media_delivery('90500000-0000-4000-8000-000000000302','90500000-0000-4000-8000-000000000101') is null,'explicit revocation overrides removed-audience saved grant');
reset role; insert into public.organization_memberships(organization_id,user_id,role,status) values('90500000-0000-4000-8000-000000000102','90500000-0000-4000-8000-000000000001','organisation_owner','active');
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000001',true); set local role authenticated;
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','describe',p_title=>'Bad scope',p_organization_id=>'90500000-0000-4000-8000-000000000102')$$,'42501','Media does not belong to the selected workspace.','multi-org manager must select asset owner');
select throws_ok($$select public.admin_upsert_lesson_page('foreign','media-platform-lesson','Forged',p_subtitle=>'',p_page_type=>'concept',p_page_number=>4,p_cover_image=>'{"url":"/api/media/90500000-0000-4000-8000-000000000301"}')$$,'P0001','Lesson content editor access required.','org editor cannot edit catalog destination');
reset role; update public.profiles set role='admin' where id='90500000-0000-4000-8000-000000000005';
reset role; select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000005',true); set local role authenticated;
select throws_ok($$select public.admin_upsert_lesson_page('foreign','media-platform-lesson','Forged',p_subtitle=>'',p_page_type=>'concept',p_page_number=>4,p_cover_image=>'{"url":"/api/media/90500000-0000-4000-8000-000000000301"}')$$,'42501','Organisation media cannot be used outside its owner.','oversight cannot place org-private version in public catalog');
select lives_ok($$select public.admin_upsert_lesson_page('owned-move','media-lesson','Owned',p_subtitle=>'',p_page_type=>'concept',p_page_number=>4,p_cover_image=>'{"url":"/api/media/90500000-0000-4000-8000-000000000301"}')$$,'own version saved before scope move');
select throws_ok($$update public.courses set organization_id=null,catalog_scope='platform' where id='media-a'$$,'23514','Move content by creating authorised copies; media ownership cannot be reassigned.','audience expansion cannot turn private org media into catalog content');
select throws_ok($$update public.lessons set course_id='media-platform' where id='media-lesson'$$,'23514','Move content by creating authorised copies.','lesson parent move cannot carry old authorisations');


-- Complete duplication: media rejection leaves no shell/pages/quiz behind.
reset role;
insert into public.lesson_content_blocks(page_id,block_type,sort_order,payload) values('owned-move','text',1,'{"body":"Copied text"}');
insert into public.quizzes(id,lesson_id,title,status) values('media-release-quiz','media-lesson','Copied quiz','draft');
insert into public.quiz_questions(id,quiz_id,question_order,question_type,prompt,xp) values('media-release-question','media-release-quiz',1,'single_choice','Copied question',10);
insert into public.quiz_options(id,question_id,option_order,label,is_correct) values('media-release-option','media-release-question',1,'Copied answer',true);
set local role authenticated;
select throws_ok($$select public.admin_duplicate_lesson('media-lesson','media-b')$$,'P0001','Lesson not found.','duplicate validates containing course');
select lives_ok($$select public.admin_duplicate_lesson('media-lesson','media-a')$$,'lesson duplicate creates fresh permitted org placements');
select is((select count(*)::integer from public.lessons where course_id='media-a' and title='Copy of Media lesson'),1,'one complete lesson copy');
select is((select count(*)::integer from public.lesson_content_blocks b join public.lesson_pages p on p.id=b.page_id join public.lessons l on l.id=p.lesson_id where l.title='Copy of Media lesson' and b.payload->>'body'='Copied text'),1,'lesson duplicate preserves blocks with new page identities');
select is((select count(*)::integer from public.quiz_options o join public.quiz_questions q on q.id=o.question_id join public.quizzes z on z.id=q.quiz_id join public.lessons l on l.id=z.lesson_id where l.title='Copy of Media lesson' and o.label='Copied answer' and o.is_correct),1,'lesson duplicate preserves quiz answers');
select lives_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','withdraw',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'withdraw org original');
select throws_ok($$select public.admin_duplicate_lesson('media-lesson','media-a')$$,'42501','Media permission has changed. Choose a permitted replacement.','duplicate rejects withdrawn media');
select is((select count(*)::integer from public.lessons where course_id='media-a' and title='Copy of Media lesson'),1,'failed duplicate left no partial shell');
select lives_ok($$select public.admin_upsert_lesson_page('media-public-page','media-platform-lesson','Catalog', '', 'concept',1,'{"url":"/api/media/90500000-0000-4000-8000-000000000303"}')$$,'catalog template has source version');
select lives_ok($$select public.admin_duplicate_course_template('media-platform','Media regression course copy')$$,'course duplication authorises fresh placements');
select lives_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000303','withdraw')$$,'withdraw catalog template media');
select throws_ok($$select public.admin_duplicate_course_template('media-platform','Media denied course copy')$$,'42501','Media permission has changed. Choose a permitted replacement.','course duplication rejects withdrawn version');
select is((select count(*)::integer from public.courses where title='Media denied course copy'),0,'failed course duplication is atomic');
reset role;
-- New versions preserve old rights and references, including withdrawn originals.
create temporary table media_replacements(value jsonb);
insert into media_replacements select public.service_register_media('90500000-0000-4000-8000-000000000101','registry/rights-revision.png','image/png',100,'Revision','Revision','New permission evidence','90500000-0000-4000-8000-000000000201');
select is((select rights_evidence from private.media_versions where id='90500000-0000-4000-8000-000000000301'),'Test permission','replacement does not rewrite earlier rights evidence');
select is((select rights_evidence from private.media_versions where id=(select (value->>'id')::uuid from media_replacements)),'New permission evidence','new version records separate rights');
select ok((select count(*)>0 from private.media_placements where version_id='90500000-0000-4000-8000-000000000301'),'old draft references stay pinned after replacement');
select ok(not exists(select 1 from private.media_placements where version_id=(select (value->>'id')::uuid from media_replacements)),'replacement does not silently update placements');
select throws_ok($$select public.service_register_media('90500000-0000-4000-8000-000000000102','registry/forged-version.png','image/png',100,'Bad','Bad','Test','90500000-0000-4000-8000-000000000201')$$,'42501','Asset ownership mismatch.','registration cannot replace another owner asset');
select lives_ok($$select public.service_register_media('90500000-0000-4000-8000-000000000101','registry/quota-fill.png','image/png',104857400,'Quota','Quota','Test')$$,'registry permits exact quota boundary');
select throws_ok($$select public.service_register_media('90500000-0000-4000-8000-000000000101','registry/quota-over.png','image/png',1,'Quota','Quota','Test')$$,'23514','This upload exceeds the organisation storage allowance.','registry rejects quota overflow');
select ok(not exists(select 1 from private.media_versions where storage_path='registry/quota-over.png'),'quota rejection creates no registry entry');
-- Known derivative provenance blocks removal even without a content placement.
insert into private.media_assets(id,organization_id,title,media_type,source_version_id) values('90500000-0000-4000-8000-000000000299',null,'Derivative','image','90500000-0000-4000-8000-000000000303');
select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000005',true); set local role authenticated;
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000303','delete')$$,'23514','This version is still referenced by media or derivatives.','known derivatives prevent deletion');
select lives_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000303','revoke_asset')$$,'all-version revocation succeeds');
reset role;
select ok(not exists(select 1 from private.media_versions where asset_id='90500000-0000-4000-8000-000000000202' and revoked_at is null),'all existing asset versions are revoked');
-- Registered generation rows and uses in another course also protect deletion.
insert into public.learning_media_assets(id,course_id,asset_type,placement,source,url,metadata)
select '90500000-0000-4000-8000-000000000399','media-a','image','generated','uploaded',value->>'url','{}' from media_replacements;
select throws_ok(format('select public.admin_manage_media(%L, ''delete'', p_organization_id=>%L)',(select value->>'id' from media_replacements),'90500000-0000-4000-8000-000000000101'),'23514','This version is still referenced by media or derivatives.','generation reference prevents deletion');
select lives_ok($$select public.admin_remove_media_placement('90500000-0000-4000-8000-000000000399')$$,'editor can remove generation placement without file deletion');
select ok(exists(select 1 from private.media_versions where id=(select (value->>'id')::uuid from media_replacements)),'removing generation placement preserves original');
-- Cross-course reuse is exercised on a plan that permits multiple courses;
-- the earlier quota checks intentionally used Starter.
insert into public.organization_plan_assignments(organization_id,plan_key,billing_status,assigned_by)
values('90500000-0000-4000-8000-000000000101','team','active','90500000-0000-4000-8000-000000000005')
on conflict(organization_id) where ended_at is null do update set plan_key=excluded.plan_key,billing_status=excluded.billing_status;
insert into public.courses(id,slug,title,description,category,status,catalog_scope,organization_id) values('media-a-second','media-a-second','Second org course','Test','Values','draft','organization_private','90500000-0000-4000-8000-000000000101');
insert into public.lessons(id,course_id,slug,title,status) values('media-second-lesson','media-a-second','media-second-lesson','Second','draft');
select lives_ok(format('select public.admin_upsert_lesson_page(''second-page'',''media-second-lesson'',''Second'','''',''concept'',1,%L::jsonb)',jsonb_build_object('url',(select value->>'url' from media_replacements))),'owned version reusable in a second course');
select throws_ok(format('select public.admin_manage_media(%L, ''delete'', p_organization_id=>%L)',(select value->>'id' from media_replacements),'90500000-0000-4000-8000-000000000101'),'23514','This version is still used by content.','reference in second course prevents deletion');

-- A replacement rights version starts with no stock audience, even when the
-- original was previously offered to all organisations.
reset role;
insert into media_replacements select public.service_register_media(null,'registry/stock-rights-revision.png','image/png',100,'Stock revision','Stock revision','Fresh stock evidence','90500000-0000-4000-8000-000000000202');
select ok((select audience='none' from private.media_versions where storage_path='registry/stock-rights-revision.png'),'new platform rights version requires explicit stock approval');
select ok(not private.media_permitted((select id from private.media_versions where storage_path='registry/stock-rights-revision.png'),'90500000-0000-4000-8000-000000000101'),'new platform version cannot inherit previous audience grant');
select * from finish(); rollback;
