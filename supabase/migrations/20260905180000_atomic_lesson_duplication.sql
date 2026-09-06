begin;
-- A denied media placement must roll back the entire duplicate, including its
-- shell and quiz. Keep the existing editor/entitlement/placement boundaries.
create function public.admin_duplicate_lesson(p_lesson_id text, p_course_id text)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare source public.lessons; result jsonb; target text; target_quiz text;
 page_map jsonb; question_map jsonb;
begin
 if auth.uid() is null or not public.current_user_can_edit_course(p_course_id) then
  raise exception 'Lesson content editor access required.' using errcode='42501';
 end if;
 perform 1 from public.courses where id=p_course_id for update;
 select * into source from public.lessons where id=p_lesson_id and course_id=p_course_id for update;
 if not found then raise exception 'Lesson not found.'; end if;
 result:=public.admin_upsert_lesson('',p_course_id,'Copy of '||source.title,source.description,
  source.cover_image,'draft',(select coalesce(max(sort_order),0)+1 from public.lessons where course_id=p_course_id),
  source.estimated_minutes,source.retry_mode,source.retry_cooldown_seconds,source.retry_requires_reread,
  source.quiz_requires_lesson_completion,source.max_earning_attempts);
 target:=result->>'lessonId';
 select coalesce(jsonb_object_agg(id,'page-'||gen_random_uuid()),'{}') into page_map
 from public.lesson_pages where lesson_id=p_lesson_id;
 insert into public.lesson_pages(id,lesson_id,page_number,title,subtitle,page_type,cover_image)
 select page_map->>id,target,page_number,title,subtitle,page_type,cover_image
 from public.lesson_pages where lesson_id=p_lesson_id order by page_number;
 insert into public.lesson_content_blocks(page_id,block_type,sort_order,payload)
 select page_map->>b.page_id,b.block_type,b.sort_order,b.payload
 from public.lesson_content_blocks b join public.lesson_pages p on p.id=b.page_id
 where p.lesson_id=p_lesson_id order by p.page_number,b.sort_order;
 select id into target_quiz from public.quizzes where lesson_id=target;
 update public.quizzes q set title=s.title,version=s.version from public.quizzes s
 where q.id=target_quiz and s.lesson_id=p_lesson_id;
 select coalesce(jsonb_object_agg(q.id,'question-'||gen_random_uuid()),'{}') into question_map
 from public.quiz_questions q join public.quizzes z on z.id=q.quiz_id where z.lesson_id=p_lesson_id;
 insert into public.quiz_questions(id,quiz_id,question_order,question_type,prompt,explanation,xp)
 select question_map->>q.id,target_quiz,q.question_order,q.question_type,q.prompt,q.explanation,q.xp
 from public.quiz_questions q join public.quizzes z on z.id=q.quiz_id where z.lesson_id=p_lesson_id;
 insert into public.quiz_options(id,question_id,option_order,label,is_correct)
 select 'option-'||gen_random_uuid(),question_map->>o.question_id,o.option_order,o.label,o.is_correct
 from public.quiz_options o where question_map ? o.question_id;
 return jsonb_build_object('lessonId',target,'status','duplicated');
end $$;
revoke all on function public.admin_duplicate_lesson(text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_duplicate_lesson(text,text) to authenticated;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles)
values('public','admin_duplicate_lesson','p_lesson_id text, p_course_id text','ADMIN_AUTHENTICATED',
 'Course editors duplicating a lesson.','Current course editor; source course match; media and entitlement triggers apply atomically.',array['authenticated']);
notify pgrst,'reload schema';
commit;
