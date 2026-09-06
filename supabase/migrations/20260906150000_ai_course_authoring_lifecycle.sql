begin;
alter table private.ai_authoring_results alter column course_id drop not null;
alter table private.ai_authoring_results drop constraint ai_authoring_results_kind_check;
alter table private.ai_authoring_results add constraint ai_authoring_results_kind_check check(kind in ('page','quiz','lesson_plan','lesson_draft','course_outline','course_draft'));
alter table private.ai_authoring_results add column course_outline jsonb, add column outline_revision integer not null default 0,
 add column active_item integer, add column started_items integer[] not null default '{}', add column course_used_units numeric not null default 0;

create function private.ai_course_workspace_editor(p_actor uuid,p_org uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select p_actor is not null and (exists(select 1 from profiles where id=p_actor and role='admin')
 or (p_org is null and exists(select 1 from platform_catalog_memberships where user_id=p_actor and status='active' and role in ('organisation_owner','organisation_admin','programme_manager','content_editor')))
 or (p_org is not null and exists(select 1 from organization_memberships where user_id=p_actor and organization_id=p_org and status='active' and role in ('organisation_owner','organisation_admin','programme_manager','content_editor'))))
$$;
create function private.validate_ai_course_outline(p_outline jsonb,p_count integer default null) returns void
language plpgsql set search_path=public,private as $$
declare l jsonb;
begin
 if jsonb_typeof(p_outline) is distinct from 'object' or length(trim(coalesce(p_outline->>'title',''))) not between 1 and 180
 or length(trim(coalesce(p_outline->>'description',''))) not between 1 and 1000 or jsonb_typeof(p_outline->'lessons') is distinct from 'array' then raise exception 'Check the outline text.' using errcode='22023'; end if;
 if jsonb_array_length(p_outline->'lessons') not between 1 and 6 or (p_count is not null and jsonb_array_length(p_outline->'lessons')<>p_count) then raise exception 'Choose one to six lessons.' using errcode='22023'; end if;
 for l in select value from jsonb_array_elements(p_outline->'lessons') loop
 if length(trim(coalesce(l->>'title',''))) not between 1 and 180 or length(trim(coalesce(l->>'description',''))) not between 1 and 1000 then raise exception 'Check each lesson title and description.' using errcode='22023'; end if;
 end loop;
 if (select count(distinct lower(trim(value->>'title'))) from jsonb_array_elements(p_outline->'lessons'))<>jsonb_array_length(p_outline->'lessons') then raise exception 'Lesson titles must be distinct.' using errcode='22023'; end if;
end $$;

alter function private.ai_authoring_projection(private.ai_authoring_results,boolean) rename to ai_authoring_projection_v2;
create function private.ai_authoring_projection(r private.ai_authoring_results,p_detail boolean) returns jsonb
language sql stable set search_path=public,private as $$
 select private.ai_authoring_projection_v2(r,p_detail) || case when r.kind in ('course_outline','course_draft') then jsonb_build_object(
 'brief',case when p_detail then r.context->'brief' else null end,
 'outline',case when p_detail then r.course_outline else null end,'outlineRevision',r.outline_revision,
 'questionsPerLesson',coalesce((r.context->>'questionsPerLesson')::integer,0),
 'completedCount',coalesce(jsonb_array_length(r.candidate->'completed'),0),
 'totalCount',coalesce(jsonb_array_length(r.course_outline->'lessons'),(r.context->'brief'->>'lessonCount')::integer),
 'targetAvailable',true) else '{}'::jsonb end
$$;

create function public.admin_quote_ai_course(p_kind text,p_brief jsonb default null,p_parent_id uuid default null,
 p_revision integer default null,p_questions integer default 0,p_refinement text default '',p_retry boolean default false,p_organization_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; parent private.ai_authoring_results; org uuid:=p_organization_id; brief jsonb:=p_brief;
 outline jsonb; completed jsonb:='[]'; n integer; units integer;
begin
 if p_kind is null or p_kind not in ('course_outline','course_draft') or p_questions is null or p_questions not between 0 and 3
 or p_refinement is null or length(p_refinement)>1000 or p_retry is null then raise exception 'Choose a valid course request.' using errcode='22023'; end if;
 if p_parent_id is not null then
 select * into parent from private.ai_authoring_results where id=p_parent_id for update;
 if parent.id is null or parent.kind not in ('course_outline','course_draft') or not private.ai_authoring_can_access(parent) or parent.deleted_at is not null then raise exception 'The earlier outline is unavailable.' using errcode='42501'; end if;
 org:=parent.organization_id; brief:=parent.context->'brief'; outline:=parent.course_outline;
 end if;
 if not private.ai_course_workspace_editor(auth.uid(),org) then raise exception 'Workspace editing access required.' using errcode='42501'; end if;
 if p_kind='course_outline' then
 if jsonb_typeof(brief) is distinct from 'object' or length(trim(coalesce(brief->>'need',''))) not between 1 and 2000
 or length(trim(coalesce(brief->>'audience',''))) not between 1 and 500 or length(trim(coalesce(brief->>'tone',''))) not between 1 and 100
 or coalesce(brief->>'lessonCount','') !~ '^[1-6]$' or p_retry then raise exception 'Complete the brief and choose one to six lessons.' using errcode='22023'; end if;
 units:=57;
 else
 if parent.id is null or parent.outline_revision is distinct from p_revision then raise exception 'The outline changed. Reopen it before checking the cost.' using errcode='PT409'; end if;
 perform private.validate_ai_course_outline(outline);
 n:=jsonb_array_length(outline->'lessons');
 if p_retry then
 if parent.kind<>'course_draft' or parent.stage not in ('failed','stopped') or parent.receipt is not null then raise exception 'Only unfinished, unapplied work can be retried.' using errcode='PT409'; end if;
 completed:=coalesce(parent.candidate->'completed','[]');
 p_questions:=(parent.context->>'questionsPerLesson')::integer;
 elsif parent.kind<>'course_outline' or parent.stage<>'ready' then raise exception 'Accept a ready outline first.' using errcode='PT409'; end if;
 if n<=jsonb_array_length(completed) then raise exception 'All lessons are already complete.' using errcode='PT409'; end if;
 units:=100+(n-jsonb_array_length(completed))*(35+6*p_questions);
 end if;
 insert into private.ai_authoring_results(organization_id,course_id,lesson_id,created_by,title,source_revision,context,focus,page_type,insertion_position,parent_id,refinement,kind,estimated_units,course_outline,source_fingerprint,candidate)
 values(org,null,null,auth.uid(),case when p_kind='course_outline' then 'Course outline' else outline->>'title' end,0,
 jsonb_build_object('kind',p_kind,'brief',brief,'outline',outline,'questionsPerLesson',p_questions,'refinement',trim(p_refinement),'priorDraft',parent.course_outline,'retry',p_retry),
 '', 'concept',1,p_parent_id,trim(p_refinement),p_kind,units,case when p_kind='course_draft' then outline else null end,
 case when parent.id is not null then parent.outline_revision::text else null end,
 case when p_kind='course_draft' then outline||jsonb_build_object('completed',completed) else null end) returning * into r;
 return private.ai_authoring_projection(r,true);
end $$;

create function public.admin_save_ai_course_outline(p_id uuid,p_revision integer,p_outline jsonb) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) then raise exception 'Outline unavailable.' using errcode='42501'; end if;
 if r.kind<>'course_outline' or r.stage<>'ready' or r.deleted_at is not null or r.outline_revision is distinct from p_revision then raise exception 'The outline changed. Reopen it before saving.' using errcode='PT409'; end if;
 perform private.validate_ai_course_outline(p_outline);
 update private.ai_authoring_results set course_outline=p_outline,outline_revision=outline_revision+1,updated_at=now() where id=p_id returning * into r;
 return private.ai_authoring_projection(r,true);
end $$;

alter function public.admin_start_ai_page(uuid) rename to ai_authoring_start_v2;
alter function public.ai_authoring_start_v2(uuid) set schema private;
revoke all on function private.ai_authoring_start_v2(uuid) from public,anon,authenticated,service_role;
create function public.admin_start_ai_page(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; j uuid; result jsonb; prompt jsonb; parent private.ai_authoring_results;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) or r.created_by<>auth.uid() then raise exception 'Generation access required.' using errcode='42501'; end if;
 if r.kind not in ('course_outline','course_draft') then return private.ai_authoring_start_v2(p_id); end if;
 if r.stage<>'quote' then return private.ai_authoring_projection(r,true); end if;
 if r.deleted_at is not null or r.expires_at<now() then raise exception 'This estimate expired. Check the cost again.' using errcode='PT409'; end if;
 if r.parent_id is not null then
 select * into parent from private.ai_authoring_results where id=r.parent_id;
 if parent.deleted_at is not null or parent.outline_revision::text is distinct from r.source_fingerprint then raise exception 'The outline changed. Check the cost again.' using errcode='PT409'; end if;
 end if;
 prompt:=jsonb_build_object('mode','authoring_course_v3','operationId',r.id);
 if r.organization_id is not null then
 result:=public.create_organization_ai_generation_job(p_organization_id=>r.organization_id,p_actor_user_id=>auth.uid(),p_job_type=>'course_text',p_prompt=>prompt,p_entity_id=>null,
 p_idempotency_key=>'authoring:'||r.id,p_operation_type=>case when r.kind='course_outline' then 'ai_planner_new_course' else 'ai_course_draft' end,p_estimated_units=>r.estimated_units);
 j:=(result->>'jobId')::uuid;
 else
 insert into ai_generation_jobs(entity_type,job_type,status,prompt,created_by,idempotency_key) values('course','course_text','queued',prompt,auth.uid(),'authoring:'||r.id) returning id into j;
 end if;
 update private.ai_authoring_results set job_id=j,stage='starting',updated_at=now(),credit=jsonb_build_object('status',case when organization_id is null then 'unmetered' else 'reserved' end,'reserved',estimated_units) where id=r.id returning * into r;
 return private.ai_authoring_projection(r,true);
end $$;

-- Settles only the accepted base plus provider calls actually started. Unknown calls
-- are charged once; never-started lesson allocation is released. No child reservation.
create function private.finish_ai_course(r private.ai_authoring_results,j public.ai_generation_jobs,p_worker text,p_token uuid,p_version integer,p_stage text)
returns void language plpgsql security definer set search_path=public,private as $$
declare u public.organization_ai_usage_records;
begin
 if r.course_used_units>0 then
 u:=private.reconcile_organization_ai_usage_for_job(j,'completed',jsonb_build_object('actualUnits',r.course_used_units),null,null,false);
 end if;
 if p_stage='ready' then
 perform public.complete_ai_generation_job(j.id,p_worker,p_token,p_version,null,'completed',jsonb_build_object('operationId',r.id,'actualUnits',r.course_used_units),null);
 else
 perform public.fail_ai_generation_job(j.id,p_worker,p_token,p_version,'Course writing stopped before every lesson was ready.',case when r.course_used_units=0 then 'validation_error' else 'worker_error' end,'{}',false);
 end if;
 select * into u from organization_ai_usage_records where id=j.organization_ai_usage_record_id;
 update private.ai_authoring_results set stage=p_stage,active_item=null,updated_at=now(),failure=case when p_stage='ready' then null else 'Completed lessons are retained. Review them or check the cost to retry unfinished work.' end,
 credit=jsonb_build_object('status',coalesce(u.status,'unmetered'),'used',u.final_charged_units,'released',greatest(0,u.reserved_units-u.final_charged_units)) where id=r.id;
end $$;

create function public.service_ai_course_checkpoint(p_job uuid,p_worker text,p_token uuid,p_version integer,p_action text,p_candidate jsonb default null)
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
 return r.context||jsonb_build_object('index',idx);
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

revoke all on function private.ai_course_workspace_editor(uuid,uuid),private.validate_ai_course_outline(jsonb,integer),private.ai_authoring_projection(private.ai_authoring_results,boolean),private.finish_ai_course(private.ai_authoring_results,public.ai_generation_jobs,text,uuid,integer,text) from public,anon,authenticated,service_role;
revoke all on function public.admin_quote_ai_course(text,jsonb,uuid,integer,integer,text,boolean,uuid),public.admin_save_ai_course_outline(uuid,integer,jsonb),public.admin_start_ai_page(uuid),public.service_ai_course_checkpoint(uuid,text,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.admin_quote_ai_course(text,jsonb,uuid,integer,integer,text,boolean,uuid),public.admin_save_ai_course_outline(uuid,integer,jsonb),public.admin_start_ai_page(uuid) to authenticated;
grant execute on function public.service_ai_course_checkpoint(uuid,text,uuid,integer,text,jsonb) to service_role;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles) values
('public','admin_quote_ai_course','p_kind text, p_brief jsonb, p_parent_id uuid, p_revision integer, p_questions integer, p_refinement text, p_retry boolean, p_organization_id uuid','ADMIN_AUTHENTICATED','Course authoring editors','Current workspace editor, bounded scope, retained revision.',array['authenticated']),
('public','admin_save_ai_course_outline','p_id uuid, p_revision integer, p_outline jsonb','ADMIN_AUTHENTICATED','Course authoring editors','Current workspace editor, optimistic outline revision.',array['authenticated']),
('public','service_ai_course_checkpoint','p_job uuid, p_worker text, p_token uuid, p_version integer, p_action text, p_candidate jsonb','SERVICE_ROLE_ONLY','Course authoring worker','Lease fencing, initiating editor and entitlement recheck, accepted budget and schema.',array['service_role']);
notify pgrst,'reload schema';
commit;
