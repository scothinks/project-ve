begin;
create or replace function private.lock_ai_authoring_source(p_course text,p_lesson text) returns text
language plpgsql security definer set search_path=public,private as $$
declare snapshot text;
begin
 if not public.current_user_can_edit_course(p_course) then raise exception 'Course editing access required.' using errcode='42501'; end if;
 perform 1 from courses where id=p_course for update;
 if p_lesson is not null and not exists(select 1 from lessons where id=p_lesson and course_id=p_course) then
 raise exception 'The lesson is no longer available.' using errcode='PT409'; end if;
 perform 1 from lessons where course_id=p_course and (p_lesson is null or id=p_lesson) order by id for update;
 perform 1 from lesson_pages where lesson_id in(select id from lessons where course_id=p_course and (p_lesson is null or id=p_lesson)) order by id for update;
 perform 1 from quizzes where lesson_id in(select id from lessons where course_id=p_course and (p_lesson is null or id=p_lesson)) order by id for update;
 perform 1 from quiz_questions where quiz_id in(select q.id from quizzes q join lessons l on l.id=q.lesson_id where l.course_id=p_course and (p_lesson is null or l.id=p_lesson)) order by id for update;
 perform 1 from lesson_content_blocks where page_id in(select p.id from lesson_pages p join lessons l on l.id=p.lesson_id where l.course_id=p_course and (p_lesson is null or l.id=p_lesson)) order by id for update;
 perform 1 from quiz_options where question_id in(select q.id from quiz_questions q join quizzes z on z.id=q.quiz_id join lessons l on l.id=z.lesson_id where l.course_id=p_course and (p_lesson is null or l.id=p_lesson)) order by id for update;
 with ls as(select * from lessons where course_id=p_course and (p_lesson is null or id=p_lesson)),
 ps as(select p.* from lesson_pages p join ls on ls.id=p.lesson_id),
 qs as(select q.* from quizzes q join ls on ls.id=q.lesson_id),
 questions as(select q.* from quiz_questions q join qs on qs.id=q.quiz_id)
 select md5(jsonb_build_object('course',(select to_jsonb(c) from courses c where id=p_course),
 'lessons',(select jsonb_agg(to_jsonb(ls) order by id) from ls),
 'pages',(select jsonb_agg(to_jsonb(ps) order by id) from ps),
 'blocks',(select jsonb_agg(to_jsonb(b) order by b.id) from lesson_content_blocks b join ps on ps.id=b.page_id),
 'quizzes',(select jsonb_agg(to_jsonb(qs) order by id) from qs),
 'questions',(select jsonb_agg(to_jsonb(q) order by id) from questions q),
 'options',(select jsonb_agg(to_jsonb(o) order by o.id) from quiz_options o join questions q on q.id=o.question_id))::text) into snapshot;
 return snapshot;
end $$;
create or replace function public.admin_start_ai_page(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; j uuid; result jsonb; prompt jsonb;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) or r.created_by<>auth.uid() then
   raise exception 'Generation access required.' using errcode='42501'; end if;
 -- The quote identity is the intent identity, including after completion.
 if r.stage<>'quote' then return private.ai_authoring_projection(r,true); end if;
 if r.expires_at<now() then raise exception 'This estimate expired. Check the cost again.' using errcode='PT409'; end if;
 if r.kind='page' then
 perform private.lock_lesson_revision(r.lesson_id,r.source_revision);
 else
 if private.lock_ai_authoring_source(r.course_id,r.lesson_id) is distinct from r.source_fingerprint then
 raise exception 'Your content changed. Check the cost again.' using errcode='PT409'; end if;
 end if;
 if not exists(select 1 from courses c where c.id=r.course_id and c.organization_id is not distinct from r.organization_id and (r.lesson_id is null or exists(select 1 from lessons l where l.id=r.lesson_id and l.course_id=c.id))) then
 raise exception 'The destination changed. Check the cost again.' using errcode='PT409'; end if;
 prompt:=jsonb_build_object('mode',case when r.kind='page' then 'authoring_page_v1' else 'authoring_assistance_v2' end,'operationId',r.id,'lessonId',r.lesson_id);
 if r.organization_id is not null then
   result:=public.create_organization_ai_generation_job(p_organization_id=>r.organization_id,p_actor_user_id=>auth.uid(),
    p_job_type=>'course_text',p_prompt=>prompt,p_entity_id=>r.course_id,p_idempotency_key=>'authoring:'||r.id,
    p_operation_type=>case r.kind when 'quiz' then 'ai_quiz_question_generation' when 'lesson_plan' then 'ai_planner_expand_course' when 'lesson_draft' then 'ai_lesson_extension' else 'ai_lesson_page_extension' end,p_estimated_units=>r.estimated_units,p_course_id=>r.course_id,p_lesson_id=>r.lesson_id);
   j:=(result->>'jobId')::uuid;
 else
   insert into ai_generation_jobs(entity_type,entity_id,course_id,lesson_id,job_type,status,prompt,created_by,idempotency_key)
   values('course',r.course_id,r.course_id,r.lesson_id,'course_text','queued',prompt,auth.uid(),'authoring:'||r.id) returning id into j;
 end if;
 update private.ai_authoring_results set job_id=j,stage='starting',updated_at=now(),
 credit=jsonb_build_object('status',case when organization_id is null then 'unmetered' else 'reserved' end,'reserved',estimated_units)
 where id=r.id returning * into r;
 return private.ai_authoring_projection(r,true);
end $$;
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
   if parent.kind<>'page' or parent.id is null or not private.ai_authoring_can_access(parent) or parent.lesson_id<>l.id
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
create or replace function public.admin_prepare_ai_page_apply(p_id uuid) returns void
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) then raise exception 'Result unavailable.' using errcode='42501'; end if;
 if r.kind<>'page' then raise exception 'Page result unavailable.' using errcode='42501'; end if;
 if r.receipt is not null then return; end if;
 if r.candidate->>'decision'='review_quiz' then raise exception 'This recommendation does not add a page.' using errcode='PT409'; end if;
 if r.candidate is null or r.deleted_at is not null then raise exception 'This result is unavailable.' using errcode='PT409'; end if;
 update private.ai_authoring_results set application_started_at=coalesce(application_started_at,now()),application_error=null,updated_at=now() where id=p_id;
end $$;
create or replace function private.validate_ai_assistance(p_kind text,p_candidate jsonb,p_count integer) returns void
language plpgsql set search_path=public,private as $$
declare item jsonb; page jsonb; block jsonb;
begin
 if jsonb_typeof(p_candidate) is distinct from 'object' or length(trim(coalesce(p_candidate->>'title',''))) not between 1 and 180 then raise exception 'Invalid suggestion title.' using errcode='22023'; end if;
 if p_kind='quiz' then
 if jsonb_typeof(p_candidate->'questions') is distinct from 'array' then raise exception 'Questions required.' using errcode='22023'; end if;
 if jsonb_array_length(p_candidate->'questions')<>p_count then raise exception 'Unexpected question count.' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_candidate->'questions') loop
 if length(trim(coalesce(item->>'prompt',''))) not between 1 and 500 or item->>'questionType' is distinct from 'single_choice'
 or length(trim(coalesce(item->>'explanation',''))) not between 1 and 1000 or jsonb_typeof(item->'options') is distinct from 'array'
 or item->>'xp' is distinct from '10' then raise exception 'Invalid question.' using errcode='22023'; end if;
 if jsonb_array_length(item->'options') not between 2 and 4
 or (select count(*) from jsonb_array_elements(item->'options') o where o->'isCorrect'='true'::jsonb)<>1
 or exists(select 1 from jsonb_array_elements(item->'options') o where jsonb_typeof(o->'isCorrect') is distinct from 'boolean' or length(trim(coalesce(o->>'label',''))) not between 1 and 300)
 or (select count(distinct lower(trim(o->>'label'))) from jsonb_array_elements(item->'options') o)<>jsonb_array_length(item->'options') then raise exception 'Check the answer options.' using errcode='22023'; end if;
 end loop;
 if (select count(distinct lower(trim(q->>'prompt'))) from jsonb_array_elements(p_candidate->'questions') q)<>p_count then raise exception 'Questions must be distinct.' using errcode='22023'; end if;
 elsif p_kind='lesson_plan' then
 if jsonb_typeof(p_candidate->'suggestions') is distinct from 'array' then raise exception 'Lesson suggestions required.' using errcode='22023'; end if;
 if jsonb_array_length(p_candidate->'suggestions') not between 1 and p_count then raise exception 'Unexpected suggestion count.' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_candidate->'suggestions') loop
 if length(trim(coalesce(item->>'title',''))) not between 1 and 180 or length(trim(coalesce(item->>'description',''))) not between 1 and 1000
 or length(trim(coalesce(item->>'reason',''))) not between 1 and 1000 then raise exception 'Invalid lesson suggestion.' using errcode='22023'; end if;
 end loop;
 elsif p_kind='lesson_draft' then
 if length(trim(coalesce(p_candidate->>'description',''))) not between 1 and 1000 or jsonb_typeof(p_candidate->'pages') is distinct from 'array' then raise exception 'Lesson pages required.' using errcode='22023'; end if;
 if jsonb_array_length(p_candidate->'pages') not between 1 and 4 then raise exception 'A lesson needs one to four pages.' using errcode='22023'; end if;
 for page in select value from jsonb_array_elements(p_candidate->'pages') loop
 if length(trim(coalesce(page->>'title',''))) not between 1 and 180 or coalesce(page->>'pageType','') not in ('concept','scenario','reflection','summary') or jsonb_typeof(page->'blocks') is distinct from 'array' then raise exception 'Invalid lesson page.' using errcode='22023'; end if;
 if jsonb_array_length(page->'blocks') not between 1 and 4 or not exists(select 1 from jsonb_array_elements(page->'blocks') b where b->>'blockType' in ('text','callout','table')) then raise exception 'Teaching content required.' using errcode='22023'; end if;
 for block in select value from jsonb_array_elements(page->'blocks') loop
 if jsonb_typeof(block->'payload') is distinct from 'object' then raise exception 'Invalid block.' using errcode='22023'; end if;
 if block->>'blockType' in ('text','callout') and (length(trim(coalesce(block->'payload'->>'body',''))) not between 1 and 6000 or (block->'payload')-array['body','heading','title','variant']<>'{}'::jsonb) then raise exception 'Invalid teaching text.' using errcode='22023'; end if;
 if block->>'blockType'='table' then
 if jsonb_typeof(block->'payload'->'columns') is distinct from 'array' or jsonb_typeof(block->'payload'->'rows') is distinct from 'array' or (block->'payload')-array['columns','rows']<>'{}'::jsonb then raise exception 'Invalid teaching table.' using errcode='22023'; end if;
 if jsonb_array_length(block->'payload'->'columns') not between 1 and 6 or jsonb_array_length(block->'payload'->'rows') not between 1 and 12 then raise exception 'Invalid teaching table size.' using errcode='22023'; end if;
 end if;
 if coalesce(block->>'blockType','') not in ('text','callout','table') then
 if (block->>'blockType' in ('image','video','audio') and ((block->'payload')-array['mediaIntent','src'])='{}'::jsonb
 and coalesce(block->'payload'->>'src','')='' and ((block->'payload'->'mediaIntent')-array['version','kind','purpose','aspectRatio','required','style'])='{}'::jsonb
 and block->'payload'->'mediaIntent'->>'version'='1' and block->'payload'->'mediaIntent'->>'kind'=block->>'blockType'
 and length(trim(block->'payload'->'mediaIntent'->>'purpose')) between 1 and 1000
 and block->'payload'->'mediaIntent'->'required'='false'::jsonb and block->'payload'->'mediaIntent'->>'style'='inherit'
 and block->'payload'->'mediaIntent'->>'aspectRatio' in ('16:9','4:3','1:1')) is not true then raise exception 'Only optional media placeholders are allowed.' using errcode='22023'; end if;
 end if;
 end loop;
 end loop;
 else raise exception 'Unknown assistance type.' using errcode='22023'; end if;
end $$;
create or replace function public.admin_apply_ai_assistance(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; item jsonb; page jsonb; block jsonb; opt jsonb; selected integer;
 lid text; pid text; qid text; question_id text; pn integer:=0; bn integer; onum integer; base integer; ids text[]:='{}';
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) then raise exception 'Result unavailable.' using errcode='42501'; end if;
 if r.receipt is not null then return r.receipt; end if;
 if r.kind not in ('quiz','lesson_draft') or r.candidate is null or r.deleted_at is not null or r.selected_items is null then raise exception 'Select a ready result first.' using errcode='PT409'; end if;
 begin
 if private.lock_ai_authoring_source(r.course_id,r.lesson_id) is distinct from r.source_fingerprint
 or not exists(select 1 from courses c where c.id=r.course_id and c.organization_id is not distinct from r.organization_id) then
 raise exception 'Your content changed. Create another version using the latest content.' using errcode='PT409'; end if;
 perform private.validate_ai_assistance(r.kind,r.candidate,r.requested_count);
 if r.kind='quiz' then
 lid:=r.lesson_id;
 select id into qid from quizzes where lesson_id=lid;
 if qid is null then
 qid:='quiz-ai-'||replace(r.id::text,'-','');
 insert into quizzes(id,lesson_id,title,status) values(qid,lid,'Lesson quiz','draft');
 end if;
 select coalesce(max(question_order),0) into base from quiz_questions where quiz_id=qid;
 foreach selected in array r.selected_items loop
 item:=r.candidate->'questions'->selected;
 if exists(select 1 from quiz_questions where quiz_id=qid and lower(trim(prompt))=lower(trim(item->>'prompt'))) then raise exception 'This question already exists. Refine the suggestion.' using errcode='PT409'; end if;
 question_id:='question-ai-'||replace(r.id::text,'-','')||'-'||selected;
 base:=base+1;
 insert into quiz_questions(id,quiz_id,question_order,question_type,prompt,explanation,xp)
 values(question_id,qid,base,'single_choice',item->>'prompt',item->>'explanation',10);
 onum:=0;
 for opt in select value from jsonb_array_elements(item->'options') loop
 onum:=onum+1;
 insert into quiz_options(id,question_id,option_order,label,is_correct) values(question_id||'-'||onum,question_id,onum,opt->>'label',(opt->>'isCorrect')::boolean);
 end loop;
 ids:=array_append(ids,question_id);
 end loop;
 else
 lid:='lesson-ai-'||replace(r.id::text,'-','');
 if exists(select 1 from lessons where course_id=r.course_id and lower(trim(title))=lower(trim(r.candidate->>'title'))) then raise exception 'A lesson with this title already exists. Refine the draft.' using errcode='PT409'; end if;
 select coalesce(max(sort_order),0)+1 into base from lessons where course_id=r.course_id;
 insert into lessons(id,course_id,slug,title,description,sort_order,status,cover_image,ai_generated,ai_text_status,ai_publish_status,ai_generation_notes)
 values(lid,r.course_id,lid,r.candidate->>'title',r.candidate->>'description',base,'draft','{}',true,'draft','not_ready',jsonb_build_object('authoringVersion',2,'resultId',r.id));
 -- New drafts use normal lesson editing/review, with an empty quiz ready for its next step.
 insert into quizzes(id,lesson_id,title,status) values('quiz-'||lid,lid,'Lesson quiz','draft');
 for page in select value from jsonb_array_elements(r.candidate->'pages') loop
 pn:=pn+1; pid:=lid||'-page-'||pn; bn:=0;
 insert into lesson_pages(id,lesson_id,page_number,title,subtitle,page_type,cover_image)
 values(pid,lid,pn,page->>'title',page->>'subtitle',(case when page->>'pageType'='scenario' then 'example' else page->>'pageType' end)::lesson_page_type,'{}');
 for block in select value from jsonb_array_elements(page->'blocks') loop
 bn:=bn+1;
 insert into lesson_content_blocks(page_id,block_type,sort_order,payload) values(pid,(block->>'blockType')::lesson_content_block_type,bn,block->'payload');
 end loop;
 end loop;
 ids:=array[lid];
 end if;
 update lessons set ai_text_status=case when ai_generated then 'draft' else ai_text_status end,
 ai_publish_status=case when ai_generated then 'not_ready' else ai_publish_status end,
 text_approved_at=case when ai_generated then null else text_approved_at end,text_approved_by=case when ai_generated then null else text_approved_by end where id=lid;
 update private.ai_authoring_results set receipt=jsonb_build_object('status','saved','kind',r.kind,'lessonId',lid,'ids',ids,'savedAt',now()),application_error=null,updated_at=now() where id=r.id returning * into r;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'ai_assistance_applied','lesson',lid,jsonb_build_object('resultId',r.id,'kind',r.kind,'ids',ids));
 return r.receipt;
 exception when others then
 update private.ai_authoring_results set application_error=case when sqlstate in ('PT409','42501','22023','23505') then sqlerrm else 'The save failed. Your candidate is retained; try again.' end,updated_at=now() where id=p_id;
 return jsonb_build_object('status','not_saved','error',(select application_error from private.ai_authoring_results where id=p_id));
 end;
end $$;
create or replace function public.admin_quote_ai_assistance(p_course_id text,p_kind text,p_lesson_id text default null,
 p_focus text default '',p_count integer default 1,p_parent_id uuid default null,p_refinement text default '',p_selected integer default null)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare c public.courses; r private.ai_authoring_results; parent private.ai_authoring_results; fingerprint text; ctx jsonb;
begin
 if p_kind is null or p_kind not in ('quiz','lesson_plan','lesson_draft') or p_focus is null or length(p_focus)>1000
 or p_refinement is null or length(p_refinement)>1000 or p_count is null or p_count not between 1 and 3
 or (p_kind='quiz' and p_lesson_id is null) or (p_kind<>'quiz' and p_lesson_id is not null)
 or (p_kind='lesson_draft' and p_count<>1) then raise exception 'Choose a valid request.' using errcode='22023'; end if;
 fingerprint:=private.lock_ai_authoring_source(p_course_id,p_lesson_id);
 select * into c from courses where id=p_course_id;
 if p_parent_id is not null then
 select * into parent from private.ai_authoring_results where id=p_parent_id;
 if parent.id is null or not private.ai_authoring_can_access(parent) or parent.course_id<>c.id or parent.lesson_id is distinct from p_lesson_id
 or parent.candidate is null or parent.deleted_at is not null or (parent.kind<>p_kind and not(p_kind='lesson_draft' and parent.kind='lesson_plan')) then
 raise exception 'The earlier result is unavailable.' using errcode='42501'; end if;
 end if;
 if p_kind='lesson_draft' and (parent.id is null or (parent.kind='lesson_plan' and (p_selected is null or p_selected<0 or p_selected>=jsonb_array_length(parent.candidate->'suggestions')))) then
 raise exception 'Choose a lesson suggestion first.' using errcode='22023'; end if;
 -- Bounded context, set-wise; full fingerprint stays private and detects omitted edits too.
 with teaching as (
 select p.lesson_id,p.page_number,p.title,left(regexp_replace(string_agg(coalesce(b.payload->>'heading',b.payload->>'title','')||' '||coalesce(b.payload->>'body','')||case when b.block_type='table' then b.payload::text else '' end,E'\n' order by b.sort_order),'<[^>]*>',' ','g'),1800) content
 from lesson_pages p left join lesson_content_blocks b on b.page_id=p.id and b.block_type in ('text','callout','table')
 join lessons l on l.id=p.lesson_id where l.course_id=c.id and (p_lesson_id is null or l.id=p_lesson_id) group by p.id
 ), outlines as (
 select l.id,l.title,l.description,l.sort_order,(select jsonb_agg(to_jsonb(t) order by t.page_number) from (select * from teaching where lesson_id=l.id order by page_number limit 8) t) pages
 from lessons l where l.course_id=c.id and (p_lesson_id is null or l.id=p_lesson_id) order by l.sort_order,l.id limit 20)
 select jsonb_build_object('kind',p_kind,'count',p_count,'focus',trim(p_focus),'refinementInstruction',trim(p_refinement),
 'course',jsonb_build_object('title',c.title,'category',c.category,'level',c.level,'description',c.description,'audience',c.intended_audience),
 'lessons',coalesce((select jsonb_agg(to_jsonb(o) order by o.sort_order,o.id) from outlines o),'[]'),
 'existingQuestions',coalesce((select jsonb_agg(prompt) from (select q.prompt from quiz_questions q join quizzes z on z.id=q.quiz_id where z.lesson_id=p_lesson_id order by q.question_order limit 50) existing),'[]'),
 'suggestion',case when parent.kind='lesson_plan' then parent.candidate->'suggestions'->p_selected else parent.context->'suggestion' end,
 'priorDraft',case when parent.kind=p_kind then parent.candidate else null end,'mediaPlaceholders',true) into ctx;
 if p_kind='quiz' and not exists(select 1 from jsonb_array_elements(ctx->'lessons') l cross join lateral jsonb_array_elements(coalesce(nullif(l->'pages','null'::jsonb),'[]'::jsonb)) p where length(trim(coalesce(p->>'content','')))>0) then raise exception 'Save lesson teaching content before generating questions.' using errcode='22023'; end if;
 insert into private.ai_authoring_results(organization_id,course_id,lesson_id,created_by,title,source_revision,context,focus,page_type,insertion_position,parent_id,refinement,kind,requested_count,source_fingerprint,estimated_units)
 values(c.organization_id,c.id,p_lesson_id,auth.uid(),case p_kind when 'quiz' then 'Quiz suggestions' when 'lesson_plan' then 'Lesson suggestions' else 'Lesson draft' end,
 coalesce((select draft_revision from lessons where id=p_lesson_id),0),ctx,trim(p_focus),'concept',1,p_parent_id,trim(p_refinement),p_kind,p_count,fingerprint,
 case p_kind when 'quiz' then 20*p_count when 'lesson_plan' then 35+12*p_count else 135 end) returning * into r;
 return private.ai_authoring_projection(r,true);
end $$;
drop function public.admin_read_ai_results(uuid,text,uuid,integer);
create or replace function public.admin_read_ai_results(p_id uuid default null,p_lesson_id text default null,
 p_organization_id uuid default null,p_offset integer default 0,p_course_id text default null)
returns jsonb language plpgsql stable security definer set search_path=public,private as $$
declare selected_result private.ai_authoring_results;
begin
 if auth.uid() is null then raise exception 'Editor access required.' using errcode='42501'; end if;
 if p_id is not null then
   select * into selected_result from private.ai_authoring_results where id=p_id;
   if selected_result.id is null or not private.ai_authoring_can_access(selected_result) then raise exception 'Result unavailable.' using errcode='42501'; end if;
   return private.ai_authoring_projection(selected_result,true);
 end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(item order by created_at desc,id desc) from (
   select private.ai_authoring_projection(r,false) item,r.created_at,r.id from private.ai_authoring_results r
   where r.organization_id is not distinct from p_organization_id and (p_lesson_id is null or r.lesson_id=p_lesson_id) and (p_course_id is null or r.course_id=p_course_id)
   and r.stage<>'quote' and r.deleted_at is null and private.ai_authoring_can_access(r)
   order by r.created_at desc,r.id desc limit 20 offset greatest(0,least(p_offset,100000))) items),'[]'),
 'unusedCount',(select count(*) from private.ai_authoring_results r where r.organization_id is not distinct from p_organization_id
   and (p_lesson_id is null or r.lesson_id=p_lesson_id) and (p_course_id is null or r.course_id=p_course_id) and r.candidate is not null and r.receipt is null
   and r.deleted_at is null and private.ai_authoring_can_access(r)));
end $$;

revoke all on function public.admin_read_ai_results(uuid,text,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_read_ai_results(uuid,text,uuid,integer,text) to authenticated;
update private.rpc_security_classifications set identity_arguments='p_id uuid, p_lesson_id text, p_organization_id uuid, p_offset integer, p_course_id text' where function_schema='public' and function_name='admin_read_ai_results';


-- Explicit review for assistant drafts; optional placeholders impose no seed quota.
create function public.admin_review_ai_assistance_lesson(p_lesson_id text,p_revision bigint) returns void
language plpgsql security definer set search_path=public,private as $$
declare lid text; cid text;
begin
 perform private.lock_lesson_revision(p_lesson_id,p_revision);
 select id,course_id into lid,cid from lessons where id=p_lesson_id and ai_generation_notes->>'authoringVersion'='2' and ai_generated;
 if lid is null then raise exception 'Assistant lesson unavailable.' using errcode='42501'; end if;
 if exists(select 1 from lesson_content_blocks b join lesson_pages p on p.id=b.page_id where p.lesson_id=lid
 and b.payload->'mediaIntent'->>'required'='true' and coalesce(b.payload->>'src','')='') then raise exception 'Complete required media before reviewing.' using errcode='22023'; end if;
 if exists(select 1 from private.media_placements p join private.media_versions v on v.id=p.version_id where p.lesson_id=lid and p.in_draft and v.revoked_at is not null) then raise exception 'Replace revoked media before reviewing.' using errcode='22023'; end if;
 update lessons set ai_text_status='approved',ai_media_status='approved',ai_publish_status='ready',text_approved_at=now(),text_approved_by=auth.uid(),media_approved_at=now(),media_approved_by=auth.uid() where id=lid;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'ai_assistance_lesson_reviewed','lesson',lid,jsonb_build_object('revision',p_revision));
end $$;
revoke all on function public.admin_review_ai_assistance_lesson(text,bigint) from public,anon,authenticated,service_role;
grant execute on function public.admin_review_ai_assistance_lesson(text,bigint) to authenticated;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles) values
('public','admin_review_ai_assistance_lesson','p_lesson_id text, p_revision bigint','ADMIN_AUTHENTICATED','Lesson review','Current editor; revision checked explicit text and media review for assistant drafts.',array['authenticated']);

notify pgrst,'reload schema';
commit;
