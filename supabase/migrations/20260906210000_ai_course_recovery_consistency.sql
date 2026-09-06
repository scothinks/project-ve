begin;
-- Fence outline saves against accepting a stale draft quote; do not retry an uncertain application.
create or replace function public.admin_quote_ai_course(p_kind text,p_brief jsonb default null,p_parent_id uuid default null,
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
 if parent.kind<>'course_draft' or parent.stage not in ('failed','stopped') or parent.receipt is not null or (parent.application_started_at is not null and parent.application_error is null) then raise exception 'Only unfinished, unapplied work can be retried.' using errcode='PT409'; end if;
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

create or replace function public.admin_start_ai_page(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; j uuid; result jsonb; prompt jsonb; parent private.ai_authoring_results;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) or r.created_by<>auth.uid() then raise exception 'Generation access required.' using errcode='42501'; end if;
 if r.kind not in ('course_outline','course_draft') then return private.ai_authoring_start_v2(p_id); end if;
 if r.stage<>'quote' then return private.ai_authoring_projection(r,true); end if;
 if r.deleted_at is not null or r.expires_at<now() then raise exception 'This estimate expired. Check the cost again.' using errcode='PT409'; end if;
 if r.parent_id is not null then
 select * into parent from private.ai_authoring_results where id=r.parent_id for share;
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

create or replace function private.ai_authoring_projection(r private.ai_authoring_results,p_detail boolean) returns jsonb
language sql stable set search_path=public,private as $$
 select private.ai_authoring_projection_v2(r,p_detail) || case when r.kind in ('course_outline','course_draft') then jsonb_build_object(
 'title',coalesce(r.course_outline->>'title',r.title),'brief',case when p_detail then r.context->'brief' else null end,
 'outline',case when p_detail then r.course_outline else null end,'outlineRevision',r.outline_revision,
 'questionsPerLesson',coalesce((r.context->>'questionsPerLesson')::integer,0),
 'completedCount',coalesce(jsonb_array_length(r.candidate->'completed'),0),
 'totalCount',coalesce(jsonb_array_length(r.course_outline->'lessons'),(r.context->'brief'->>'lessonCount')::integer),
 'targetAvailable',true) else '{}'::jsonb end
$$;

create or replace function public.admin_read_ai_results(p_id uuid default null,p_lesson_id text default null,
 p_organization_id uuid default null,p_offset integer default 0,p_course_id text default null)
returns jsonb language plpgsql stable security definer set search_path=public,private as $$
declare selected_result private.ai_authoring_results;
begin
 if auth.uid() is null then raise exception 'Editor access required.' using errcode='42501'; end if;
 if p_id is not null then
   select * into selected_result from private.ai_authoring_results where id=p_id;
   if selected_result.id is null or not private.ai_authoring_can_access(selected_result) then raise exception 'Result unavailable.' using errcode='42501'; end if;
   return private.ai_authoring_projection(selected_result,true);
 end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(item order by created_at desc,id desc) from (
   select private.ai_authoring_projection(r,false) item,r.created_at,r.id from private.ai_authoring_results r
   where r.organization_id is not distinct from p_organization_id and (p_lesson_id is null or r.lesson_id=p_lesson_id) and (p_course_id is null or r.course_id=p_course_id)
   and r.stage<>'quote' and r.deleted_at is null and private.ai_authoring_can_access(r)
   order by r.created_at desc,r.id desc limit 20 offset greatest(0,least(p_offset,100000))) items),'[]'),
 'unusedCount',(select count(*) from private.ai_authoring_results r where r.organization_id is not distinct from p_organization_id
   and (p_lesson_id is null or r.lesson_id=p_lesson_id) and (p_course_id is null or r.course_id=p_course_id) and r.stage<>'quote' and r.candidate is not null and r.receipt is null
   and r.deleted_at is null and private.ai_authoring_can_access(r)));
end $$;

-- Individual lesson review uses the same optional-media path for course-created lessons.
create or replace function public.admin_review_ai_assistance_lesson(p_lesson_id text,p_revision bigint) returns void
language plpgsql security definer set search_path=public,private as $$
declare lid text; cid text;
begin
 perform private.lock_lesson_revision(p_lesson_id,p_revision);
 select id,course_id into lid,cid from lessons where id=p_lesson_id and ai_generation_notes->>'authoringVersion' in ('2','3') and ai_generated;
 if lid is null then raise exception 'Assistant lesson unavailable.' using errcode='42501'; end if;
 if exists(select 1 from learning_media_assets a where a.lesson_id=lid and a.metadata->>'required'='true'
 and coalesce(a.metadata->>'targetKind',case a.asset_type when 'cover' then 'lesson_cover' when 'thumbnail' then 'lesson_thumbnail' else '' end) in ('lesson_cover','lesson_thumbnail')
 and (coalesce(trim(a.url),'')='' or a.generation_status='failed')) then raise exception 'Complete the required lesson cover before reviewing.' using errcode='22023'; end if;
 if exists(select 1 from private.media_placements p join private.media_versions v on v.id=p.version_id where p.lesson_id=lid and p.in_draft and v.revoked_at is not null) then raise exception 'Replace revoked media before reviewing.' using errcode='22023'; end if;
 update lessons set ai_text_status='approved',ai_media_status='approved',ai_publish_status='ready',text_approved_at=now(),text_approved_by=auth.uid(),media_approved_at=now(),media_approved_by=auth.uid() where id=lid;
 update quizzes set ai_text_status='approved',text_approved_at=now(),text_approved_by=auth.uid() where lesson_id=lid and ai_generated;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'ai_assistance_lesson_reviewed','lesson',lid,jsonb_build_object('revision',p_revision));
end $$;
commit;
