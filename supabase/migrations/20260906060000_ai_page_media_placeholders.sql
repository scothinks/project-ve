begin;
create or replace function public.admin_quote_ai_page(p_lesson_id text,p_revision bigint,p_focus text,p_page_type text,
 p_position integer,p_parent_id uuid default null,p_refinement text default '')
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare l public.lessons; c public.courses; r private.ai_authoring_results; parent private.ai_authoring_results; ctx jsonb;
begin
 perform private.lock_lesson_revision(p_lesson_id,p_revision);
 select * into l from lessons where id=p_lesson_id;
 select * into c from courses where id=l.course_id;
 if p_page_type not in ('concept','scenario','reflection','summary') or p_focus is null or length(p_focus)>1000
 or p_refinement is null or length(p_refinement)>1000 or p_position is null or p_position<1
 or p_position>(select count(*)+1 from lesson_pages where lesson_id=l.id) then
   raise exception 'Choose a valid page type, position and a shorter instruction.' using errcode='22023';
 end if;
 if p_parent_id is not null then
   select * into parent from private.ai_authoring_results where id=p_parent_id;
   if parent.id is null or not private.ai_authoring_can_access(parent) or parent.lesson_id<>l.id
     or parent.candidate is null or parent.deleted_at is not null then
     raise exception 'The earlier result is unavailable.' using errcode='42501';
   end if;
 end if;
 select jsonb_build_object('course',jsonb_build_object('title',c.title,'category',c.category,'level',c.level),
 'lesson',jsonb_build_object('title',l.title,'description',coalesce(l.description,'')),
 'existingPages',coalesce((select jsonb_agg(jsonb_build_object('title',p.title,'pageType',p.page_type) order by p.page_number)
   from lesson_pages p where p.lesson_id=l.id),'[]'),
 'focus',trim(p_focus),'pageType',p_page_type,'priorDraft',parent.candidate,
 'refinementInstruction',trim(p_refinement),'textOnly',false,'mediaPlaceholders',true) into ctx;
 insert into private.ai_authoring_results(organization_id,course_id,lesson_id,created_by,title,source_revision,
 context,focus,page_type,insertion_position,parent_id,refinement)
 values(c.organization_id,c.id,l.id,auth.uid(),'Page for '||l.title,p_revision,ctx,trim(p_focus),p_page_type,p_position,p_parent_id,trim(p_refinement))
 returning * into r;
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
   if r.stop_requested or not exists(select 1 from lessons l join courses c on c.id=l.course_id where l.id=r.lesson_id and c.id=r.course_id and c.organization_id is not distinct from r.organization_id) or not private.organization_ai_job_can_run(j)
      or not private.ai_authoring_actor_can_edit(r.created_by,r.course_id) then
     raise exception 'Generation access changed before provider work.' using errcode='22023';
   end if;
   update private.ai_authoring_results set stage='writing',provider_started_at=now(),updated_at=now() where id=r.id;
   return r.context;
 elsif p_action='ready' then
   if r.provider_started_at is null or jsonb_typeof(p_candidate) is distinct from 'object'
    or coalesce(trim(p_candidate->>'title'),'')='' or p_candidate->>'pageType' not in ('concept','scenario','reflection','summary')
    or jsonb_typeof(p_candidate->'blocks') is distinct from 'array' then raise exception 'Invalid page candidate.'; end if;
   if jsonb_array_length(p_candidate->'blocks') not between 1 and 4
    or exists(select 1 from jsonb_array_elements(p_candidate->'blocks') b where
      coalesce(b->>'blockType','') not in ('text','callout','table') and (
        coalesce(r.context->>'mediaPlaceholders','false')='true'
        and b->>'blockType' in ('image','video','audio')
        and jsonb_typeof(b->'payload')='object'
        and (b->'payload'-array['mediaIntent','src'])='{}'::jsonb
        and coalesce(b->'payload'->>'src','')=''
        and (b->'payload'->'mediaIntent'-array['version','kind','purpose','aspectRatio','required','style'])='{}'::jsonb
        and b->'payload'->'mediaIntent'->>'version'='1'
        and b->'payload'->'mediaIntent'->>'kind'=b->>'blockType'
        and length(trim(b->'payload'->'mediaIntent'->>'purpose')) between 1 and 1000
        and b->'payload'->'mediaIntent'->'required'='false'::jsonb
        and b->'payload'->'mediaIntent'->>'style'='inherit'
        and b->'payload'->'mediaIntent'->>'aspectRatio' in ('16:9','4:3','1:1')
      ) is not true) then
     raise exception 'Media must be an optional placeholder without an asset or URL.'; end if;
   perform public.complete_ai_generation_job(j.id,p_worker,p_token,p_version,r.course_id,'completed',jsonb_build_object('operationId',r.id),null);
   select * into u from organization_ai_usage_records where id=j.organization_ai_usage_record_id;
   update private.ai_authoring_results set stage='ready',candidate=p_candidate,updated_at=now(),
    credit=jsonb_build_object('status',coalesce(u.status,'unmetered'),'used',u.final_charged_units,'released',greatest(0,u.reserved_units-u.final_charged_units)) where id=r.id;
 elsif p_action='failed' then
   -- Before-provider failures release allocation. All uncertain/invalid outputs
   -- after dispatch settle under the existing started-work policy, without retry.
   perform public.fail_ai_generation_job(j.id,p_worker,p_token,p_version,'Page generation did not finish.',
    case when r.provider_started_at is null then 'validation_error' else 'worker_error' end,'{}',false);
   select * into u from organization_ai_usage_records where id=j.organization_ai_usage_record_id;
   update private.ai_authoring_results set stage='failed',failure=case when provider_started_at is null then
    'Generation could not start. Check access and try again.' else 'We could not confirm a complete page. Your earlier results are still available.' end,
    updated_at=now(),credit=jsonb_build_object('status',coalesce(u.status,'unmetered'),'used',u.final_charged_units,
    'released',greatest(0,u.reserved_units-u.final_charged_units)) where id=r.id;
 else raise exception 'Unknown checkpoint.'; end if;
 return jsonb_build_object('courseId',r.course_id,'lessonId',r.lesson_id);
end $$;

create or replace function public.admin_publish_lesson(p_lesson_id text) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare c text;
begin
 select course_id into c from public.lessons where id=p_lesson_id;
 if auth.uid() is null or c is null or not public.current_user_can_edit_course(c) then raise exception 'Lesson content editor access required.'; end if;
 perform 1 from public.lessons where id=p_lesson_id for update;
 perform 1 from private.media_versions where id in (select version_id from private.media_placements where lesson_id=p_lesson_id and in_draft) order by id for update;
 if exists(select 1 from private.media_placements p join private.media_versions v on v.id=p.version_id where p.lesson_id=p_lesson_id and p.in_draft and v.revoked_at is not null) then raise exception 'Replace revoked media before publishing.' using errcode='23514'; end if;
 if exists(select 1 from lesson_content_blocks b join lesson_pages p on p.id=b.page_id
   where p.lesson_id=p_lesson_id and b.block_type in ('image','video','audio')
   and b.payload->'mediaIntent'->>'version'='1' and b.payload->'mediaIntent'->'required'='true'::jsonb
   and coalesce(trim(b.payload->>'src'),'')='') then
   raise exception 'Choose media for required placeholders before publishing.' using errcode='23514';
 end if;
 return private.media_publish_lesson_base(p_lesson_id);
end $$;

notify pgrst,'reload schema';
commit;
