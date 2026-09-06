begin;
-- Extract the existing atomic row materializer; legacy leased callers keep their guard and settlement.
create function private.materialize_ai_course_tree(p_entity_id text, p_course_row jsonb, p_course_update jsonb, p_lesson_rows jsonb, p_page_rows jsonb, p_block_rows jsonb, p_quiz_rows jsonb, p_question_rows jsonb, p_option_rows jsonb, p_media_rows jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
  if p_course_row is not null and jsonb_typeof(p_course_row) = 'object' then
    insert into public.courses (
      id,
      slug,
      title,
      description,
      category,
      level,
      thumbnail,
      status,
      sort_order,
      estimated_minutes,
      ai_text_status,
      ai_media_status,
      ai_publish_status,
      ai_generated,
      ai_generation_notes
    )
    select id,
           slug,
           title,
           description,
           category,
           level,
           coalesce(thumbnail, '{}'::jsonb),
           status,
           sort_order,
           estimated_minutes,
           ai_text_status,
           ai_media_status,
           ai_publish_status,
           ai_generated,
           coalesce(ai_generation_notes, '{}'::jsonb)
    from jsonb_to_record(p_course_row) as course_row (
      id text,
      slug text,
      title text,
      description text,
      category text,
      level public.course_level,
      thumbnail jsonb,
      status public.content_status,
      sort_order integer,
      estimated_minutes integer,
      ai_text_status text,
      ai_media_status text,
      ai_publish_status text,
      ai_generated boolean,
      ai_generation_notes jsonb
    );
  end if;

  if p_course_update is not null and jsonb_typeof(p_course_update) = 'object' then
    update public.courses
    set ai_generated = coalesce((p_course_update ->> 'ai_generated')::boolean, ai_generated),
        ai_text_status = coalesce(p_course_update ->> 'ai_text_status', ai_text_status),
        ai_media_status = coalesce(p_course_update ->> 'ai_media_status', ai_media_status),
        ai_publish_status = coalesce(p_course_update ->> 'ai_publish_status', ai_publish_status),
        text_approved_at = case
          when p_course_update ? 'text_approved_at' then nullif(p_course_update ->> 'text_approved_at', '')::timestamptz
          else text_approved_at
        end,
        text_approved_by = case
          when p_course_update ? 'text_approved_by' then nullif(p_course_update ->> 'text_approved_by', '')::uuid
          else text_approved_by
        end,
        media_approved_at = case
          when p_course_update ? 'media_approved_at' then nullif(p_course_update ->> 'media_approved_at', '')::timestamptz
          else media_approved_at
        end,
        media_approved_by = case
          when p_course_update ? 'media_approved_by' then nullif(p_course_update ->> 'media_approved_by', '')::uuid
          else media_approved_by
        end,
        ai_generation_notes = case
          when p_course_update ? 'ai_generation_notes' then coalesce(p_course_update -> 'ai_generation_notes', '{}'::jsonb)
          else ai_generation_notes
        end
    where id = p_entity_id;

    if not found then
      raise exception 'Course not found for AI generation job.';
    end if;
  end if;

  if jsonb_array_length(coalesce(p_lesson_rows, '[]'::jsonb)) > 0 then
    insert into public.lessons (
      id,
      course_id,
      slug,
      title,
      description,
      cover_image,
      status,
      sort_order,
      estimated_minutes,
      retry_mode,
      retry_cooldown_seconds,
      retry_requires_reread,
      quiz_requires_lesson_completion,
      max_earning_attempts,
      ai_text_status,
      ai_media_status,
      ai_publish_status,
      ai_generated,
      ai_generation_notes
    )
    select id,
           course_id,
           slug,
           title,
           description,
           coalesce(cover_image, '{}'::jsonb),
           status,
           sort_order,
           estimated_minutes,
           retry_mode,
           retry_cooldown_seconds,
           retry_requires_reread,
           quiz_requires_lesson_completion,
           max_earning_attempts,
           ai_text_status,
           ai_media_status,
           ai_publish_status,
           ai_generated,
           coalesce(ai_generation_notes, '{}'::jsonb)
    from jsonb_to_recordset(p_lesson_rows) as lesson_row (
      id text,
      course_id text,
      slug text,
      title text,
      description text,
      cover_image jsonb,
      status public.content_status,
      sort_order integer,
      estimated_minutes integer,
      retry_mode public.lesson_retry_mode,
      retry_cooldown_seconds integer,
      retry_requires_reread boolean,
      quiz_requires_lesson_completion boolean,
      max_earning_attempts integer,
      ai_text_status text,
      ai_media_status text,
      ai_publish_status text,
      ai_generated boolean,
      ai_generation_notes jsonb
    );
  end if;

  if jsonb_array_length(coalesce(p_page_rows, '[]'::jsonb)) > 0 then
    insert into public.lesson_pages (
      id,
      lesson_id,
      page_number,
      title,
      subtitle,
      page_type,
      cover_image
    )
    select id,
           lesson_id,
           page_number,
           title,
           subtitle,
           page_type,
           coalesce(cover_image, '{}'::jsonb)
    from jsonb_to_recordset(p_page_rows) as page_row (
      id text,
      lesson_id text,
      page_number integer,
      title text,
      subtitle text,
      page_type public.lesson_page_type,
      cover_image jsonb
    );
  end if;

  if jsonb_array_length(coalesce(p_block_rows, '[]'::jsonb)) > 0 then
    insert into public.lesson_content_blocks (
      id,
      page_id,
      block_type,
      sort_order,
      payload
    )
    select id,
           page_id,
           block_type,
           sort_order,
           coalesce(payload, '{}'::jsonb)
    from jsonb_to_recordset(p_block_rows) as block_row (
      id uuid,
      page_id text,
      block_type public.lesson_content_block_type,
      sort_order integer,
      payload jsonb
    );
  end if;

  if jsonb_array_length(coalesce(p_quiz_rows, '[]'::jsonb)) > 0 then
    insert into public.quizzes (
      id,
      lesson_id,
      title,
      version,
      status,
      ai_text_status,
      ai_generated,
      ai_generation_notes
    )
    select id,
           lesson_id,
           title,
           version,
           status,
           ai_text_status,
           ai_generated,
           coalesce(ai_generation_notes, '{}'::jsonb)
    from jsonb_to_recordset(p_quiz_rows) as quiz_row (
      id text,
      lesson_id text,
      title text,
      version integer,
      status public.content_status,
      ai_text_status text,
      ai_generated boolean,
      ai_generation_notes jsonb
    );
  end if;

  if jsonb_array_length(coalesce(p_question_rows, '[]'::jsonb)) > 0 then
    insert into public.quiz_questions (
      id,
      quiz_id,
      question_order,
      question_type,
      prompt,
      explanation,
      xp
    )
    select id,
           quiz_id,
           question_order,
           question_type,
           prompt,
           explanation,
           xp
    from jsonb_to_recordset(p_question_rows) as question_row (
      id text,
      quiz_id text,
      question_order integer,
      question_type public.quiz_question_type,
      prompt text,
      explanation text,
      xp integer
    );
  end if;

  if jsonb_array_length(coalesce(p_option_rows, '[]'::jsonb)) > 0 then
    insert into public.quiz_options (
      id,
      question_id,
      option_order,
      label,
      is_correct
    )
    select id,
           question_id,
           option_order,
           label,
           is_correct
    from jsonb_to_recordset(p_option_rows) as option_row (
      id text,
      question_id text,
      option_order integer,
      label text,
      is_correct boolean
    );
  end if;

  if jsonb_array_length(coalesce(p_media_rows, '[]'::jsonb)) > 0 then
    insert into public.learning_media_assets (
      course_id,
      lesson_id,
      asset_type,
      placement,
      source,
      prompt,
      script,
      url,
      storage_path,
      provider,
      model,
      alt_text,
      caption,
      metadata,
      review_status,
      generation_status,
      generation_error,
      sort_order
    )
    select course_id,
           lesson_id,
           asset_type,
           placement,
           source,
           prompt,
           script,
           url,
           storage_path,
           provider,
           model,
           alt_text,
           caption,
           coalesce(metadata, '{}'::jsonb),
           review_status,
           generation_status,
           generation_error,
           sort_order
    from jsonb_to_recordset(p_media_rows) as media_row (
      course_id text,
      lesson_id text,
      asset_type text,
      placement text,
      source text,
      prompt text,
      script text,
      url text,
      storage_path text,
      provider text,
      model text,
      alt_text text,
      caption text,
      metadata jsonb,
      review_status text,
      generation_status text,
      generation_error text,
      sort_order integer
    );
  end if;

end $$;
create or replace function public.materialize_ai_course_text_job(
  p_job_id uuid,
  p_entity_id text,
  p_course_row jsonb,
  p_course_update jsonb,
  p_lesson_rows jsonb,
  p_page_rows jsonb,
  p_block_rows jsonb,
  p_quiz_rows jsonb,
  p_question_rows jsonb,
  p_option_rows jsonb,
  p_media_rows jsonb,
  p_job_result jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.ai_generation_jobs
    where id = p_job_id
      and status = 'running'
  ) then
    raise exception 'AI generation job is not running.';
  end if;

  perform private.materialize_ai_course_tree(p_entity_id,p_course_row,p_course_update,p_lesson_rows,p_page_rows,p_block_rows,p_quiz_rows,p_question_rows,p_option_rows,p_media_rows);

  update public.ai_generation_jobs
  set entity_id = p_entity_id,
      status = 'completed',
      result = coalesce(p_job_result, '{}'::jsonb),
      error = null,
      failure_code = null,
      failure_detail = '{}'::jsonb,
      locked_at = null,
      locked_by = null,
      heartbeat_at = now(),
      completed_at = now()
  where id = p_job_id;
end;
$$;

revoke all on function private.materialize_ai_course_tree(text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.admin_prepare_ai_course_apply(p_id uuid) returns void
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) then raise exception 'Result unavailable.' using errcode='42501'; end if;
 if r.receipt is not null then return; end if;
 if r.kind<>'course_draft' or r.stage not in ('ready','failed','stopped') or r.deleted_at is not null or coalesce(jsonb_array_length(r.candidate->'completed'),0)=0 then raise exception 'No completed lessons are ready to add.' using errcode='PT409'; end if;
 update private.ai_authoring_results set application_started_at=coalesce(application_started_at,now()),application_error=null,updated_at=now() where id=p_id;
end $$;

create function public.admin_apply_ai_course(p_id uuid) returns jsonb
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
 update courses set organization_id=r.organization_id,catalog_scope=case when r.organization_id is null then 'platform' else 'organization' end,
 intended_audience=r.context->'brief'->>'audience' where id=cid;
 update private.ai_authoring_results set course_id=cid,receipt=jsonb_build_object('status','saved','courseId',cid,'lessonIds',ids,'savedAt',now()),application_error=null,updated_at=now() where id=p_id returning * into r;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'ai_course_candidate_applied','course',cid,jsonb_build_object('resultId',r.id,'lessonCount',ln));
 return r.receipt;
 exception when others then
 update private.ai_authoring_results set application_error=case when sqlstate in ('PT409','42501','22023','23505') then sqlerrm else 'The save failed. Your completed lessons are retained; try again.' end,updated_at=now() where id=p_id;
 return jsonb_build_object('status','not_saved','error',(select application_error from private.ai_authoring_results where id=p_id));
 end;
end $$;
revoke all on function public.admin_prepare_ai_course_apply(uuid),public.admin_apply_ai_course(uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_prepare_ai_course_apply(uuid),public.admin_apply_ai_course(uuid) to authenticated;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles) values
('public','admin_prepare_ai_course_apply','p_id uuid','ADMIN_AUTHENTICATED','Course editors','Authorized retained completed course candidate; durable application intent.',array['authenticated']),
('public','admin_apply_ai_course','p_id uuid','ADMIN_AUTHENTICATED','Course editors','Authorized immutable candidate, atomic tree and receipt; no worker settlement or automatic approval.',array['authenticated']);
notify pgrst,'reload schema';
commit;
