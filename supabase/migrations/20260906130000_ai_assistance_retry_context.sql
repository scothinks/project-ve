begin;
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
 or (parent.candidate is null and not(parent.kind='lesson_draft' and parent.context->'suggestion' is not null and parent.context->'suggestion'<>'null'::jsonb)) or parent.deleted_at is not null or (parent.kind<>p_kind and not(p_kind='lesson_draft' and parent.kind='lesson_plan')) then
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
notify pgrst,'reload schema';
commit;
