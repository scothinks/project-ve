begin;

-- Assistant-led requests snapshot scoped teaching content without provider work.
create or replace function public.admin_quote_ai_page(p_lesson_id text,p_revision bigint,p_focus text,p_page_type text,
 p_position integer,p_parent_id uuid default null,p_refinement text default '')
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare l public.lessons; c public.courses; r private.ai_authoring_results; parent private.ai_authoring_results; ctx jsonb; page_count integer; assistant boolean:=p_page_type='auto';
begin
 perform private.lock_lesson_revision(p_lesson_id,p_revision);
 select * into l from lessons where id=p_lesson_id;
 select * into c from courses where id=l.course_id;
 select count(*) into page_count from lesson_pages where lesson_id=l.id;
 if assistant then p_position:=page_count+1; end if;
 if p_page_type is null or p_page_type not in ('auto','concept','scenario','reflection','summary') or p_focus is null or length(p_focus)>1000
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
 with teaching as (
   select b.page_id,string_agg(
     coalesce(b.payload->>'heading',b.payload->>'title','')||' '||coalesce(b.payload->>'body','')||' '||
     case when b.block_type='table' then coalesce((b.payload->'columns')::text,'')||' '||coalesce((b.payload->'rows')::text,'') else '' end,
     E'\n' order by b.sort_order) content
   from lesson_content_blocks b join lesson_pages p on p.id=b.page_id
   where p.lesson_id=l.id and b.block_type in ('text','callout','table') group by b.page_id
 ), pages as (
   select p.*,coalesce(t.content,'') content from lesson_pages p left join teaching t on t.page_id=p.id
   where p.lesson_id=l.id order by p.page_number limit 20
 )
 select jsonb_build_object('course',jsonb_build_object('title',c.title,'category',c.category,'level',c.level),
 'lesson',jsonb_build_object('title',l.title,'description',coalesce(l.description,'')),
 'existingPages',coalesce((select jsonb_agg(jsonb_build_object('title',p.title,'pageType',p.page_type,
   'content',left(regexp_replace(p.content,'<[^>]*>',' ','g'),1800)) order by p.page_number) from pages p),'[]'),
 'assistant',assistant,'pageCount',page_count,'contextTruncated',page_count>20 or exists(select 1 from pages where length(content)>1800),
 'focus',trim(p_focus),'pageType',case when assistant then 'concept' else p_page_type end,'priorDraft',parent.candidate,
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
   perform public.complete_ai_generation_job(j.id,p_worker,p_token,p_version,r.course_id,'completed',jsonb_build_object('operationId',r.id),null);
   select * into u from organization_ai_usage_records where id=j.organization_ai_usage_record_id;
   update private.ai_authoring_results set stage='ready',candidate=p_candidate,updated_at=now(),
    insertion_position=case when r.context->>'assistant'='true' then (p_candidate->>'position')::integer else r.insertion_position end,
    page_type=case when r.context->>'assistant'='true' then p_candidate->>'pageType' else r.page_type end,
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


create or replace function public.admin_prepare_ai_page_apply(p_id uuid) returns void
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) then raise exception 'Result unavailable.' using errcode='42501'; end if;
 if r.receipt is not null then return; end if;
 if r.candidate->>'decision'='review_quiz' then raise exception 'This recommendation does not add a page.' using errcode='PT409'; end if;
 if r.candidate is null or r.deleted_at is not null then raise exception 'This result is unavailable.' using errcode='PT409'; end if;
 update private.ai_authoring_results set application_started_at=coalesce(application_started_at,now()),application_error=null,updated_at=now() where id=p_id;
end $$;

create or replace function public.admin_apply_ai_page(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; pid text; b jsonb; n integer:=0; rev bigint; base integer;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) then raise exception 'Result unavailable.' using errcode='42501'; end if;
 if r.receipt is not null then return r.receipt; end if;
 if r.candidate->>'decision'='review_quiz' then raise exception 'This recommendation does not add a page.' using errcode='PT409'; end if;
 if r.candidate is null or r.deleted_at is not null then raise exception 'This result is not ready to add.' using errcode='PT409'; end if;
 begin
 perform private.lock_lesson_revision(r.lesson_id,r.source_revision);
 if not exists(select 1 from lessons l join courses c on c.id=l.course_id
   where l.id=r.lesson_id and c.id=r.course_id and c.organization_id is not distinct from r.organization_id) then
   raise exception 'The lesson destination changed. Create a new version for the current lesson.' using errcode='PT409'; end if;
 if exists(select 1 from lesson_pages where lesson_id=r.lesson_id and lower(trim(title))=lower(trim(r.candidate->>'title'))) then
   raise exception 'A page with this title already exists. Refine the result before adding it.' using errcode='PT409'; end if;
 pid:='page-'||replace(r.id::text,'-','');
 select coalesce(max(page_number),0)+1 into base from lesson_pages where lesson_id=r.lesson_id;
 update lesson_pages set page_number=page_number+base where lesson_id=r.lesson_id and page_number>=r.insertion_position;
 update lesson_pages set page_number=page_number-base+1 where lesson_id=r.lesson_id and page_number>=r.insertion_position+base;
 insert into lesson_pages(id,lesson_id,page_number,title,subtitle,page_type,cover_image)
 values(pid,r.lesson_id,r.insertion_position,r.candidate->>'title',r.candidate->>'subtitle',
 (case when r.candidate->>'pageType'='scenario' then 'example' else r.candidate->>'pageType' end)::lesson_page_type,'{}');
 for b in select value from jsonb_array_elements(r.candidate->'blocks') loop
   n:=n+1;
   insert into lesson_content_blocks(page_id,block_type,sort_order,payload)
   values(pid,(b->>'blockType')::lesson_content_block_type,n,b->'payload');
 end loop;
 -- Existing AI lesson review is invalidated, never approved by generation.
 update lessons set ai_text_status=case when ai_generated then 'draft' else ai_text_status end,
 ai_publish_status=case when ai_generated then 'not_ready' else ai_publish_status end,
 text_approved_at=case when ai_generated then null else text_approved_at end,
 text_approved_by=case when ai_generated then null else text_approved_by end where id=r.lesson_id;
 select draft_revision into rev from lessons where id=r.lesson_id;
 update private.ai_authoring_results set receipt=jsonb_build_object('status','saved','pageId',pid,'lessonId',r.lesson_id,
 'draftRevision',rev,'savedAt',now(),'page',(select to_jsonb(p) from lesson_pages p where id=pid),
 'blocks',(select coalesce(jsonb_agg(to_jsonb(saved_block) order by saved_block.sort_order),'[]') from lesson_content_blocks saved_block where saved_block.page_id=pid)),application_error=null,updated_at=now() where id=r.id returning * into r;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'ai_page_applied','lesson',r.lesson_id,jsonb_build_object('resultId',r.id,'pageId',pid));
 return r.receipt;
 exception when sqlstate 'PT409' or sqlstate '42501' then
   update private.ai_authoring_results set application_error=sqlerrm,updated_at=now() where id=p_id;
   return jsonb_build_object('status','not_saved','error',sqlerrm);
 end;
end $$;

create or replace function private.ai_authoring_projection(r private.ai_authoring_results, p_detail boolean)
returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('id',r.id,'lessonId',r.lesson_id,'courseId',r.course_id,
 'title',coalesce(r.candidate->>'title',r.title),'stage',r.stage,'createdAt',r.created_at,'updatedAt',r.updated_at,
 'sourceRevision',r.source_revision,'position',r.insertion_position,'pageType',r.page_type,
 'assistant',coalesce(r.context->>'assistant','false')='true','focus',r.focus,'refinement',r.refinement,'parentId',r.parent_id,'estimatedUnits',r.estimated_units,
 'metered',r.organization_id is not null,'quoteExpiresAt',r.expires_at,'stopRequested',r.stop_requested,
 'candidate',case when p_detail then r.candidate else null end,'receipt',case when p_detail then r.receipt else r.receipt-'page'-'blocks' end,
 'applicationState',case when r.receipt is not null then 'saved' when r.application_error is not null then 'not_saved' when r.application_started_at is not null then 'checking' else 'not_started' end,'applicationError',r.application_error,
 'credit',r.credit,'failure',r.failure,'deleted',r.deleted_at is not null,'targetAvailable',exists(select 1 from lessons l join courses c on c.id=l.course_id where l.id=r.lesson_id and c.id=r.course_id and c.organization_id is not distinct from r.organization_id))
$$;

notify pgrst,'reload schema';
commit;
