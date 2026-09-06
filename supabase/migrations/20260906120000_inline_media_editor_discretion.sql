begin;
-- Inline media presence never gates review or publishing, including legacy required flags.
create or replace function public.admin_publish_lesson(p_lesson_id text) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare c text;
begin
 select course_id into c from public.lessons where id=p_lesson_id;
 if auth.uid() is null or c is null or not public.current_user_can_edit_course(c) then raise exception 'Lesson content editor access required.'; end if;
 perform 1 from public.lessons where id=p_lesson_id for update;
 perform 1 from private.media_versions where id in (select version_id from private.media_placements where lesson_id=p_lesson_id and in_draft) order by id for update;
 if exists(select 1 from private.media_placements p join private.media_versions v on v.id=p.version_id where p.lesson_id=p_lesson_id and p.in_draft and v.revoked_at is not null) then raise exception 'Replace revoked media before publishing.' using errcode='23514'; end if;
 return private.media_publish_lesson_base(p_lesson_id);
end $$;
create or replace function public.admin_review_ai_assistance_lesson(p_lesson_id text,p_revision bigint) returns void
language plpgsql security definer set search_path=public,private as $$
declare lid text; cid text;
begin
 perform private.lock_lesson_revision(p_lesson_id,p_revision);
 select id,course_id into lid,cid from lessons where id=p_lesson_id and ai_generation_notes->>'authoringVersion'='2' and ai_generated;
 if lid is null then raise exception 'Assistant lesson unavailable.' using errcode='42501'; end if;
 if exists(select 1 from private.media_placements p join private.media_versions v on v.id=p.version_id where p.lesson_id=lid and p.in_draft and v.revoked_at is not null) then raise exception 'Replace revoked media before reviewing.' using errcode='22023'; end if;
 update lessons set ai_text_status='approved',ai_media_status='approved',ai_publish_status='ready',text_approved_at=now(),text_approved_by=auth.uid(),media_approved_at=now(),media_approved_by=auth.uid() where id=lid;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'ai_assistance_lesson_reviewed','lesson',lid,jsonb_build_object('revision',p_revision));
end $$;
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

notify pgrst,'reload schema';
commit;
