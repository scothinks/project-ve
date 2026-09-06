begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public,private;
select no_plan();
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
('90680000-0000-4000-8000-000000000001','authenticated','authenticated','release-editor@example.test','{}','{}');
insert into profiles(id,display_name,role) values('90680000-0000-4000-8000-000000000001','Release editor','admin') on conflict(id) do update set role=excluded.role;
insert into courses(id,slug,title,description,category,catalog_scope,status) values('release-course','release-course','Release','Teaching','Values','platform','draft');
select ok(not has_function_privilege('authenticated','public.service_recover_ai_authoring_jobs(integer)','execute'),'editors cannot claim recovery authority');
select ok(not has_function_privilege('anon','public.service_recover_ai_authoring_jobs(integer)','execute'),'anonymous recovery denied');
select set_config('request.jwt.claim.sub','90680000-0000-4000-8000-000000000001',true);
create function pg_temp.new_image() returns uuid language plpgsql as $$
declare result uuid;
begin
 result:=(public.admin_quote_ai_image('course_thumbnail','release-course',
 (public.admin_ai_image_setup('course_thumbnail','release-course')->>'revision')::bigint,
 'Show two options for a fair meeting','{"preset":"flat","palette":"","direction":""}','Two meeting options')->>'id')::uuid;
 perform public.admin_start_ai_page(result); return result;
end $$;
create function pg_temp.expire(p_result uuid) returns void language sql as $$
 update public.ai_generation_jobs set heartbeat_at=now()-interval '31 minutes',locked_at=now()-interval '31 minutes',attempt_count=3
 where id=(select job_id from private.ai_authoring_results where id=p_result)
$$;
create function pg_temp.image_begin(p_result uuid) returns jsonb language plpgsql as $$
declare j public.ai_generation_jobs;
begin
 select * into j from public.service_claim_ai_page(p_result,'release-test');
 perform public.service_ai_image_checkpoint(j.id,'release-test',j.lock_token,j.lock_version,'begin');
 return to_jsonb(j);
end $$;
set local role authenticated;
select set_config('test.stored',pg_temp.new_image()::text,true);
select set_config('test.silent',pg_temp.new_image()::text,true);
reset role;
select set_config('test.oldClaim',pg_temp.image_begin(current_setting('test.stored')::uuid)::text,true);
select pg_temp.image_begin(current_setting('test.silent')::uuid);
insert into storage.objects(bucket_id,name,metadata) values('learning-media-private','registry/authoring-'||current_setting('test.stored')||'.png','{"size":100,"mimetype":"image/png"}');
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select is(public.service_recover_ai_authoring_jobs()->>'recoveredImages','0','healthy active image is not reclaimed');
reset role;
select pg_temp.expire(current_setting('test.stored')::uuid);
select pg_temp.expire(current_setting('test.silent')::uuid);
set local role service_role;
select set_config('test.recovery',public.service_recover_ai_authoring_jobs()::text,true);
reset role;
select is(current_setting('test.recovery')::jsonb->>'recoveredImages','1','stored image recovered without provider replay, even at attempt limit');
select is(current_setting('test.recovery')::jsonb->>'settledIncomplete','1','uncertain unstored result is settled without provider replay');
select is((select stage from private.ai_authoring_results where id=current_setting('test.stored')::uuid),'ready','registry transaction restores ready');
select is((select count(*) from private.media_versions where authoring_result_id=current_setting('test.stored')::uuid),1::bigint,'recovery registers exactly one owned immutable version');
select is((select stage from private.ai_authoring_results where id=current_setting('test.silent')::uuid),'failed','unconfirmed result no longer stuck writing');
select throws_ok($$select public.service_ai_image_checkpoint((current_setting('test.oldClaim')::jsonb->>'id')::uuid,'release-test',(current_setting('test.oldClaim')::jsonb->>'lock_token')::uuid,(current_setting('test.oldClaim')::jsonb->>'lock_version')::integer,'failed')$$,'P0001',null,'late worker cannot overwrite recovery');
set local role service_role;
select is(public.service_recover_ai_authoring_jobs()->>'recoveredImages','0','maintenance replay creates no duplicate version');
reset role;
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select ok(exists(select 1 from jsonb_array_elements(public.admin_media_library(p_source=>'unused')->'assets') a where a->>'id'=public.admin_read_ai_results(current_setting('test.stored')::uuid)->'candidate'->>'versionId'),'recovered unused image is discoverable');
select set_config('test.cancelled',pg_temp.new_image()::text,true);
select public.admin_stop_ai_result(current_setting('test.cancelled')::uuid);
reset role;
select is((select provider_started_at from private.ai_authoring_results where id=current_setting('test.cancelled')::uuid),null,'pre-dispatch cancellation starts no provider');
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select is(public.service_recover_ai_authoring_jobs()->>'settledIncomplete','0','cancelled request is not restarted by maintenance');
reset role;

-- Registration can fail after storage succeeds. Keep the bytes and retry only
-- the registry transaction, without a fresh reservation or image request.
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select set_config('test.deferred',pg_temp.new_image()::text,true);
reset role;
select pg_temp.image_begin(current_setting('test.deferred')::uuid);
select pg_temp.expire(current_setting('test.deferred')::uuid);
insert into storage.objects(bucket_id,name,metadata) values('learning-media-private','registry/authoring-'||current_setting('test.deferred')||'.png','{"size":100,"mimetype":"image/png"}');
create function pg_temp.reject_registration() returns trigger language plpgsql as $$begin raise exception 'Registry temporarily unavailable'; end$$;
create trigger release_registry_failure before insert on private.media_versions for each row execute function pg_temp.reject_registration();
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select is(public.service_recover_ai_authoring_jobs()->>'deferred','1','registry outage is visible in worker recovery telemetry');
reset role;
select ok(exists(select 1 from storage.objects where name='registry/authoring-'||current_setting('test.deferred')||'.png'),'registration failure never removes paid stored bytes');
select is((select count(*) from private.media_versions where authoring_result_id=current_setting('test.deferred')::uuid),0::bigint,'failed registration creates no partial version');
drop trigger release_registry_failure on private.media_versions;
set local role service_role;
select is(public.service_recover_ai_authoring_jobs()->>'recoveredImages','1','registry-only retry recovers after repair');
reset role;
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select set_config('test.olderFailure',pg_temp.new_image()::text,true);
reset role;
select set_config('test.failedClaim',pg_temp.image_begin(current_setting('test.olderFailure')::uuid)::text,true);
insert into storage.objects(bucket_id,name,metadata) values('learning-media-private','registry/authoring-'||current_setting('test.olderFailure')||'.png','{"size":100,"mimetype":"image/png"}');
select public.service_ai_image_checkpoint((current_setting('test.failedClaim')::jsonb->>'id')::uuid,'release-test',(current_setting('test.failedClaim')::jsonb->>'lock_token')::uuid,(current_setting('test.failedClaim')::jsonb->>'lock_version')::integer,'failed');
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select is(public.service_recover_ai_authoring_jobs()->>'recoveredImages','1','earlier workers that failed after upload also recover stored images');
reset role;
select is((select count(*) from ai_generation_jobs where prompt->>'operationId'=current_setting('test.olderFailure')),1::bigint,'recovery creates no new generation job');

-- Real organisation reservation: retain one checkpoint, release the unstarted lesson.
insert into organizations(id,slug,name,status,created_by) values('90680000-0000-4000-8000-000000000101','release-org','Release org','published','90680000-0000-4000-8000-000000000001');
insert into organization_memberships(organization_id,user_id,role,status) values('90680000-0000-4000-8000-000000000101','90680000-0000-4000-8000-000000000001','organisation_owner','active');
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select public.admin_upsert_organization_temporary_entitlement_grant(null,'90680000-0000-4000-8000-000000000101','granular_override',null,
'{"ai_authoring_enabled":true,"ai_monthly_allocation":2000,"ai_hard_limit":2000,"ai_user_rate_limit_per_day":20,"ai_organization_concurrency_limit":3,"allowed_ai_operation_types":["ai_planner_new_course","ai_course_draft"],"allowed_ai_roles":["organisation_owner"]}',now()-interval '1 minute',now()+interval '1 day','Release fixture');
select set_config('test.outlineId',public.admin_quote_ai_course('course_outline','{"need":"Fair decisions","audience":"Adults","tone":"Direct","lessonCount":2}',null,null,0,'',false,'90680000-0000-4000-8000-000000000101')->>'id',true);
select public.admin_start_ai_page(current_setting('test.outlineId')::uuid);
reset role;
create function pg_temp.course_step(p_result uuid,p_action text,p_candidate jsonb default null) returns jsonb language plpgsql as $$
declare j public.ai_generation_jobs;
begin
 select * into j from ai_generation_jobs where id=(select job_id from private.ai_authoring_results where id=p_result);
 if j.status='queued' then select * into j from public.service_claim_ai_page(p_result,'release-test'); end if;
 return public.service_ai_course_checkpoint(j.id,'release-test',j.lock_token,j.lock_version,p_action,p_candidate);
end $$;
select pg_temp.course_step(current_setting('test.outlineId')::uuid,'begin');
select pg_temp.course_step(current_setting('test.outlineId')::uuid,'checkpoint','{"title":"Decide together","description":"Fair decisions","lessons":[{"title":"Listen","description":"Understand needs"},{"title":"Choose","description":"Compare tradeoffs"}]}');
set local role authenticated;
select set_config('test.draft',public.admin_quote_ai_course('course_draft',null,current_setting('test.outlineId')::uuid,1,0)->>'id',true);
select public.admin_start_ai_page(current_setting('test.draft')::uuid);
reset role;
select pg_temp.course_step(current_setting('test.draft')::uuid,'begin');
select pg_temp.course_step(current_setting('test.draft')::uuid,'checkpoint','{"title":"Listen","description":"Understand needs","pages":[{"title":"Ask why","subtitle":"","pageType":"concept","blocks":[{"blockType":"text","payload":{"body":"Ask which constraints prevent participation before proposing a time."}}]}],"questions":[]}');
select pg_temp.expire(current_setting('test.draft')::uuid);
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select is(public.service_recover_ai_authoring_jobs()->>'settledIncomplete','1','expired course settles at exhausted attempt limit');
reset role;
select is((select jsonb_array_length(candidate->'completed') from private.ai_authoring_results where id=current_setting('test.draft')::uuid),1,'completed teaching survives outage');
select is((select credit->>'used' from private.ai_authoring_results where id=current_setting('test.draft')::uuid),'135','charge covers only base and started lesson');
select is((select credit->>'released' from private.ai_authoring_results where id=current_setting('test.draft')::uuid),'35','unfinished unstarted allocation released');
select is((select final_charged_units from organization_ai_usage_records where id=(select organization_ai_usage_record_id from ai_generation_jobs where id=(select job_id from private.ai_authoring_results where id=current_setting('test.draft')::uuid))),135::numeric,'ledger agrees with retained result');
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select set_config('test.revoked',public.admin_quote_ai_course('course_outline','{"need":"Fair decisions","audience":"Adults","tone":"Direct","lessonCount":2}',null,null,0,'',false,'90680000-0000-4000-8000-000000000101')->>'id',true);
select public.admin_start_ai_page(current_setting('test.revoked')::uuid);
reset role;
update profiles set role='learner' where id='90680000-0000-4000-8000-000000000001';
update organization_memberships set status='suspended' where organization_id='90680000-0000-4000-8000-000000000101';
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select is(public.service_recover_ai_authoring_jobs()->>'settledIncomplete','1','queued work with revoked access does not retain a reservation forever');
reset role;
select is((select credit->>'used' from private.ai_authoring_results where id=current_setting('test.revoked')::uuid),'0','revoked before provider costs no credits');
select is((select credit->>'released' from private.ai_authoring_results where id=current_setting('test.revoked')::uuid),'57','revoked queued allocation released');
select * from finish();
rollback;
