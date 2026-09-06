begin;
alter table private.ai_authoring_results add column application_started_at timestamptz,
 add column application_error text;

create function public.admin_prepare_ai_page_apply(p_id uuid) returns void
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) then raise exception 'Result unavailable.' using errcode='42501'; end if;
 if r.receipt is not null then return; end if;
 if r.candidate is null or r.deleted_at is not null then raise exception 'This result is unavailable.' using errcode='PT409'; end if;
 update private.ai_authoring_results set application_started_at=coalesce(application_started_at,now()),application_error=null,updated_at=now() where id=p_id;
end $$;
revoke all on function public.admin_prepare_ai_page_apply(uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_prepare_ai_page_apply(uuid) to authenticated;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles)
values('public','admin_prepare_ai_page_apply','p_id uuid','ADMIN_AUTHENTICATED','AI page application','Current course editor and retained candidate; no content writes.',array['authenticated']);

create or replace function private.ai_authoring_projection(r private.ai_authoring_results, p_detail boolean)
returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('id',r.id,'lessonId',r.lesson_id,'courseId',r.course_id,
 'title',coalesce(r.candidate->>'title',r.title),'stage',r.stage,'createdAt',r.created_at,'updatedAt',r.updated_at,
 'sourceRevision',r.source_revision,'position',r.insertion_position,'pageType',r.page_type,
 'focus',r.focus,'refinement',r.refinement,'parentId',r.parent_id,'estimatedUnits',r.estimated_units,
 'metered',r.organization_id is not null,'quoteExpiresAt',r.expires_at,'stopRequested',r.stop_requested,
 'candidate',case when p_detail then r.candidate else null end,'receipt',case when p_detail then r.receipt else r.receipt-'page'-'blocks' end,
 'applicationState',case when r.receipt is not null then 'saved' when r.application_error is not null then 'not_saved' when r.application_started_at is not null then 'checking' else 'not_started' end,'applicationError',r.application_error,
 'credit',r.credit,'failure',r.failure,'deleted',r.deleted_at is not null)
$$;

create or replace function public.admin_apply_ai_page(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; pid text; b jsonb; n integer:=0; rev bigint; base integer;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) then raise exception 'Result unavailable.' using errcode='42501'; end if;
 if r.receipt is not null then return r.receipt; end if;
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
 text_approved_at=case when ai_generated then null else text_approved_at end,
 text_approved_by=case when ai_generated then null else text_approved_by end where id=r.lesson_id;
 select draft_revision into rev from lessons where id=r.lesson_id;
 update private.ai_authoring_results set receipt=jsonb_build_object('status','saved','pageId',pid,'lessonId',r.lesson_id,
 'draftRevision',rev,'savedAt',now(),'page',(select to_jsonb(p) from lesson_pages p where id=pid),
 'blocks',(select coalesce(jsonb_agg(to_jsonb(b) order by sort_order),'[]') from lesson_content_blocks b where page_id=pid)),application_error=null,updated_at=now() where id=r.id returning * into r;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'ai_page_applied','lesson',r.lesson_id,jsonb_build_object('resultId',r.id,'pageId',pid));
 return r.receipt;
 exception when sqlstate 'PT409' then
   update private.ai_authoring_results set application_error=sqlerrm,updated_at=now() where id=p_id;
   return jsonb_build_object('status','not_saved','error',sqlerrm);
 end;
end $$;

create or replace function public.admin_delete_ai_result(p_id uuid) returns void
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) then raise exception 'Result unavailable.' using errcode='42501'; end if;
 if r.application_started_at is not null and r.receipt is null and r.application_error is null then
 raise exception 'Confirm the save outcome before deleting this result.' using errcode='PT409'; end if;
 if r.stage in ('starting','writing') then raise exception 'Stop generation before deleting this result.' using errcode='PT409'; end if;
 -- Retain the receipt/ledger identity while removing candidate content.
 update private.ai_authoring_results set deleted_at=now(),candidate=null,receipt=receipt-'page'-'blocks',context='{}',focus='',refinement='',updated_at=now() where id=p_id;
end $$;
notify pgrst,'reload schema';
commit;
