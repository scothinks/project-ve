begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public,private;
select no_plan();
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
('90700000-0000-4000-8000-000000000001','authenticated','authenticated','cutover-editor@example.test','{}','{}'),
('90710000-0000-4000-8000-000000000002','authenticated','authenticated','cutover-outsider@example.test','{}','{}');
insert into profiles(id,display_name,role) values ('90700000-0000-4000-8000-000000000001','Editor','admin'),('90710000-0000-4000-8000-000000000002','Outsider','learner') on conflict(id) do update set role=excluded.role;
insert into courses(id,slug,title,description,category,catalog_scope,status,ai_generated) values('cutover-course','cutover-course','Choices','Listen before deciding.','Values','platform','draft',true),('cutover-other','cutover-other','Other','Other','Values','platform','draft',false);
insert into lessons(id,slug,course_id,title,status,ai_generated,quiz_requires_lesson_completion) values('cutover-lesson','cutover-lesson','cutover-course','Listening','draft',true,false),('cutover-other-lesson','cutover-other-lesson','cutover-other','Other','draft',false,false);
insert into lesson_pages(id,lesson_id,page_number,title,page_type) values('cutover-page','cutover-lesson',1,'Listen','concept'),('cutover-other-page','cutover-other-lesson',1,'Other','concept');
insert into lesson_content_blocks(id,page_id,block_type,sort_order,payload) values('90700000-0000-4000-8000-000000000101','cutover-page','text',1,'{"body":"Listen to each person before deciding."}');
insert into private.media_assets(id,organization_id,title,media_type) values('90700000-0000-4000-8000-000000000201',null,'Cutover images','image');
insert into private.media_versions(id,asset_id,bucket,storage_path,byte_size,mime_type,alt_text,rights_profile,rights_evidence) values
('90700000-0000-4000-8000-000000000301','90700000-0000-4000-8000-000000000201','learning-media-private','registry/cutover-1.png',100,'image/png','People listening','project_reuse','Fixture permission'),
('90700000-0000-4000-8000-000000000302','90700000-0000-4000-8000-000000000201','learning-media-private','registry/cutover-2.png',100,'image/png','Another image','project_reuse','Fixture permission');
select set_config('request.jwt.claim.sub','90700000-0000-4000-8000-000000000001',true);
insert into learning_media_assets(id,course_id,lesson_id,asset_type,placement,prompt,url,alt_text,review_status,generation_status,metadata,sort_order) values
('90700000-0000-4000-8000-000000000401','cutover-course','cutover-lesson','image','listening','A listening circle','/api/media/90700000-0000-4000-8000-000000000301','People listening','approved','completed','{"targetKind":"page_block","targetPageId":"cutover-page","required":true}',1),
('90700000-0000-4000-8000-000000000402','cutover-course','cutover-lesson','image','optional diagram','Compare choices',null,null,'draft','pending','{"targetKind":"page_block","targetPageId":"cutover-page","required":true}',2),
('90700000-0000-4000-8000-000000000403','cutover-course','cutover-lesson','audio','somewhere','Hear the conversation',null,null,'draft','pending','{}',3),
('90700000-0000-4000-8000-000000000404','cutover-course','cutover-lesson','image','page cover','A cover','/api/media/90700000-0000-4000-8000-000000000301','Cover','approved','completed','{"targetKind":"page_cover","targetPageId":"cutover-page"}',4),
('90700000-0000-4000-8000-000000000405','cutover-course',null,'cover','course_cover','Course cover','/api/media/90700000-0000-4000-8000-000000000301','Cover','approved','completed','{"targetKind":"course_cover"}',5);
insert into lesson_content_blocks(id,page_id,block_type,sort_order,payload) values('90700000-0000-4000-8000-000000000102','cutover-page','image',2,'{"src":"/api/media/90700000-0000-4000-8000-000000000301","alt":"People listening","aiManagedByAssetId":"90700000-0000-4000-8000-000000000401"}');
update lesson_pages set cover_image='{"src":"/api/media/90700000-0000-4000-8000-000000000302","alt":"Another image"}' where id='cutover-page';
set local role authenticated;
select public.admin_review_ai_assistance_lesson('cutover-lesson',(select draft_revision from lessons where id='cutover-lesson'));
select public.admin_publish_lesson('cutover-lesson');
reset role;
select set_config('test.snapshot',(select published_snapshot::text from lessons where id='cutover-lesson'),true);
select set_config('test.assets',(select jsonb_agg(to_jsonb(a) order by id)::text from learning_media_assets a where course_id='cutover-course'),true);
select ok(not has_function_privilege('authenticated','private.map_legacy_ai_media(uuid,text,text)','execute'),'mapping helper private');
select ok(not has_table_privilege('authenticated','private.ai_legacy_media_mappings','select'),'audit source not exposed directly');
select ok(not has_function_privilege('anon','public.admin_legacy_ai_media_workspace(text)','execute'),'anonymous workspace denied');
set local role authenticated;
select lives_ok($$select public.admin_map_legacy_ai_media('cutover-course')$$,'map exact legacy destinations');
reset role;
select is((select status from private.ai_legacy_media_mappings where asset_id='90700000-0000-4000-8000-000000000401'),'mapped','populated managed block mapped');
select is((select status from private.ai_legacy_media_mappings where asset_id='90700000-0000-4000-8000-000000000402'),'mapped','empty exact page brief creates placeholder');
select is((select payload->'mediaIntent'->>'required' from lesson_content_blocks where id='90700000-0000-4000-8000-000000000402'),'false','legacy inline required flag becomes optional placeholder');
select is((select payload->>'src' from lesson_content_blocks where id='90700000-0000-4000-8000-000000000102'),'/api/media/90700000-0000-4000-8000-000000000301','populated asset remains selected');
select is((select status from private.ai_legacy_media_mappings where asset_id='90700000-0000-4000-8000-000000000403'),'needs_resolution','ambiguous audio not guessed or converted');
select is((select status from private.ai_legacy_media_mappings where asset_id='90700000-0000-4000-8000-000000000404'),'needs_resolution','conflicting cover reports resolution');
select is((select cover_image->>'src' from lesson_pages where id='cutover-page'),'/api/media/90700000-0000-4000-8000-000000000302','selected conflicting cover untouched');
select is((select published_snapshot::text from lessons where id='cutover-lesson'),current_setting('test.snapshot'),'published snapshot unchanged');
select is((select jsonb_agg(to_jsonb(a) order by id)::text from learning_media_assets a where course_id='cutover-course'),current_setting('test.assets'),'original assets prompts types metadata approvals retained exactly');
select is((select original->>'prompt' from private.ai_legacy_media_mappings where asset_id='90700000-0000-4000-8000-000000000403'),'Hear the conversation','audit retains ambiguous source');
select set_config('test.revision',(select draft_revision::text from lessons where id='cutover-lesson'),true);
set local role authenticated;
select public.admin_map_legacy_ai_media('cutover-course');
reset role;
select is((select draft_revision::text from lessons where id='cutover-lesson'),current_setting('test.revision'),'repeat mapping does not touch mapped draft');
select is((select count(*) from lesson_content_blocks where page_id='cutover-page'),3::bigint,'repeat mapping does not duplicate blocks');
select is((select count(*) from ai_generation_jobs where entity_id='cutover-course'),0::bigint,'mapping never creates jobs or credits');
set local role authenticated;
select public.admin_map_legacy_ai_media('cutover-course','90700000-0000-4000-8000-000000000403','page_block','cutover-other-page');
reset role;
select is((select status from private.ai_legacy_media_mappings where asset_id='90700000-0000-4000-8000-000000000403'),'needs_resolution','cross-course explicit mapping refused');
set local role authenticated;
select public.admin_map_legacy_ai_media('cutover-course','90700000-0000-4000-8000-000000000403','page_block','cutover-page');
reset role;
select is((select block_type::text from lesson_content_blocks where id='90700000-0000-4000-8000-000000000403'),'audio','explicit audio mapping keeps media kind');
select set_config('request.jwt.claim.sub','90710000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok($$select public.admin_map_legacy_ai_media('cutover-course')$$,'42501','Course editing access required.','outsider cannot migrate');
select throws_ok($$select public.admin_legacy_ai_media_workspace('cutover-course')$$,'42501','Course editing access required.','outsider cannot inspect briefs or credits');
reset role;
select set_config('request.jwt.claim.sub','90700000-0000-4000-8000-000000000001',true);

insert into learning_media_assets(id,lesson_id,asset_type,placement,prompt,metadata,sort_order) values
('90700000-0000-4000-8000-000000000406','cutover-lesson','image','Lesson-only brief','Compare two choices','{"targetKind":"page_block","targetPageId":"cutover-page"}',6),
('90700000-0000-4000-8000-000000000407','cutover-lesson','cover','lesson_cover','A lesson cover','{"targetKind":"lesson_thumbnail","required":true}',7);
set local role authenticated;
select public.admin_map_legacy_ai_media('cutover-course');
reset role;
select is((select course_id from learning_media_assets where id='90700000-0000-4000-8000-000000000406'),'cutover-course','lesson-only legacy parent resolved without guessing');
select is((select original->'course_id' from private.ai_legacy_media_mappings where asset_id='90700000-0000-4000-8000-000000000406'),'null'::jsonb,'original lesson-only provenance remains in audit');
select is((select status from private.ai_legacy_media_mappings where asset_id='90700000-0000-4000-8000-000000000406'),'mapped','lesson-only brief mapped to optional block');
set local role authenticated;
select throws_ok($$select public.admin_review_ai_assistance_lesson('cutover-lesson',(select draft_revision from lessons where id='cutover-lesson'))$$,'22023','Complete the required lesson cover before reviewing.','missing required cover still blocks review');
select public.admin_set_editorial_cover('lesson_thumbnail','cutover-lesson','90700000-0000-4000-8000-000000000302');
reset role;
select is((select url from learning_media_assets where id='90700000-0000-4000-8000-000000000407'),'/api/media/90700000-0000-4000-8000-000000000302','cover chooser updates existing required identity');
-- Review old drafts without satisfying old inline seed batches; explicit approval still required.
set local role authenticated;
select lives_ok($$select public.admin_set_ai_course_artwork('cutover-course','90700000-0000-4000-8000-000000000301','course_thumbnail')$$,'legacy course artwork uses contextual boundary');
select lives_ok($$select public.admin_review_ai_assistance_lesson('cutover-lesson',(select draft_revision from lessons where id='cutover-lesson'))$$,'legacy lesson review ignores empty required inline seeds');
select lives_ok($$select public.admin_review_ai_authored_course('cutover-course',(select updated_at from courses where id='cutover-course'),jsonb_build_object('cutover-lesson',(select draft_revision from lessons where id='cutover-lesson')))$$,'legacy course review uses current revision boundary');
reset role;
select is((select text_approved_by from lessons where id='cutover-lesson'),'90700000-0000-4000-8000-000000000001'::uuid,'explicit review records actor');
select is((select status::text from courses where id='cutover-course'),'draft','review never auto publishes');
set local role authenticated;
select lives_ok($$select public.admin_publish_ai_authored_course('cutover-course',(select updated_at from courses where id='cutover-course'),jsonb_build_object('cutover-lesson',(select draft_revision from lessons where id='cutover-lesson')))$$,'reviewed legacy course publishes with optional placeholders');
reset role;
-- Existing queued choices retain their original jobs. Running jobs are not paused.
insert into ai_generation_jobs(id,entity_type,entity_id,job_type,status,prompt,attempt_count) values
('90700000-0000-4000-8000-000000000501','course','cutover-course','media_assets','queued','{"mode":"course_media"}',0),
('90700000-0000-4000-8000-000000000502','course','cutover-course','media_assets','queued','{"mode":"course_media"}',0),
('90700000-0000-4000-8000-000000000503','course','cutover-course','media_assets','running','{"mode":"course_media"}',1);
insert into private.ai_legacy_job_choices(job_id) values('90700000-0000-4000-8000-000000000501'),('90700000-0000-4000-8000-000000000502');
update ai_generation_jobs set available_at='1970-01-01' where id in ('90700000-0000-4000-8000-000000000501','90700000-0000-4000-8000-000000000502');
update ai_generation_jobs set available_at='1971-01-01' where id='90700000-0000-4000-8000-000000000503';
set local role service_role;
select is((select id from public.claim_ai_generation_job('cutover-worker')),'90700000-0000-4000-8000-000000000503'::uuid,'pending queued work excluded while running legacy work retains recovery');
reset role;
set local role authenticated;
select is(public.admin_legacy_ai_media_workspace('cutover-course')->'jobs'->0->>'creditStatus','unmetered','legacy unmetered state explicit');
select public.admin_map_legacy_ai_media('cutover-course','90700000-0000-4000-8000-000000000404');
reset role;
select is((select status from private.ai_legacy_media_mappings where asset_id='90700000-0000-4000-8000-000000000404'),'deferred','pending legacy work defers mapping');
select ok(position('ai_legacy_job_choices' in pg_get_functiondef('public.claim_ai_generation_job(text,integer,integer)'::regprocedure))>0,'claim excludes unconfirmed choices at database boundary');
set local role authenticated;
select public.admin_decide_legacy_ai_job('90700000-0000-4000-8000-000000000501','continue');
select lives_ok($$select public.admin_decide_legacy_ai_job('90700000-0000-4000-8000-000000000501','continue')$$,'continue is idempotent');
select public.admin_decide_legacy_ai_job('90700000-0000-4000-8000-000000000502','cancel');
select lives_ok($$select public.admin_decide_legacy_ai_job('90700000-0000-4000-8000-000000000502','cancel')$$,'cancel is idempotent');
select throws_ok($$select public.admin_decide_legacy_ai_job('90700000-0000-4000-8000-000000000501','cancel')$$,'PT409','This request already changed. Refresh its status.','opposing choice cannot replay');
select throws_ok($$select public.admin_decide_legacy_ai_job('90700000-0000-4000-8000-000000000503','cancel')$$,'22023','Choose a pending earlier request.','running lease cannot be cancelled by queued choice');
reset role;
select is((select status from ai_generation_jobs where id='90700000-0000-4000-8000-000000000502'),'failed','cancel ends original job without new job');
select is((select status from ai_generation_jobs where id='90700000-0000-4000-8000-000000000503'),'running','running work retains state');
select is((select count(*) from ai_generation_jobs where entity_id='cutover-course'),3::bigint,'decisions never duplicate accepted work');

insert into organizations(id,slug,name,status,created_by) values('90700000-0000-4000-8000-000000000601','cutover-org','Cutover Org','published','90700000-0000-4000-8000-000000000001');
insert into organization_memberships(organization_id,user_id,role,status) values('90700000-0000-4000-8000-000000000601','90700000-0000-4000-8000-000000000001','organisation_owner','active');
insert into courses(id,slug,title,description,category,catalog_scope,organization_id,status) values('cutover-org-course','cutover-org-course','Org','Teaching','Values','organization_private','90700000-0000-4000-8000-000000000601','draft');
set local role authenticated;
select public.admin_upsert_organization_temporary_entitlement_grant(null,'90700000-0000-4000-8000-000000000601','granular_override',null,
 '{"ai_authoring_enabled":true,"ai_monthly_allocation":250,"ai_hard_limit":250,"max_storage_bytes":104857600,"ai_user_rate_limit_per_day":20,"ai_organization_concurrency_limit":3,"allowed_ai_operation_types":["ai_single_media_asset"],"allowed_ai_roles":["organisation_owner"]}',
 now()-interval '1 minute',now()+interval '1 day','Cutover fixture');

select set_config('test.job',public.create_organization_ai_generation_job(p_actor_user_id=>'90700000-0000-4000-8000-000000000001',p_organization_id=>'90700000-0000-4000-8000-000000000601',p_job_type=>'media_assets',p_prompt=>'{"mode":"course_media"}',p_entity_id=>'cutover-org-course',p_idempotency_key=>'cutover-fixture-0',p_operation_type=>'ai_single_media_asset',p_estimated_units=>75,p_course_id=>'cutover-org-course')->>'jobId',true);
select public.admin_decide_legacy_ai_job(current_setting('test.job')::uuid,'continue');
reset role;
select is((select status from organization_ai_usage_records where source_id=current_setting('test.job')),'reserved','continue preserves correct metering after attempt count 0');
select is((select reserved_units from organization_ai_usage_records where source_id=current_setting('test.job')),75::numeric,'continue retains original reservation');
set local role authenticated;

select set_config('test.job',public.create_organization_ai_generation_job(p_actor_user_id=>'90700000-0000-4000-8000-000000000001',p_organization_id=>'90700000-0000-4000-8000-000000000601',p_job_type=>'media_assets',p_prompt=>'{"mode":"course_media"}',p_entity_id=>'cutover-org-course',p_idempotency_key=>'cutover-fixture-1',p_operation_type=>'ai_single_media_asset',p_estimated_units=>75,p_course_id=>'cutover-org-course')->>'jobId',true);
select public.admin_decide_legacy_ai_job(current_setting('test.job')::uuid,'cancel');
reset role;
select is((select status from organization_ai_usage_records where source_id=current_setting('test.job')),'released','cancel preserves correct metering after attempt count 0');
select is((select final_charged_units from ai_generation_jobs where id=current_setting('test.job')::uuid),0::numeric,'job and usage settlement agree');
set local role authenticated;

select set_config('test.job',public.create_organization_ai_generation_job(p_actor_user_id=>'90700000-0000-4000-8000-000000000001',p_organization_id=>'90700000-0000-4000-8000-000000000601',p_job_type=>'media_assets',p_prompt=>'{"mode":"course_media"}',p_entity_id=>'cutover-org-course',p_idempotency_key=>'cutover-fixture-2',p_operation_type=>'ai_single_media_asset',p_estimated_units=>75,p_course_id=>'cutover-org-course')->>'jobId',true);
reset role;
update ai_generation_jobs set attempt_count=1,started_at=now() where id=current_setting('test.job')::uuid;
insert into private.ai_legacy_job_choices(job_id) values(current_setting('test.job')::uuid);
set local role authenticated;
select public.admin_decide_legacy_ai_job(current_setting('test.job')::uuid,'cancel');
reset role;
select is((select status from organization_ai_usage_records where source_id=current_setting('test.job')),'charged','cancel preserves correct metering after attempt count 1');
select is((select final_charged_units from ai_generation_jobs where id=current_setting('test.job')::uuid),75::numeric,'job and usage settlement agree');
set local role authenticated;
reset role;
select * from finish();
rollback;
