begin;
-- The service-only, lease-fenced checkpoint supplies retained teaching to later lessons,
-- including retries. No extra reads, provider requests or public result fields.
create or replace function public.service_ai_course_checkpoint(p_job uuid,p_worker text,p_token uuid,p_version integer,p_action text,p_candidate jsonb default null)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare j public.ai_generation_jobs; r private.ai_authoring_results; idx integer; n integer; completed jsonb; v jsonb;
begin
 select * into j from ai_generation_jobs where id=p_job for update;
 perform private.assert_ai_generation_job_lease(j,p_worker,p_token,p_version);
 select * into r from private.ai_authoring_results where job_id=j.id for update;
 if r.id is null or r.kind not in ('course_outline','course_draft') then raise exception 'Course operation unavailable.'; end if;
 if p_action='failed' then
 perform private.finish_ai_course(r,j,p_worker,p_token,p_version,case when r.stop_requested then 'stopped' else 'failed' end); return jsonb_build_object('done',true);
 end if;
 if p_action='begin' then
 if r.active_item is not null then raise exception 'An earlier provider outcome is uncertain; it cannot be replayed.'; end if;
 if r.stop_requested then perform private.finish_ai_course(r,j,p_worker,p_token,p_version,'stopped'); return jsonb_build_object('done',true); end if;
 if not private.ai_course_workspace_editor(r.created_by,r.organization_id) or not private.organization_ai_job_can_run(j) then raise exception 'Generation access changed before provider work.' using errcode='42501'; end if;
 if r.kind='course_outline' then idx:=0; else
 select i into idx from generate_series(0,jsonb_array_length(r.course_outline->'lessons')-1) i where not exists(select 1 from jsonb_array_elements(r.candidate->'completed') c where (c->>'index')::integer=i) order by i limit 1;
 end if;
 if idx is null or idx=any(r.started_items) then raise exception 'Provider scope is complete or uncertain.'; end if;
 update private.ai_authoring_results set active_item=idx,started_items=array_append(started_items,idx),provider_started_at=coalesce(provider_started_at,now()),stage='writing',updated_at=now(),
 course_used_units=case when r.kind='course_outline' then 57 else case when course_used_units=0 then 100 else course_used_units end+35+6*(r.context->>'questionsPerLesson')::integer end where id=r.id;
 update ai_generation_jobs set heartbeat_at=now() where id=j.id;
 return r.context||jsonb_build_object('index',idx,'completed',coalesce(r.candidate->'completed','[]'::jsonb));
 elsif p_action='checkpoint' then
 if r.active_item is null then raise exception 'No provider request was started.'; end if;
 if r.kind='course_outline' then
 perform private.validate_ai_course_outline(p_candidate,(r.context->'brief'->>'lessonCount')::integer);
 update private.ai_authoring_results set candidate=p_candidate,course_outline=p_candidate,active_item=null,outline_revision=1,updated_at=now() where id=r.id returning * into r;
 else
 perform private.validate_ai_assistance('lesson_draft',p_candidate,1);
 n:=(r.context->>'questionsPerLesson')::integer;
 if jsonb_typeof(p_candidate->'questions') is distinct from 'array' then raise exception 'Questions must match the accepted scope.'; end if;
 perform private.validate_ai_assistance('quiz',p_candidate,n);
 if p_candidate->>'title' is distinct from r.course_outline->'lessons'->r.active_item->>'title' then raise exception 'The lesson title changed outside the accepted outline.'; end if;
 completed:=(r.candidate->'completed')||jsonb_build_array(jsonb_build_object('index',r.active_item,'lesson',p_candidate));
 update private.ai_authoring_results set candidate=jsonb_set(candidate,'{completed}',completed),active_item=null,updated_at=now() where id=r.id returning * into r;
 end if;
 update ai_generation_jobs set heartbeat_at=now() where id=j.id;
 if r.kind='course_outline' or jsonb_array_length(r.candidate->'completed')=jsonb_array_length(r.course_outline->'lessons') then
 perform private.finish_ai_course(r,j,p_worker,p_token,p_version,'ready'); return jsonb_build_object('done',true);
 elsif r.stop_requested then perform private.finish_ai_course(r,j,p_worker,p_token,p_version,'stopped'); return jsonb_build_object('done',true); end if;
 return jsonb_build_object('continue',true);
 else raise exception 'Unknown course checkpoint.'; end if;
end $$;
commit;
