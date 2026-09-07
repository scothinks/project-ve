begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public,private;
select no_plan();
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
('90710000-0000-4000-8000-000000000001','authenticated','authenticated','guidance-editor@example.test','{}','{}'),
('90720000-0000-4000-8000-000000000002','authenticated','authenticated','guidance-outsider@example.test','{}','{}');
insert into profiles(id,display_name,role) values
('90710000-0000-4000-8000-000000000001','Guidance editor','admin'),
('90720000-0000-4000-8000-000000000002','Guidance outsider','learner') on conflict(id) do update set role=excluded.role;
select set_config('test.result_count',(select count(*)::text from private.ai_authoring_results),true);
select set_config('test.job_count',(select count(*)::text from public.ai_generation_jobs),true);
select set_config('test.usage_count',(select count(*)::text from public.organization_ai_usage_records),true);
select ok(not has_function_privilege('authenticated','private.ai_course_price(text,integer,integer)','execute'),'calculator stays private');
select ok(not has_table_privilege('authenticated','private.ai_course_guidance_requests','insert'),'guidance cannot raw-write allowance');
select ok(not has_function_privilege('anon','public.admin_preview_ai_course_price(text,integer,integer,uuid,uuid)','execute'),'anonymous preview denied');
select ok(not has_function_privilege('anon','public.admin_reserve_ai_course_guidance(uuid,uuid,uuid)','execute'),'anonymous allowance denied');
select set_config('request.jwt.claim.sub','90710000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((admin_preview_ai_course_price('course_outline',3)->>'estimatedUnits')::integer,57,'outline price visible before intent');
select is((admin_preview_ai_course_price('course_draft',3,0)->>'estimatedUnits')::integer,205,'no quiz draft price');
select is(admin_preview_ai_course_price('course_outline')->>'metered','false','Catalog does not claim organisation charge');
select throws_ok($$select admin_preview_ai_course_price('course_draft',7,0)$$,'22023','Choose one to six lessons and zero to three questions.','bounded lesson count');
select throws_ok($$select admin_preview_ai_course_price('course_draft',3,4)$$,'22023','Choose one to six lessons and zero to three questions.','bounded quiz count');
reset role;
select is((select count(*) from private.ai_authoring_results),current_setting('test.result_count')::bigint,'price reads create no result records');
select is((select count(*) from public.ai_generation_jobs),current_setting('test.job_count')::bigint,'price reads create no jobs');
select is((select count(*) from public.organization_ai_usage_records),current_setting('test.usage_count')::bigint,'price reads reserve no credits');
-- Use actual retained quote output to verify the read-only preview shares pricing.
create function pg_temp.quote_pair(n integer,q integer) returns jsonb language plpgsql as $$
declare outline_id uuid; draft jsonb; o jsonb;
begin
 select jsonb_build_object('title','Choices','description','Make fair choices','lessons',jsonb_agg(jsonb_build_object('title','Lesson '||i,'description','Distinct teaching step '||i))) into o from generate_series(1,n) i;
 select (admin_quote_ai_course('course_outline',jsonb_build_object('need','Fair decisions','audience','Adults','tone','Direct','lessonCount',n))->>'id')::uuid into outline_id;
 -- Ready-outline fixture; generation/checkpoint behavior remains in ai_course_authoring.sql.
 update private.ai_authoring_results set stage='ready',outline_revision=1,course_outline=o,candidate=o where id=outline_id;
 return admin_quote_ai_course('course_draft',p_parent_id=>outline_id,p_revision=>1,p_questions=>q);
end $$;
select is((admin_preview_ai_course_price('course_draft',n,q)->>'estimatedUnits')::integer,(pg_temp.quote_pair(n,q)->>'estimatedUnits')::integer,'preview/quote parity for '||n||' lessons / '||q||' questions') from generate_series(1,6)n cross join generate_series(0,3)q;
select set_config('test.retry_id',pg_temp.quote_pair(3,2)->>'id',true);
update private.ai_authoring_results set stage='failed',candidate=jsonb_set(candidate,'{completed}','[{"index":0,"lesson":{}}]') where id=current_setting('test.retry_id')::uuid;
set local role authenticated;
select is((admin_preview_ai_course_price('course_draft',1,0,current_setting('test.retry_id')::uuid)->>'estimatedUnits')::integer,194,'retry derives two unfinished lessons and two questions from retained scope');
select is((admin_preview_ai_course_price('course_draft',1,0,current_setting('test.retry_id')::uuid)->>'lessonCount')::integer,3,'client cannot replace original retry count');
select throws_ok($$select admin_preview_ai_course_price('course_draft',3,0,current_setting('test.retry_id')::uuid,'90710000-0000-4000-8000-000000000099')$$,'42501','Result unavailable.','preview denies a different selected workspace');
reset role;
update private.ai_authoring_results set application_started_at=now(),application_error=null where id=current_setting('test.retry_id')::uuid;
set local role authenticated;
select throws_ok($$select admin_preview_ai_course_price('course_draft',3,0,current_setting('test.retry_id')::uuid)$$,'PT409','Only unfinished, unapplied work can be retried.','uncertain application blocks retry preview');
-- Included guidance consumes a slot once, never organisation credits or jobs.
select set_config('test.guidance_id',gen_random_uuid()::text,true);
select set_config('test.guidance_session',gen_random_uuid()::text,true);
select ok(admin_reserve_ai_course_guidance(current_setting('test.guidance_id')::uuid,current_setting('test.guidance_session')::uuid),'first explicit guidance slot accepted');
select ok(not admin_reserve_ai_course_guidance(current_setting('test.guidance_id')::uuid,current_setting('test.guidance_session')::uuid),'same request never authorizes a second provider call');
select ok(admin_reserve_ai_course_guidance(gen_random_uuid(),current_setting('test.guidance_session')::uuid),'guidance turn '||i) from generate_series(2,4)i;
select ok(not admin_reserve_ai_course_guidance(gen_random_uuid(),current_setting('test.guidance_session')::uuid),'session cap stops a fifth request');
select ok(admin_reserve_ai_course_guidance(gen_random_uuid(),gen_random_uuid()),'account allowance '||i) from generate_series(5,12)i;
select ok(not admin_reserve_ai_course_guidance(gen_random_uuid(),gen_random_uuid()),'new sessions do not bypass daily account cap');
reset role;
select is((select count(*) from private.ai_course_guidance_requests where actor_id='90710000-0000-4000-8000-000000000001'),12::bigint,'only accepted attempts are counted');
select is((select count(*) from public.ai_generation_jobs),current_setting('test.job_count')::bigint,'guidance creates no generation jobs');
select is((select count(*) from public.organization_ai_usage_records),current_setting('test.usage_count')::bigint,'guidance does not reserve organisation credits');
select set_config('request.jwt.claim.sub','90720000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok($$select admin_preview_ai_course_price('course_outline')$$,'42501','Workspace editing access required.','non-editor cannot preview');
select throws_ok($$select admin_reserve_ai_course_guidance(gen_random_uuid(),gen_random_uuid())$$,'42501','Workspace editing access required.','non-editor cannot consume included allowance');
reset role;
select * from finish();
rollback;
