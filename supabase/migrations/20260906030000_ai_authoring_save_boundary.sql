begin;
create or replace function private.ai_authoring_can_access(p_result private.ai_authoring_results)
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (
   (public.current_user_can_edit_course(p_result.course_id) and exists(select 1 from courses c where c.id=p_result.course_id and c.organization_id is not distinct from p_result.organization_id))
   or (not exists(select 1 from courses where id=p_result.course_id) and (
     public.current_user_is_admin()
     or (p_result.organization_id is not null and public.current_user_can_edit_organization_content(p_result.organization_id))
     or (p_result.organization_id is null and public.current_user_has_platform_catalog_role(
       array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[])))))
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
 'blocks',(select coalesce(jsonb_agg(to_jsonb(saved_block) order by saved_block.sort_order),'[]') from lesson_content_blocks saved_block where saved_block.page_id=pid)),application_error=null,updated_at=now() where id=r.id returning * into r;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'ai_page_applied','lesson',r.lesson_id,jsonb_build_object('resultId',r.id,'pageId',pid));
 return r.receipt;
 exception when sqlstate 'PT409' then
   update private.ai_authoring_results set application_error=sqlerrm,updated_at=now() where id=p_id;
   return jsonb_build_object('status','not_saved','error',sqlerrm);
 end;
end $$;
notify pgrst,'reload schema';
commit;
