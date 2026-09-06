begin;
create or replace function public.admin_review_ai_assistance_lesson(p_lesson_id text,p_revision bigint) returns void
language plpgsql security definer set search_path=public,private as $$
declare lid text; cid text;
begin
 perform private.lock_lesson_revision(p_lesson_id,p_revision);
 select id,course_id into lid,cid from lessons where id=p_lesson_id and ai_generation_notes->>'authoringVersion'='2' and ai_generated;
 if lid is null then raise exception 'Assistant lesson unavailable.' using errcode='42501'; end if;
 if exists(select 1 from learning_media_assets a where a.lesson_id=lid and a.metadata->>'required'='true'
 and coalesce(a.metadata->>'targetKind',case a.asset_type when 'cover' then 'lesson_cover' when 'thumbnail' then 'lesson_thumbnail' else '' end) in ('lesson_cover','lesson_thumbnail')
 and (coalesce(trim(a.url),'')='' or a.generation_status='failed')) then raise exception 'Complete the required lesson cover before reviewing.' using errcode='22023'; end if;
 if exists(select 1 from private.media_placements p join private.media_versions v on v.id=p.version_id where p.lesson_id=lid and p.in_draft and v.revoked_at is not null) then raise exception 'Replace revoked media before reviewing.' using errcode='22023'; end if;
 update lessons set ai_text_status='approved',ai_media_status='approved',ai_publish_status='ready',text_approved_at=now(),text_approved_by=auth.uid(),media_approved_at=now(),media_approved_by=auth.uid() where id=lid;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'ai_assistance_lesson_reviewed','lesson',lid,jsonb_build_object('revision',p_revision));
end $$;
commit;
