begin;
create or replace function private.check_ai_authored_course(p_course text,p_updated timestamptz,p_revisions jsonb) returns void
language plpgsql security definer set search_path=public,private as $$
declare c public.courses; l public.lessons;
begin
 if not public.current_user_can_edit_course(p_course) then raise exception 'Course editing access required.' using errcode='42501'; end if;
 select * into c from courses where id=p_course for update;
 if c.ai_generation_notes->>'authoringVersion' is distinct from '3' then raise exception 'This course uses its existing review workflow.' using errcode='22023'; end if;
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
 and (coalesce(trim(a.url),'')='' or a.generation_status='failed' or a.review_status<>'approved')) then raise exception 'Complete the required cover review.' using errcode='22023'; end if;
 if exists(select 1 from private.media_placements p join private.media_versions v on v.id=p.version_id where p.course_id=c.id and p.in_draft and v.revoked_at is not null) then raise exception 'Replace revoked media before reviewing.' using errcode='22023'; end if;
end $$;
commit;
