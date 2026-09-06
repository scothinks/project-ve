begin;

-- Candidate shape is checked again at the trusted checkpoint and at application.
create function private.validate_ai_assistance(p_kind text,p_candidate jsonb,p_count integer) returns void
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
 if coalesce(block->>'blockType','') not in ('text','callout','table') then
 if (block->>'blockType' in ('image','video','audio') and (block->'payload'-array['mediaIntent','src'])='{}'::jsonb
 and coalesce(block->'payload'->>'src','')='' and (block->'payload'->'mediaIntent'-array['version','kind','purpose','aspectRatio','required','style'])='{}'::jsonb
 and block->'payload'->'mediaIntent'->>'version'='1' and block->'payload'->'mediaIntent'->>'kind'=block->>'blockType'
 and length(trim(block->'payload'->'mediaIntent'->>'purpose')) between 1 and 1000
 and block->'payload'->'mediaIntent'->'required'='false'::jsonb and block->'payload'->'mediaIntent'->>'style'='inherit'
 and block->'payload'->'mediaIntent'->>'aspectRatio' in ('16:9','4:3','1:1')) is not true then raise exception 'Only optional media placeholders are allowed.' using errcode='22023'; end if;
 end if;
 end loop;
 end loop;
 else raise exception 'Unknown assistance type.' using errcode='22023'; end if;
end $$;

create function public.admin_prepare_ai_assistance_apply(p_id uuid,p_selection integer[]) returns void
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; item_count integer;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) then raise exception 'Result unavailable.' using errcode='42501'; end if;
 if r.receipt is not null then return; end if;
 if r.kind not in ('quiz','lesson_draft') or r.stage<>'ready' or r.deleted_at is not null then raise exception 'This result cannot be added.' using errcode='PT409'; end if;
 item_count:=case when r.kind='quiz' then jsonb_array_length(r.candidate->'questions') else 1 end;
 if coalesce(cardinality(p_selection),0)=0 or cardinality(p_selection)>item_count
 or exists(select 1 from unnest(p_selection) s where s is null or s<0 or s>=item_count)
 or (select count(distinct s) from unnest(p_selection) s)<>cardinality(p_selection) then raise exception 'Select the items to add.' using errcode='22023'; end if;
 -- Once saving begins, recovery replays this exact selection, including after navigation.
 if r.selected_items is not null and r.selected_items<>p_selection then raise exception 'Check the earlier save before changing your selection.' using errcode='PT409'; end if;
 update private.ai_authoring_results set selected_items=p_selection,application_started_at=coalesce(application_started_at,now()),application_error=null,updated_at=now() where id=p_id;
end $$;

create function public.admin_apply_ai_assistance(p_id uuid) returns jsonb
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
 insert into lessons(id,course_id,slug,title,description,sort_order,status,cover_image,ai_generated,ai_text_status,ai_publish_status)
 values(lid,r.course_id,lid,r.candidate->>'title',r.candidate->>'description',base,'draft','{}',true,'draft','not_ready');
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
 exception when sqlstate 'PT409' or sqlstate '42501' or sqlstate '22023' or unique_violation then
 update private.ai_authoring_results set application_error=sqlerrm,updated_at=now() where id=p_id;
 return jsonb_build_object('status','not_saved','error',sqlerrm);
 end;
end $$;

-- Prevent using the page application endpoint to bypass operation-specific validation.
alter function public.admin_apply_ai_page(uuid) rename to ai_page_apply_v1;
alter function public.ai_page_apply_v1(uuid) set schema private;
revoke all on function private.ai_page_apply_v1(uuid) from public,anon,authenticated,service_role;
create function public.admin_apply_ai_page(p_id uuid) returns jsonb language plpgsql security definer set search_path=public,private as $$
begin
 if not exists(select 1 from private.ai_authoring_results r where r.id=p_id and r.kind='page' and private.ai_authoring_can_access(r)) then raise exception 'Page result unavailable.' using errcode='42501'; end if;
 return private.ai_page_apply_v1(p_id);
end $$;
revoke all on function private.validate_ai_assistance(text,jsonb,integer) from public,anon,authenticated,service_role;
revoke all on function public.admin_apply_ai_page(uuid),public.admin_prepare_ai_assistance_apply(uuid,integer[]),public.admin_apply_ai_assistance(uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_apply_ai_page(uuid),public.admin_prepare_ai_assistance_apply(uuid,integer[]),public.admin_apply_ai_assistance(uuid) to authenticated;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles) values
('public','admin_prepare_ai_assistance_apply','p_id uuid, p_selection integer[]','ADMIN_AUTHENTICATED','AI assistance','Current course editor; immutable selection for recovery.',array['authenticated']),
('public','admin_apply_ai_assistance','p_id uuid','ADMIN_AUTHENTICATED','AI assistance','Current course editor; snapshot checked and idempotent.',array['authenticated']);
notify pgrst,'reload schema';
commit;
