begin;
alter table private.ai_authoring_results alter column lesson_id drop not null;
alter table private.ai_authoring_results add column kind text not null default 'page' check(kind in ('page','quiz','lesson_plan','lesson_draft')),
 add column requested_count integer not null default 1 check(requested_count between 1 and 3),
 add column source_fingerprint text, add column selected_items integer[];

-- Lock the edited graph in a consistent order; compare its snapshot before starting/applying.
-- Foreign-key parent locks also fence new children during the application transaction.
create function private.lock_ai_authoring_source(p_course text,p_lesson text) returns text
language plpgsql security definer set search_path=public,private as $$
declare snapshot text;
begin
 if not public.current_user_can_edit_course(p_course) then raise exception 'Course editing access required.' using errcode='42501'; end if;
 perform 1 from courses where id=p_course for update;
 if p_lesson is not null and not exists(select 1 from lessons where id=p_lesson and course_id=p_course) then
 raise exception 'The lesson is no longer available.' using errcode='PT409'; end if;
 perform 1 from lessons where course_id=p_course and (p_lesson is null or id=p_lesson) order by id for update;
 perform 1 from lesson_pages where lesson_id in(select id from lessons where course_id=p_course and (p_lesson is null or id=p_lesson)) order by id for update;
 perform 1 from quizzes where lesson_id in(select id from lessons where course_id=p_course and (p_lesson is null or id=p_lesson)) order by id for update;
 perform 1 from quiz_questions where quiz_id in(select q.id from quizzes q join lessons l on l.id=q.lesson_id where l.course_id=p_course and (p_lesson is null or l.id=p_lesson)) order by id for update;
 with ls as(select * from lessons where course_id=p_course and (p_lesson is null or id=p_lesson)),
 ps as(select p.* from lesson_pages p join ls on ls.id=p.lesson_id),
 qs as(select q.* from quizzes q join ls on ls.id=q.lesson_id),
 questions as(select q.* from quiz_questions q join qs on qs.id=q.quiz_id)
 select md5(jsonb_build_object('course',(select to_jsonb(c) from courses c where id=p_course),
 'lessons',(select jsonb_agg(to_jsonb(ls) order by id) from ls),
 'pages',(select jsonb_agg(to_jsonb(ps) order by id) from ps),
 'blocks',(select jsonb_agg(to_jsonb(b) order by b.id) from lesson_content_blocks b join ps on ps.id=b.page_id),
 'quizzes',(select jsonb_agg(to_jsonb(qs) order by id) from qs),
 'questions',(select jsonb_agg(to_jsonb(q) order by id) from questions q),
 'options',(select jsonb_agg(to_jsonb(o) order by o.id) from quiz_options o join questions q on q.id=o.question_id))::text) into snapshot;
 return snapshot;
end $$;

create function public.admin_quote_ai_assistance(p_course_id text,p_kind text,p_lesson_id text default null,
 p_focus text default '',p_count integer default 1,p_parent_id uuid default null,p_refinement text default '',p_selected integer default null)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare c public.courses; r private.ai_authoring_results; parent private.ai_authoring_results; fingerprint text; ctx jsonb;
begin
 if p_kind is null or p_kind not in ('quiz','lesson_plan','lesson_draft') or p_focus is null or length(p_focus)>1000
 or p_refinement is null or length(p_refinement)>1000 or p_count is null or p_count not between 1 and 3
 or (p_kind='quiz' and p_lesson_id is null) or (p_kind<>'quiz' and p_lesson_id is not null)
 or (p_kind='lesson_draft' and p_count<>1) then raise exception 'Choose a valid request.' using errcode='22023'; end if;
 fingerprint:=private.lock_ai_authoring_source(p_course_id,p_lesson_id);
 select * into c from courses where id=p_course_id;
 if p_parent_id is not null then
 select * into parent from private.ai_authoring_results where id=p_parent_id;
 if parent.id is null or not private.ai_authoring_can_access(parent) or parent.course_id<>c.id or parent.lesson_id is distinct from p_lesson_id
 or parent.candidate is null or parent.deleted_at is not null or (parent.kind<>p_kind and not(p_kind='lesson_draft' and parent.kind='lesson_plan')) then
 raise exception 'The earlier result is unavailable.' using errcode='42501'; end if;
 end if;
 if p_kind='lesson_draft' and (parent.id is null or (parent.kind='lesson_plan' and (p_selected is null or p_selected<0 or p_selected>=jsonb_array_length(parent.candidate->'suggestions')))) then
 raise exception 'Choose a lesson suggestion first.' using errcode='22023'; end if;
 -- Bounded context, set-wise; full fingerprint stays private and detects omitted edits too.
 with teaching as (
 select p.lesson_id,p.page_number,p.title,left(regexp_replace(string_agg(coalesce(b.payload->>'heading',b.payload->>'title','')||' '||coalesce(b.payload->>'body','')||case when b.block_type='table' then b.payload::text else '' end,E'\n' order by b.sort_order),'<[^>]*>',' ','g'),1800) content
 from lesson_pages p left join lesson_content_blocks b on b.page_id=p.id and b.block_type in ('text','callout','table')
 join lessons l on l.id=p.lesson_id where l.course_id=c.id and (p_lesson_id is null or l.id=p_lesson_id) group by p.id
 ), outlines as (
 select l.id,l.title,l.description,l.sort_order,(select jsonb_agg(to_jsonb(t) order by t.page_number) from (select * from teaching where lesson_id=l.id order by page_number limit 8) t) pages
 from lessons l where l.course_id=c.id and (p_lesson_id is null or l.id=p_lesson_id) order by l.sort_order,l.id limit 20)
 select jsonb_build_object('kind',p_kind,'count',p_count,'focus',trim(p_focus),'refinementInstruction',trim(p_refinement),
 'course',jsonb_build_object('title',c.title,'category',c.category,'level',c.level,'description',c.description),
 'lessons',coalesce((select jsonb_agg(to_jsonb(o) order by o.sort_order,o.id) from outlines o),'[]'),
 'existingQuestions',coalesce((select jsonb_agg(prompt) from (select q.prompt from quiz_questions q join quizzes z on z.id=q.quiz_id where z.lesson_id=p_lesson_id order by q.question_order limit 50) existing),'[]'),
 'suggestion',case when parent.kind='lesson_plan' then parent.candidate->'suggestions'->p_selected else parent.context->'suggestion' end,
 'priorDraft',case when parent.kind=p_kind then parent.candidate else null end,'mediaPlaceholders',true) into ctx;
 insert into private.ai_authoring_results(organization_id,course_id,lesson_id,created_by,title,source_revision,context,focus,page_type,insertion_position,parent_id,refinement,kind,requested_count,source_fingerprint,estimated_units)
 values(c.organization_id,c.id,p_lesson_id,auth.uid(),case p_kind when 'quiz' then 'Quiz suggestions' when 'lesson_plan' then 'Lesson suggestions' else 'Lesson draft' end,
 coalesce((select draft_revision from lessons where id=p_lesson_id),0),ctx,trim(p_focus),'concept',1,p_parent_id,trim(p_refinement),p_kind,p_count,fingerprint,
 case p_kind when 'quiz' then 20*p_count when 'lesson_plan' then 35+12*p_count else 135 end) returning * into r;
 return private.ai_authoring_projection(r,true);
end $$;
create or replace function public.admin_start_ai_page(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; j uuid; result jsonb; prompt jsonb;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) or r.created_by<>auth.uid() then
   raise exception 'Generation access required.' using errcode='42501'; end if;
 -- The quote identity is the intent identity, including after completion.
 if r.stage<>'quote' then return private.ai_authoring_projection(r,true); end if;
 if r.expires_at<now() then raise exception 'This estimate expired. Check the cost again.' using errcode='PT409'; end if;
 if r.kind='page' then
 perform private.lock_lesson_revision(r.lesson_id,r.source_revision);
 else
 if private.lock_ai_authoring_source(r.course_id,r.lesson_id) is distinct from r.source_fingerprint then
 raise exception 'Your content changed. Check the cost again.' using errcode='PT409'; end if;
 end if;
 if not exists(select 1 from courses c where c.id=r.course_id and c.organization_id is not distinct from r.organization_id) then
 raise exception 'The destination changed. Check the cost again.' using errcode='PT409'; end if;
 prompt:=jsonb_build_object('mode',case when r.kind='page' then 'authoring_page_v1' else 'authoring_assistance_v2' end,'operationId',r.id,'lessonId',r.lesson_id);
 if r.organization_id is not null then
   result:=public.create_organization_ai_generation_job(p_organization_id=>r.organization_id,p_actor_user_id=>auth.uid(),
    p_job_type=>'course_text',p_prompt=>prompt,p_entity_id=>r.course_id,p_idempotency_key=>'authoring:'||r.id,
    p_operation_type=>case r.kind when 'quiz' then 'ai_quiz_question_generation' when 'lesson_plan' then 'ai_planner_expand_course' when 'lesson_draft' then 'ai_lesson_extension' else 'ai_lesson_page_extension' end,p_estimated_units=>r.estimated_units,p_course_id=>r.course_id,p_lesson_id=>r.lesson_id);
   j:=(result->>'jobId')::uuid;
 else
   insert into ai_generation_jobs(entity_type,entity_id,course_id,lesson_id,job_type,status,prompt,created_by,idempotency_key)
   values('course',r.course_id,r.course_id,r.lesson_id,'course_text','queued',prompt,auth.uid(),'authoring:'||r.id) returning id into j;
 end if;
 update private.ai_authoring_results set job_id=j,stage='starting',updated_at=now(),
 credit=jsonb_build_object('status',case when organization_id is null then 'unmetered' else 'reserved' end,'reserved',estimated_units)
 where id=r.id returning * into r;
 return private.ai_authoring_projection(r,true);
end $$;
create or replace function public.service_ai_page_checkpoint(p_job uuid,p_worker text,p_token uuid,p_version integer,
 p_action text,p_candidate jsonb default null)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare j public.ai_generation_jobs; r private.ai_authoring_results; u public.organization_ai_usage_records;
begin
 select * into j from ai_generation_jobs where id=p_job for update;
 perform private.assert_ai_generation_job_lease(j,p_worker,p_token,p_version);
 select * into r from private.ai_authoring_results where job_id=j.id for update;
 if r.id is null then raise exception 'Authoring result missing.'; end if;
 if p_action='begin' then
   if r.provider_started_at is not null then
     -- An expired worker may already have paid for a call. Never replay it.
     raise exception 'A previous provider outcome needs reconciliation.';
   end if;
   if r.stop_requested or not exists(select 1 from courses c where c.id=r.course_id and c.organization_id is not distinct from r.organization_id and (r.lesson_id is null or exists(select 1 from lessons l where l.id=r.lesson_id and l.course_id=c.id))) or not private.organization_ai_job_can_run(j)
      or not private.ai_authoring_actor_can_edit(r.created_by,r.course_id) then
     raise exception 'Generation access changed before provider work.' using errcode='22023';
   end if;
   update private.ai_authoring_results set stage='writing',provider_started_at=now(),updated_at=now() where id=r.id;
   return r.context;
 elsif p_action='ready' then
   if r.kind<>'page' then
     if r.provider_started_at is null then raise exception 'Provider has not started.'; end if;
     perform private.validate_ai_assistance(r.kind,p_candidate,r.requested_count);
   else
   if r.provider_started_at is null or jsonb_typeof(p_candidate) is distinct from 'object'
    or coalesce(trim(p_candidate->>'title'),'')='' or p_candidate->>'pageType' not in ('concept','scenario','reflection','summary')
    or jsonb_typeof(p_candidate->'blocks') is distinct from 'array' then raise exception 'Invalid page candidate.'; end if;
   if r.context->>'assistant'='true' then
     if coalesce(p_candidate->>'decision','') not in ('page','review_quiz')
       or length(trim(coalesce(p_candidate->>'reason',''))) not between 1 and 1000
       or jsonb_typeof(p_candidate->'position') is distinct from 'number'
       or coalesce(p_candidate->>'position','') !~ '^[1-9][0-9]{0,5}$' then
       raise exception 'Invalid assistant recommendation.';
     end if;
     if (p_candidate->>'position')::integer > (r.context->>'pageCount')::integer+1 then
       raise exception 'Invalid recommended position.';
     end if;
   elsif p_candidate ? 'decision' then raise exception 'This request does not support assistant recommendations.';
   end if;
   if p_candidate->>'decision'='review_quiz' then
     if coalesce(r.context->>'assistant','false')<>'true' or (r.context->>'pageCount')::integer=0
       or coalesce(r.context->>'contextTruncated','true')<>'false' or jsonb_array_length(p_candidate->'blocks')<>0 then
       raise exception 'Invalid quiz review recommendation.';
     end if;
   elsif jsonb_array_length(p_candidate->'blocks') not between 1 and 4
    or not exists(select 1 from jsonb_array_elements(p_candidate->'blocks') teaching where teaching->>'blockType' in ('text','callout','table'))
    or exists(select 1 from jsonb_array_elements(p_candidate->'blocks') b where
      coalesce(b->>'blockType','') not in ('text','callout','table') and (
        coalesce(r.context->>'mediaPlaceholders','false')='true'
        and b->>'blockType' in ('image','video','audio')
        and jsonb_typeof(b->'payload')='object'
        and ((b->'payload')-array['mediaIntent','src'])='{}'::jsonb
        and coalesce(b->'payload'->>'src','')=''
        and ((b->'payload'->'mediaIntent')-array['version','kind','purpose','aspectRatio','required','style'])='{}'::jsonb
        and b->'payload'->'mediaIntent'->>'version'='1'
        and b->'payload'->'mediaIntent'->>'kind'=b->>'blockType'
        and length(trim(b->'payload'->'mediaIntent'->>'purpose')) between 1 and 1000
        and b->'payload'->'mediaIntent'->'required'='false'::jsonb
        and b->'payload'->'mediaIntent'->>'style'='inherit'
        and b->'payload'->'mediaIntent'->>'aspectRatio' in ('16:9','4:3','1:1')
      ) is not true) then
     raise exception 'Media must be an optional placeholder without an asset or URL.'; end if;
   end if;
   perform public.complete_ai_generation_job(j.id,p_worker,p_token,p_version,r.course_id,'completed',jsonb_build_object('operationId',r.id),null);
   select * into u from organization_ai_usage_records where id=j.organization_ai_usage_record_id;
   update private.ai_authoring_results set stage='ready',candidate=p_candidate,updated_at=now(),
    insertion_position=case when r.context->>'assistant'='true' then (p_candidate->>'position')::integer else r.insertion_position end,
    page_type=case when r.context->>'assistant'='true' then p_candidate->>'pageType' else r.page_type end,
    credit=jsonb_build_object('status',coalesce(u.status,'unmetered'),'used',u.final_charged_units,'released',greatest(0,u.reserved_units-u.final_charged_units)) where id=r.id;
 elsif p_action='failed' then
   -- Before-provider failures release allocation. All uncertain/invalid outputs
   -- after dispatch settle under the existing started-work policy, without retry.
   perform public.fail_ai_generation_job(j.id,p_worker,p_token,p_version,'Generation did not finish.',
    case when r.provider_started_at is null then 'validation_error' else 'worker_error' end,'{}',false);
   select * into u from organization_ai_usage_records where id=j.organization_ai_usage_record_id;
   update private.ai_authoring_results set stage='failed',failure=case when provider_started_at is null then
    'Generation could not start. Check access and try again.' else 'We could not confirm a complete result. Your earlier results are still available.' end,
    updated_at=now(),credit=jsonb_build_object('status',coalesce(u.status,'unmetered'),'used',u.final_charged_units,
    'released',greatest(0,u.reserved_units-u.final_charged_units)) where id=r.id;
 else raise exception 'Unknown checkpoint.'; end if;
 return jsonb_build_object('courseId',r.course_id,'lessonId',r.lesson_id);
end $$;
create or replace function private.ai_authoring_projection(r private.ai_authoring_results, p_detail boolean)
returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('id',r.id,'kind',r.kind,'count',r.requested_count,'selection',r.selected_items,'lessonId',r.lesson_id,'courseId',r.course_id,
 'title',coalesce(r.candidate->>'title',r.title),'stage',r.stage,'createdAt',r.created_at,'updatedAt',r.updated_at,
 'sourceRevision',r.source_revision,'position',r.insertion_position,'pageType',r.page_type,
 'assistant',coalesce(r.context->>'assistant','false')='true','focus',r.focus,'refinement',r.refinement,'parentId',r.parent_id,'estimatedUnits',r.estimated_units,
 'metered',r.organization_id is not null,'quoteExpiresAt',r.expires_at,'stopRequested',r.stop_requested,
 'candidate',case when p_detail then r.candidate else null end,'receipt',case when p_detail then r.receipt else r.receipt-'page'-'blocks' end,
 'applicationState',case when r.receipt is not null then 'saved' when r.application_error is not null then 'not_saved' when r.application_started_at is not null then 'checking' else 'not_started' end,'applicationError',r.application_error,
 'credit',r.credit,'failure',r.failure,'deleted',r.deleted_at is not null,'targetAvailable',exists(select 1 from courses c where c.id=r.course_id and c.organization_id is not distinct from r.organization_id and (r.lesson_id is null or exists(select 1 from lessons l where l.id=r.lesson_id and l.course_id=c.id))))
$$;

revoke all on function private.lock_ai_authoring_source(text,text) from public,anon,authenticated,service_role;
revoke all on function public.admin_quote_ai_assistance(text,text,text,text,integer,uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.admin_quote_ai_assistance(text,text,text,text,integer,uuid,text,integer) to authenticated;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles)
values('public','admin_quote_ai_assistance','p_course_id text, p_kind text, p_lesson_id text, p_focus text, p_count integer, p_parent_id uuid, p_refinement text, p_selected integer','ADMIN_AUTHENTICATED','AI assistance','Current course editor; scoped snapshot and bounded quote.',array['authenticated']);
notify pgrst,'reload schema';
commit;
