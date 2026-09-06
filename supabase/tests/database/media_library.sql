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
select ok(not has_function_privilege('authenticated','public.service_register_media(uuid,text,text,bigint,text,text,text,uuid,uuid)','execute'),'client cannot register arbitrary storage paths');
select ok(not has_function_privilege('authenticated','private.media_sync(text,text,text,jsonb,boolean,boolean)','execute'),'saved-use helper is private');
select ok(not has_table_privilege('authenticated','private.media_restore_context','insert'),'client cannot forge revert context');
select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is(jsonb_array_length(public.admin_media_library('90500000-0000-4000-8000-000000000101')->'assets'),1,'org library includes own media without a course filter');
select throws_ok($$select public.admin_media_library('90500000-0000-4000-8000-000000000102')$$,'42501','Media editor access required.','cannot list other org library');
select is(jsonb_array_length(public.admin_media_library('90500000-0000-4000-8000-000000000101','platform')->'assets'),0,'platform stock defaults off');
select ok(public.media_delivery('90500000-0000-4000-8000-000000000301','90500000-0000-4000-8000-000000000101') is not null,'org editor can preview own unplaced file');
select ok(public.media_delivery('90500000-0000-4000-8000-000000000302','90500000-0000-4000-8000-000000000101') is null,'cannot preview unpermitted platform stock');
reset role;
select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000003',true);
set local role authenticated;
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000303','share',p_audience=>'all')$$,'23514','Only eligible platform media can be shared.','unsupported rights cannot be approved as stock');
select lives_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000302','share',p_audience=>'selected',p_organizations=>array['90500000-0000-4000-8000-000000000101'::uuid])$$,'catalog manager permits one org');
reset role;
select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is(jsonb_array_length(public.admin_media_library('90500000-0000-4000-8000-000000000102','platform')->'assets'),0,'unselected org cannot discover stock');
select ok(public.media_delivery('90500000-0000-4000-8000-000000000301','90500000-0000-4000-8000-000000000102') is null,'other org cannot obtain private file delivery');
reset role;
select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is(jsonb_array_length(public.admin_media_library('90500000-0000-4000-8000-000000000101','platform')->'assets'),1,'selected org sees approved stock');
select ok(not ((public.admin_media_library('90500000-0000-4000-8000-000000000101','platform')->'assets'->0) ? 'rights_evidence'),'stock projection excludes rights evidence');
-- Use the supported builder save to establish the grant.
select lives_ok($$select public.admin_save_lesson_builder('media-lesson',(select draft_revision from public.lessons where id='media-lesson'),
 '[{"id":"media-page","page_number":1,"title":"Page","page_type":"concept","cover_image":{"url":"/api/media/90500000-0000-4000-8000-000000000302"}},{"id":"media-page-two","page_number":2,"title":"Page Two","page_type":"concept"}]','[]')$$,'successful draft save authorises a placement');
reset role;
select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000003',true);
set local role authenticated;
select lives_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000302','withdraw')$$,'manager withdraws stock');
reset role;
select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.admin_publish_lesson('media-lesson')$$,'saved draft publishes after withdrawal');
select throws_ok($$select public.admin_save_lesson_builder('media-lesson',(select draft_revision from public.lessons where id='media-lesson'),
 '[{"id":"media-page","page_number":1,"title":"Page","page_type":"concept","cover_image":{"url":"/api/media/90500000-0000-4000-8000-000000000302"}},{"id":"media-page-two","page_number":2,"title":"Page Two","page_type":"concept","cover_image":{"url":"/api/media/90500000-0000-4000-8000-000000000302"}}]','[]')$$,'42501','Media permission has changed. Choose a permitted replacement.','new placement after withdrawal denied even inside same org');
select lives_ok($$select public.admin_save_lesson_builder('media-lesson',(select draft_revision from public.lessons where id='media-lesson'),
 '[{"id":"media-page-two","page_number":1,"title":"Page Two","page_type":"concept"}]','[]')$$,'delete draft page retains published use');
select throws_ok($$select public.admin_save_lesson_builder('media-lesson',(select draft_revision from public.lessons where id='media-lesson'),
 '[{"id":"media-page","page_number":1,"title":"Page","page_type":"concept","cover_image":{"url":"/api/media/90500000-0000-4000-8000-000000000302"}}]','[]')$$,'42501','Media permission has changed. Choose a permitted replacement.','client cannot replay a published ID as a new draft use');
select lives_ok($$select public.admin_revert_lesson_to_published('media-lesson')$$,'trusted revert restores withdrawn published placement');
reset role;
select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000004',true);
set local role authenticated;
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','withdraw',p_organization_id=>'90500000-0000-4000-8000-000000000101')$$,'42501','Media manager access required.','content editor cannot manage shared originals');
reset role;
select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000003',true);
set local role authenticated;
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000302','delete')$$,'23514','This version is still used by content.','referenced version cannot be deleted');
select lives_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000302','revoke')$$,'emergency revocation succeeds');
select lives_ok($$select public.admin_dispatch_media_notifications()$$,'existing notification boundary alerts impacted editors');
select is(public.admin_dispatch_media_notifications(),0,'notification delivery is deduplicated');
reset role;
select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000001',true);
set local role authenticated;
select ok(public.media_delivery('90500000-0000-4000-8000-000000000302','90500000-0000-4000-8000-000000000101') is null,'revocation blocks even saved-media delivery');
select is(jsonb_array_length(public.admin_media_issues('90500000-0000-4000-8000-000000000101')),1,'impacted org receives content review flag');
select throws_ok($$select public.admin_publish_lesson('media-lesson')$$,'23514','Replace revoked media before publishing.','republishing identical revoked content is blocked');
select lives_ok($$select public.admin_revert_lesson_to_published('media-lesson')$$,'revert still works with unavailable media');
reset role;
select ok((select status='published' from public.lessons where id='media-lesson'),'revocation leaves existing lesson readable');
select is((select cover_image->>'url' from public.lesson_pages where id='media-page'),'/api/media/90500000-0000-4000-8000-000000000302','existing placement remains pinned to its version');

-- Public delivery depends on a published placement, never on library availability.
select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000003',true);
set local role authenticated;
select lives_ok($$select public.admin_save_lesson_builder('media-platform-lesson',(select draft_revision from public.lessons where id='media-platform-lesson'),
 '[{"id":"media-public-page","page_number":1,"title":"Page","page_type":"concept","cover_image":{"url":"/api/media/90500000-0000-4000-8000-000000000303"}}]','[]')$$,'catalog may use its unshared version in its own content');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select ok(public.media_delivery('90500000-0000-4000-8000-000000000303') is null,'anonymous cannot view draft-only media');
select ok(public.media_delivery('90500000-0000-4000-8000-000000000301') is null,'anonymous cannot view private org media');
reset role;
select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000003',true);
set local role authenticated;
select lives_ok($$select public.admin_publish_lesson('media-platform-lesson')$$,'catalog publishes its saved version');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select ok(public.media_delivery('90500000-0000-4000-8000-000000000303') is not null,'anonymous may view media used in public catalog content');
reset role;
select is((select count(*)::integer from private.media_restore_context),0,'revert markers do not survive operations');
select ok((select not public from storage.buckets where id='learning-media-private'),'new upload bucket is private');
select set_config('request.jwt.claim.sub','90500000-0000-4000-8000-000000000001',true);
set local role authenticated;
select throws_ok($$select public.admin_manage_media('90500000-0000-4000-8000-000000000301','describe',p_title=>'Changed')$$,'42501','Media does not belong to the selected workspace.','manager must target the owning workspace');
select is(public.organization_learning_storage_bytes('90500000-0000-4000-8000-000000000101'),100::bigint,'platform reuse consumes no org storage');
reset role;
-- Migration preserves one identity per bucket/object, and quarantines conflicting ownership.
insert into public.learning_media_assets(course_id,asset_type,placement,source,url,storage_path,metadata)
values
('media-a','image','Legacy A','uploaded','https://example.test/storage/v1/object/public/learning-media/migration.png','migration.png','{"size":10}'),
('media-a','image','Legacy A duplicate','uploaded','https://example.test/storage/v1/object/public/learning-media/migration.png','migration.png','{"size":10}'),
('media-platform','image','Other bucket','uploaded','https://example.test/storage/v1/object/public/other-media/migration.png','migration.png','{"size":10}'),
('media-a','image','Conflicting A','uploaded','https://example.test/storage/v1/object/public/learning-media/conflict.png','conflict.png','{"size":10}'),
('media-b','image','Conflicting B','uploaded','https://example.test/storage/v1/object/public/learning-media/conflict.png','conflict.png','{"size":10}');
select lives_ok($$select private.media_backfill_registry()$$,'legacy registry backfill succeeds with duplicated placements');
select is((select count(*)::integer from private.media_versions where storage_path='migration.png'),2,'same path in distinct buckets retains distinct identities');
select is((select count(*)::integer from private.media_versions where storage_path='conflict.png'),0,'conflicting ownership is not guessed');
select ok(exists(select 1 from private.media_migration_issues where reason='shared_object_multiple_owners'),'ownership conflicts are reported for review');
select lives_ok($$select private.media_backfill_registry()$$,'backfill can be rerun without duplicating files');
select is((select count(*)::integer from private.media_versions where storage_path='migration.png'),2,'backfill keeps stable registry identity');
select ok(not has_function_privilege('authenticated','public.service_close_legacy_media_buckets()','execute'),'client cannot close storage buckets');
select * from finish();
rollback;
