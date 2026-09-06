begin;
create or replace function public.admin_apply_ai_course(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; cid text; lid text; pid text; qid text; question_id text;
 item jsonb; lesson jsonb; page jsonb; block jsonb; question jsonb; opt jsonb;
 ls jsonb:='[]'; ps jsonb:='[]'; bs jsonb:='[]'; qs jsonb:='[]'; questions jsonb:='[]'; opts jsonb:='[]';
 ids text[]:='{}'; ln integer:=0; pn integer; bn integer; qn integer; onum integer; notes jsonb;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) then raise exception 'Result unavailable.' using errcode='42501'; end if;
 if r.receipt is not null then return r.receipt; end if;
 if r.kind<>'course_draft' or r.stage not in ('ready','failed','stopped') or r.deleted_at is not null or r.application_started_at is null or coalesce(jsonb_array_length(r.candidate->'completed'),0)=0 then raise exception 'Review the completed lessons first.' using errcode='PT409'; end if;
 begin
 perform private.validate_ai_course_outline(r.course_outline);
 cid:='course-ai-'||replace(r.id::text,'-','');
 -- A deleted applied destination is never recreated: its permanent receipt wins above.
 if exists(select 1 from courses where id=cid) then raise exception 'The destination already exists.' using errcode='PT409'; end if;
 notes:=jsonb_build_object('authoringVersion',3,'resultId',r.id);
 for item in select value from jsonb_array_elements(r.candidate->'completed') order by (value->>'index')::integer loop
 lesson:=item->'lesson';
 perform private.validate_ai_assistance('lesson_draft',lesson,1);
 perform private.validate_ai_assistance('quiz',lesson,(r.context->>'questionsPerLesson')::integer);
 ln:=ln+1; lid:=cid||'-lesson-'||ln; ids:=array_append(ids,lid);
 ls:=ls||jsonb_build_array(jsonb_build_object('id',lid,'course_id',cid,'slug',lid,'title',lesson->>'title','description',lesson->>'description','status','draft','sort_order',ln,'estimated_minutes',5,
 'retry_mode','anytime','retry_cooldown_seconds',0,'retry_requires_reread',false,'quiz_requires_lesson_completion',jsonb_array_length(lesson->'questions')>0,'max_earning_attempts',1,
 'ai_text_status','draft','ai_media_status','not_started','ai_publish_status','not_ready','ai_generated',true,'ai_generation_notes',notes));
 pn:=0;
 for page in select value from jsonb_array_elements(lesson->'pages') loop
 pn:=pn+1; pid:=lid||'-page-'||pn; bn:=0;
 ps:=ps||jsonb_build_array(jsonb_build_object('id',pid,'lesson_id',lid,'page_number',pn,'title',page->>'title','subtitle',page->>'subtitle','page_type',case when page->>'pageType'='scenario' then 'example' else page->>'pageType' end));
 for block in select value from jsonb_array_elements(page->'blocks') loop
 bn:=bn+1; bs:=bs||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'page_id',pid,'block_type',block->>'blockType','sort_order',bn,'payload',block->'payload'));
 end loop;
 end loop;
 if jsonb_array_length(lesson->'questions')>0 then
 qid:=lid||'-quiz'; qn:=0;
 qs:=qs||jsonb_build_array(jsonb_build_object('id',qid,'lesson_id',lid,'title','Lesson quiz','version',1,'status','draft','ai_text_status','draft','ai_generated',true,'ai_generation_notes',notes));
 for question in select value from jsonb_array_elements(lesson->'questions') loop
 qn:=qn+1; question_id:=qid||'-'||qn; onum:=0;
 questions:=questions||jsonb_build_array(jsonb_build_object('id',question_id,'quiz_id',qid,'question_order',qn,'question_type','single_choice','prompt',question->>'prompt','explanation',question->>'explanation','xp',10));
 for opt in select value from jsonb_array_elements(question->'options') loop
 onum:=onum+1; opts:=opts||jsonb_build_array(jsonb_build_object('id',question_id||'-'||onum,'question_id',question_id,'option_order',onum,'label',opt->>'label','is_correct',opt->'isCorrect'));
 end loop;
 end loop;
 end if;
 end loop;
 perform private.materialize_ai_course_tree(cid,jsonb_build_object('id',cid,'slug',cid,'title',r.course_outline->>'title','description',r.course_outline->>'description',
 'category','General','level','beginner','status','draft','sort_order',0,'estimated_minutes',ln*5,'ai_text_status','draft','ai_media_status','not_started','ai_publish_status','not_ready','ai_generated',true,'ai_generation_notes',notes),null,ls,ps,bs,qs,questions,opts,'[]');
 update courses set organization_id=r.organization_id,catalog_scope=(case when r.organization_id is null then 'platform' else 'organization' end)::course_catalog_scope,
 intended_audience=r.context->'brief'->>'audience' where id=cid;
 update private.ai_authoring_results set course_id=cid,receipt=jsonb_build_object('status','saved','courseId',cid,'lessonIds',ids,'savedAt',now()),application_error=null,updated_at=now() where id=p_id returning * into r;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'ai_course_candidate_applied','course',cid,jsonb_build_object('resultId',r.id,'lessonCount',ln));
 return r.receipt;
 exception when others then
 update private.ai_authoring_results set application_error=case when sqlstate in ('PT409','42501','22023','23505') then sqlerrm else 'The save failed. Your completed lessons are retained; try again.' end,updated_at=now() where id=p_id;
 return jsonb_build_object('status','not_saved','error',(select application_error from private.ai_authoring_results where id=p_id));
 end;
end $$;
create function private.check_ai_authored_course(p_course text,p_updated timestamptz,p_revisions jsonb) returns void
language plpgsql security definer set search_path=public,private as $$
declare c public.courses; l public.lessons;
begin
 if not public.current_user_can_edit_course(p_course) then raise exception 'Course editing access required.' using errcode='42501'; end if;
 select * into c from courses where id=p_course for update;
 if c.ai_generation_notes->>'authoringVersion' is distinct from '3' then raise exception 'This course uses its existing review workflow.' using errcode='22023'; end if;
 if c.updated_at is distinct from p_updated or jsonb_typeof(p_revisions) is distinct from 'object' then raise exception 'The course changed. Reopen Review.' using errcode='PT409'; end if;
 if not exists(select 1 from lessons where course_id=c.id and status<>'archived') or
 (select count(*) from jsonb_object_keys(p_revisions))<>(select count(*) from lessons where course_id=c.id and status<>'archived') then raise exception 'The lessons changed. Reopen Review.' using errcode='PT409'; end if;
 if length(trim(coalesce(c.title,'')))=0 or length(trim(coalesce(c.description,'')))=0 then raise exception 'Complete the course title and description.' using errcode='22023'; end if;
 if coalesce(trim(c.thumbnail->>'src'),'')='' or coalesce(trim(c.cover_image->>'src'),'')='' then raise exception 'Add the course thumbnail and cover.' using errcode='22023'; end if;
 for l in select * from lessons where course_id=c.id and status<>'archived' order by id for update loop
 perform private.lock_lesson_revision(l.id,(p_revisions->>l.id)::bigint);
 if length(trim(l.title))=0 or not exists(select 1 from lesson_pages where lesson_id=l.id) or exists(
 select 1 from lesson_pages p where p.lesson_id=l.id and not exists(select 1 from lesson_content_blocks b where b.page_id=p.id and
 ((b.block_type in ('text','callout') and length(trim(regexp_replace(coalesce(b.payload->>'body',''),'<[^>]*>','','g')))>0) or b.block_type='table')))
 then raise exception 'Complete the lesson teaching content before review.' using errcode='22023'; end if;
 if l.quiz_requires_lesson_completion and not exists(select 1 from quizzes q join quiz_questions x on x.quiz_id=q.id where q.lesson_id=l.id) then raise exception 'Complete the required quiz.' using errcode='22023'; end if;
 end loop;
 if exists(select 1 from quiz_questions q join quizzes z on z.id=q.quiz_id join lessons l on l.id=z.lesson_id where l.course_id=c.id and l.status<>'archived' and
 (length(trim(q.prompt))=0 or not exists(select 1 from quiz_options o where o.question_id=q.id and o.is_correct) or (q.question_type='single_choice' and (select count(*) from quiz_options o where o.question_id=q.id and o.is_correct)<>1))) then raise exception 'Check the quiz answer keys.' using errcode='22023'; end if;
 if exists(select 1 from learning_media_assets a where a.course_id=c.id and a.metadata->>'required'='true'
 and coalesce(a.metadata->>'targetKind',case a.asset_type when 'cover' then 'lesson_cover' when 'thumbnail' then 'lesson_thumbnail' else '' end) in ('course_thumbnail','lesson_cover','lesson_thumbnail')
 and (coalesce(trim(a.url),'')='' or a.generation_status='failed' or a.review_status<>'approved')) then raise exception 'Complete the required cover review.' using errcode='22023'; end if;
 if exists(select 1 from private.media_placements p join private.media_versions v on v.id=p.version_id where p.course_id=c.id and p.in_draft and v.revoked_at is not null) then raise exception 'Replace revoked media before reviewing.' using errcode='22023'; end if;
end $$;
create function public.admin_review_ai_authored_course(p_course text,p_updated timestamptz,p_revisions jsonb) returns void
language plpgsql security definer set search_path=public,private as $$
begin
 perform private.check_ai_authored_course(p_course,p_updated,p_revisions);
 update lessons set ai_text_status='approved',ai_media_status='approved',ai_publish_status='ready',text_approved_at=now(),text_approved_by=auth.uid(),media_approved_at=now(),media_approved_by=auth.uid() where course_id=p_course and status<>'archived';
 update quizzes set ai_text_status='approved',text_approved_at=now(),text_approved_by=auth.uid() where lesson_id in(select id from lessons where course_id=p_course and status<>'archived');
 update courses set ai_text_status='approved',ai_media_status='approved',ai_publish_status='ready',text_approved_at=now(),text_approved_by=auth.uid(),media_approved_at=now(),media_approved_by=auth.uid() where id=p_course;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'ai_authored_course_reviewed','course',p_course,jsonb_build_object('revisions',p_revisions));
end $$;
create function public.admin_publish_ai_authored_course(p_course text,p_updated timestamptz,p_revisions jsonb) returns void
language plpgsql security definer set search_path=public,private as $$
declare l public.lessons;
begin
 perform private.check_ai_authored_course(p_course,p_updated,p_revisions);
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
revoke all on function private.check_ai_authored_course(text,timestamptz,jsonb),public.admin_review_ai_authored_course(text,timestamptz,jsonb),public.admin_publish_ai_authored_course(text,timestamptz,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.admin_review_ai_authored_course(text,timestamptz,jsonb),public.admin_publish_ai_authored_course(text,timestamptz,jsonb) to authenticated;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles) values
('public','admin_review_ai_authored_course','p_course text, p_updated timestamp with time zone, p_revisions jsonb','ADMIN_AUTHENTICATED','Course reviewers','Current editor; locked revision snapshot, actual content and required covers; attributed explicit approval.',array['authenticated']),
('public','admin_publish_ai_authored_course','p_course text, p_updated timestamp with time zone, p_revisions jsonb','ADMIN_AUTHENTICATED','Course publishers','Current editor; locked approved snapshot; existing lesson publication/asset integrity boundaries; atomic course publication.',array['authenticated']);
notify pgrst,'reload schema';
commit;
