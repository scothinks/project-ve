begin;
-- One explicit review boundary now handles legacy and current authoring drafts.
create or replace function private.check_ai_authored_course(p_course text,p_updated timestamptz,p_revisions jsonb) returns void
language plpgsql security definer set search_path=public,private as $$
declare c public.courses; l public.lessons;
begin
 if not public.current_user_can_edit_course(p_course) then raise exception 'Course editing access required.' using errcode='42501'; end if;
 select * into c from courses where id=p_course for update;
 if c.updated_at is distinct from p_updated or jsonb_typeof(p_revisions) is distinct from 'object' then raise exception 'The course changed. Reopen Review.' using errcode='PT409'; end if;
 perform private.lock_ai_authoring_source(c.id,null);
 perform 1 from learning_media_assets where course_id=c.id order by id for update;
 perform 1 from private.media_versions where id in(select version_id from private.media_placements where course_id=c.id and in_draft) order by id for update;
 if not exists(select 1 from lessons where course_id=c.id and status<>'archived') or
 (select count(*) from jsonb_object_keys(p_revisions))<>(select count(*) from lessons where course_id=c.id and status<>'archived') then raise exception 'The lessons changed. Reopen Review.' using errcode='PT409'; end if;
 if length(trim(coalesce(c.title,'')))=0 or length(trim(coalesce(c.description,'')))=0 then raise exception 'Complete the course title and description.' using errcode='22023'; end if;
 if (coalesce(trim(c.thumbnail->>'src'),'')='' and not exists(select 1 from learning_media_assets a where a.course_id=c.id and a.lesson_id is null and (a.metadata->>'targetKind'='course_thumbnail' or a.asset_type='thumbnail' or lower(a.placement)='course_thumbnail') and coalesce(trim(a.url),'')<>'')) or not exists(select 1 from learning_media_assets a where a.course_id=c.id and a.lesson_id is null and (a.metadata->>'targetKind'='course_cover' or a.asset_type='cover' or lower(a.placement)='course_cover') and coalesce(trim(a.url),'')<>'') then raise exception 'Add the course thumbnail and cover.' using errcode='22023'; end if;
 for l in select * from lessons where course_id=c.id and status<>'archived' order by id for update loop
 perform private.lock_lesson_revision(l.id,(p_revisions->>l.id)::bigint);
 if length(trim(l.title))=0 or not exists(select 1 from lesson_pages where lesson_id=l.id) or exists(
 select 1 from lesson_pages p where p.lesson_id=l.id and not exists(select 1 from lesson_content_blocks b where b.page_id=p.id and
 ((b.block_type in ('text','callout') and length(trim(regexp_replace(coalesce(b.payload->>'body',''),'<[^>]*>','','g')))>0) or b.block_type='table')))
 then raise exception 'Complete the lesson teaching content before review.' using errcode='22023'; end if;
 if l.quiz_requires_lesson_completion and not exists(select 1 from quizzes q join quiz_questions x on x.quiz_id=q.id where q.lesson_id=l.id) then raise exception 'Complete the required quiz.' using errcode='22023'; end if;
 end loop;
 if exists(select 1 from quiz_questions q join quizzes z on z.id=q.quiz_id join lessons quiz_lesson on quiz_lesson.id=z.lesson_id where quiz_lesson.course_id=c.id and quiz_lesson.status<>'archived' and
 (length(trim(q.prompt))=0 or not exists(select 1 from quiz_options o where o.question_id=q.id and o.is_correct) or (q.question_type='single_choice' and (select count(*) from quiz_options o where o.question_id=q.id and o.is_correct)<>1))) then raise exception 'Check the quiz answer keys.' using errcode='22023'; end if;
 if exists(select 1 from learning_media_assets a where a.course_id=c.id and a.metadata->>'required'='true'
 and coalesce(a.metadata->>'targetKind',case a.asset_type when 'cover' then 'lesson_cover' when 'thumbnail' then 'lesson_thumbnail' else '' end) in ('course_thumbnail','lesson_cover','lesson_thumbnail')
 and (coalesce(trim(a.url),'')='' or a.generation_status='failed')) then raise exception 'Complete the required cover review.' using errcode='22023'; end if;
 if exists(select 1 from private.media_placements p join private.media_versions v on v.id=p.version_id where p.course_id=c.id and p.in_draft and v.revoked_at is not null) then raise exception 'Replace revoked media before reviewing.' using errcode='22023'; end if;
end $$;
create or replace function public.admin_review_ai_authored_course(p_course text,p_updated timestamptz,p_revisions jsonb) returns void
language plpgsql security definer set search_path=public,private as $$
begin
 perform private.check_ai_authored_course(p_course,p_updated,p_revisions);
 update learning_media_assets set review_status='approved' where course_id=p_course and coalesce(trim(url),'')<>'' and generation_status<>'failed';
 update lessons set ai_text_status='approved',ai_media_status='approved',ai_publish_status='ready',text_approved_at=now(),text_approved_by=auth.uid(),media_approved_at=now(),media_approved_by=auth.uid() where course_id=p_course and status<>'archived';
 update quizzes set ai_text_status='approved',text_approved_at=now(),text_approved_by=auth.uid() where lesson_id in(select id from lessons where course_id=p_course and status<>'archived');
 update courses set ai_text_status='approved',ai_media_status='approved',ai_publish_status='ready',text_approved_at=now(),text_approved_by=auth.uid(),media_approved_at=now(),media_approved_by=auth.uid() where id=p_course;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'ai_authored_course_reviewed','course',p_course,jsonb_build_object('revisions',p_revisions));
end $$;
create or replace function public.admin_publish_ai_authored_course(p_course text,p_updated timestamptz,p_revisions jsonb) returns void
language plpgsql security definer set search_path=public,private as $$
declare l public.lessons;
begin
 perform private.check_ai_authored_course(p_course,p_updated,p_revisions);
 if exists(select 1 from learning_media_assets where course_id=p_course and metadata->>'required'='true' and coalesce(metadata->>'targetKind','') in ('course_thumbnail','lesson_cover','lesson_thumbnail') and review_status<>'approved') then raise exception 'Review changed covers before publishing.' using errcode='22023'; end if;
 if not exists(select 1 from courses where id=p_course and ai_text_status='approved' and ai_media_status='approved' and text_approved_by is not null) then raise exception 'Review the course before publishing.' using errcode='22023'; end if;
 for l in select * from lessons where course_id=p_course and status<>'archived' order by id loop
 if l.ai_text_status<>'approved' or l.text_approved_by is null then raise exception 'Review changed lessons before publishing.' using errcode='22023'; end if;
 perform public.admin_publish_lesson(l.id);
 end loop;
 update courses set status='published',ai_publish_status='published' where id=p_course;
 update lessons set ai_publish_status='published' where course_id=p_course and status<>'archived';
 update quizzes set status='published' where lesson_id in(select id from lessons where course_id=p_course and status<>'archived');
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'ai_authored_course_published','course',p_course,jsonb_build_object('revisions',p_revisions));
end $$;
create or replace function public.admin_set_ai_course_artwork(p_course text,p_version uuid,p_target text) returns void
language plpgsql security definer set search_path=public,private as $$
declare c public.courses; v private.media_versions; asset_id uuid;
begin
 if not public.current_user_can_edit_course(p_course) then raise exception 'Course editing access required.' using errcode='42501'; end if;
 select * into c from courses where id=p_course for update;
 if p_target is null or p_target not in ('course_thumbnail','course_cover') then raise exception 'Choose course artwork.' using errcode='22023'; end if;
 select * into v from private.media_versions where id=p_version for update;
 if v.id is null or not private.media_permitted(p_version,c.organization_id) then raise exception 'Media is not permitted for this course.' using errcode='42501'; end if;
 if v.mime_type not like 'image/%' or coalesce(trim(v.alt_text),'')='' then raise exception 'Choose an image with alt text.' using errcode='22023'; end if;
 select id into asset_id from learning_media_assets where course_id=c.id and lesson_id is null and metadata->>'targetKind'=p_target order by id limit 1 for update;
 if asset_id is null then
 insert into learning_media_assets(course_id,asset_type,placement,source,url,alt_text,metadata,review_status,generation_status,sort_order)
 values(c.id,case when p_target='course_cover' then 'cover' else 'thumbnail' end,p_target,'library','/api/media/'||v.id,v.alt_text,jsonb_build_object('targetKind',p_target,'libraryVersionId',v.id),'draft','completed',0);
 else
 update learning_media_assets set url='/api/media/'||v.id,alt_text=v.alt_text,source='library',metadata=metadata||jsonb_build_object('libraryVersionId',v.id),review_status='draft',generation_status='completed' where id=asset_id;
 end if;
 update courses set thumbnail=case when p_target='course_thumbnail' then jsonb_build_object('src','/api/media/'||v.id,'alt',v.alt_text) else thumbnail end,
 ai_text_status='draft',ai_media_status='not_started',ai_publish_status='not_ready',text_approved_at=null,text_approved_by=null,media_approved_at=null,media_approved_by=null where id=c.id;
end $$;
create or replace function public.admin_review_ai_assistance_lesson(p_lesson_id text,p_revision bigint) returns void
language plpgsql security definer set search_path=public,private as $$
declare lid text; cid text;
begin
 perform private.lock_lesson_revision(p_lesson_id,p_revision);
 select id,course_id into lid,cid from lessons where id=p_lesson_id and ai_generated;
 if lid is null then raise exception 'Assistant lesson unavailable.' using errcode='42501'; end if;
 if exists(select 1 from learning_media_assets a where a.lesson_id=lid and a.metadata->>'required'='true'
 and coalesce(a.metadata->>'targetKind',case a.asset_type when 'cover' then 'lesson_cover' when 'thumbnail' then 'lesson_thumbnail' else '' end) in ('lesson_cover','lesson_thumbnail')
 and (coalesce(trim(a.url),'')='' or a.generation_status='failed')) then raise exception 'Complete the required lesson cover before reviewing.' using errcode='22023'; end if;
 if exists(select 1 from private.media_placements p join private.media_versions v on v.id=p.version_id where p.lesson_id=lid and p.in_draft and v.revoked_at is not null) then raise exception 'Replace revoked media before reviewing.' using errcode='22023'; end if;
 update learning_media_assets set review_status='approved' where lesson_id=lid and coalesce(trim(url),'')<>'' and generation_status<>'failed';
 update lessons set ai_text_status='approved',ai_media_status='approved',ai_publish_status='ready',text_approved_at=now(),text_approved_by=auth.uid(),media_approved_at=now(),media_approved_by=auth.uid() where id=lid;
 update quizzes set ai_text_status='approved',text_approved_at=now(),text_approved_by=auth.uid() where lesson_id=lid and ai_generated;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'ai_assistance_lesson_reviewed','lesson',lid,jsonb_build_object('revision',p_revision));
end $$;

create function public.admin_set_editorial_cover(p_target text,p_id text,p_version uuid) returns void
language plpgsql security definer set search_path=public,private as $$
declare l public.lessons; v private.media_versions; org uuid;
begin
 if p_target is distinct from 'lesson_thumbnail' then raise exception 'Choose a lesson cover.' using errcode='22023'; end if;
 select * into l from lessons where id=p_id for update;
 if l.id is null or not public.current_user_can_edit_course(l.course_id) then raise exception 'Lesson unavailable.' using errcode='42501'; end if;
 select organization_id into org from courses where id=l.course_id;
 select * into v from private.media_versions where id=p_version for update;
 if v.id is null or not private.media_permitted(v.id,org) then raise exception 'Media is not permitted for this lesson.' using errcode='42501'; end if;
 if v.mime_type not like 'image/%' or coalesce(trim(v.alt_text),'')='' then raise exception 'Choose an image with alt text.' using errcode='22023'; end if;
 update lessons set cover_image=jsonb_build_object('src','/api/media/'||v.id,'alt',v.alt_text),ai_text_status='draft',ai_media_status='draft',ai_publish_status='not_ready',text_approved_at=null,text_approved_by=null,media_approved_at=null,media_approved_by=null where id=l.id;
 update learning_media_assets set url='/api/media/'||v.id,alt_text=v.alt_text,source='library',generation_status='completed',review_status='draft',metadata=metadata||jsonb_build_object('libraryVersionId',v.id)
 where lesson_id=l.id and (metadata->>'targetKind' in ('lesson_cover','lesson_thumbnail') or placement in ('lesson_cover','lesson_thumbnail'));
 update courses set ai_text_status='draft',ai_media_status='draft',ai_publish_status='not_ready',text_approved_at=null,text_approved_by=null,media_approved_at=null,media_approved_by=null where id=l.course_id;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'lesson_cover_selected','lesson',l.id,jsonb_build_object('versionId',v.id));
end $$;
revoke all on function public.admin_set_editorial_cover(text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_set_editorial_cover(text,text,uuid) to authenticated;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles) values
('public','admin_set_editorial_cover','p_target text, p_id text, p_version uuid','ADMIN_AUTHENTICATED','Lesson editors','Same-course access; current registry permission; image and alt validation; resets review without publishing.',array['authenticated']);

notify pgrst,'reload schema';
commit;
