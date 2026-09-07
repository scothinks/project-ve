begin;
create or replace function private.ai_authoring_projection(r private.ai_authoring_results,p_detail boolean) returns jsonb language sql stable set search_path=public,private as $$
 select private.ai_authoring_projection_v3(r,p_detail)||case when r.kind='image' then jsonb_build_object('image',case when p_detail then r.context else null end,
 'targetAvailable',exists(select 1 from courses c where c.id=r.course_id) and (r.lesson_id is null or exists(select 1 from lessons l where l.id=r.lesson_id and l.course_id=r.course_id)))
 when r.kind in ('course_outline','course_draft') then jsonb_build_object('workspaceId',r.organization_id) else '{}'::jsonb end
$$;
create function private.ai_course_price(p_kind text,p_lessons integer,p_questions integer) returns integer
language plpgsql immutable set search_path=public as $$
begin
 if p_kind is null or p_kind not in ('course_outline','course_draft') or p_lessons is null or p_lessons not between 1 and 6 or p_questions is null or p_questions not between 0 and 3 then
  raise exception 'Choose one to six lessons and zero to three questions.' using errcode='22023';
 end if;
 return case when p_kind='course_outline' then 57 else 100+p_lessons*(35+6*p_questions) end;
end $$;
revoke all on function private.ai_course_price(text,integer,integer) from public,anon,authenticated,service_role;

create function public.admin_preview_ai_course_price(p_kind text,p_lessons integer default 3,p_questions integer default 0,p_retry_id uuid default null,p_organization_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,private as $$
declare r private.ai_authoring_results; remaining integer:=p_lessons; units integer;
begin
 if not private.ai_course_workspace_editor(auth.uid(),p_organization_id) then raise exception 'Workspace editing access required.' using errcode='42501'; end if;
 if p_retry_id is not null then
  select * into r from private.ai_authoring_results where id=p_retry_id;
  if r.id is null or not private.ai_authoring_can_access(r) or r.organization_id is distinct from p_organization_id or r.deleted_at is not null then raise exception 'Result unavailable.' using errcode='42501'; end if;
  if p_kind is distinct from 'course_draft' or r.kind<>'course_draft' or r.stage not in ('failed','stopped') or r.receipt is not null
   or (r.application_started_at is not null and r.application_error is null) then raise exception 'Only unfinished, unapplied work can be retried.' using errcode='PT409'; end if;
  p_lessons:=jsonb_array_length(r.course_outline->'lessons');
  remaining:=p_lessons-coalesce(jsonb_array_length(r.candidate->'completed'),0);
  p_questions:=(r.context->>'questionsPerLesson')::integer;
 end if;
 units:=private.ai_course_price(p_kind,remaining,p_questions);
 return jsonb_build_object('kind',p_kind,'estimatedUnits',units,'outlineUnits',private.ai_course_price('course_outline',p_lessons,0),
  'draftUnits',private.ai_course_price('course_draft',remaining,p_questions),'lessonCount',p_lessons,'unfinishedCount',remaining,
  'questionsPerLesson',p_questions,'metered',p_organization_id is not null,'workspaceId',p_organization_id);
end $$;
revoke all on function public.admin_preview_ai_course_price(text,integer,integer,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_preview_ai_course_price(text,integer,integer,uuid,uuid) to authenticated;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles)
values('public','admin_preview_ai_course_price','p_kind text, p_lessons integer, p_questions integer, p_retry_id uuid, p_organization_id uuid','ADMIN_AUTHENTICATED','Course editors','Read-only bounded prices; workspace editor and retained retry authorization.',array['authenticated']);

create or replace function public.admin_quote_ai_course(p_kind text,p_brief jsonb default null,p_parent_id uuid default null,
 p_revision integer default null,p_questions integer default 0,p_refinement text default '',p_retry boolean default false,p_organization_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; parent private.ai_authoring_results; org uuid:=p_organization_id; brief jsonb:=p_brief;
 outline jsonb; completed jsonb:='[]'; n integer; units integer;
begin
 if p_kind is null or p_kind not in ('course_outline','course_draft') or p_questions is null or p_questions not between 0 and 3
 or p_refinement is null or length(p_refinement)>1000 or p_retry is null then raise exception 'Choose a valid course request.' using errcode='22023'; end if;
 if p_parent_id is not null then
 select * into parent from private.ai_authoring_results where id=p_parent_id for update;
 if parent.id is null or parent.kind not in ('course_outline','course_draft') or not private.ai_authoring_can_access(parent) or parent.deleted_at is not null then raise exception 'The earlier outline is unavailable.' using errcode='42501'; end if;
 org:=parent.organization_id; brief:=parent.context->'brief'; outline:=parent.course_outline;
 end if;
 if not private.ai_course_workspace_editor(auth.uid(),org) then raise exception 'Workspace editing access required.' using errcode='42501'; end if;
 if p_kind='course_outline' then
 if jsonb_typeof(brief) is distinct from 'object' or length(trim(coalesce(brief->>'need',''))) not between 1 and 2000
 or length(trim(coalesce(brief->>'audience',''))) not between 1 and 500 or length(trim(coalesce(brief->>'tone',''))) not between 1 and 100
 or coalesce(brief->>'lessonCount','') !~ '^[1-6]$' or p_retry then raise exception 'Complete the brief and choose one to six lessons.' using errcode='22023'; end if;
 units:=private.ai_course_price(p_kind,(brief->>'lessonCount')::integer,0);
 else
 if parent.id is null or parent.outline_revision is distinct from p_revision then raise exception 'The outline changed. Reopen it before checking the cost.' using errcode='PT409'; end if;
 perform private.validate_ai_course_outline(outline);
 n:=jsonb_array_length(outline->'lessons');
 if p_retry then
 if parent.kind<>'course_draft' or parent.stage not in ('failed','stopped') or parent.receipt is not null or (parent.application_started_at is not null and parent.application_error is null) then raise exception 'Only unfinished, unapplied work can be retried.' using errcode='PT409'; end if;
 completed:=coalesce(parent.candidate->'completed','[]');
 p_questions:=(parent.context->>'questionsPerLesson')::integer;
 elsif parent.kind<>'course_outline' or parent.stage<>'ready' then raise exception 'Accept a ready outline first.' using errcode='PT409'; end if;
 if n<=jsonb_array_length(completed) then raise exception 'All lessons are already complete.' using errcode='PT409'; end if;
 units:=private.ai_course_price(p_kind,n-jsonb_array_length(completed),p_questions);
 end if;
 insert into private.ai_authoring_results(organization_id,course_id,lesson_id,created_by,title,source_revision,context,focus,page_type,insertion_position,parent_id,refinement,kind,estimated_units,course_outline,source_fingerprint,candidate)
 values(org,null,null,auth.uid(),case when p_kind='course_outline' then 'Course outline' else outline->>'title' end,0,
 jsonb_build_object('kind',p_kind,'brief',brief,'outline',outline,'questionsPerLesson',p_questions,'refinement',trim(p_refinement),'priorDraft',parent.course_outline,'retry',p_retry),
 '', 'concept',1,p_parent_id,trim(p_refinement),p_kind,units,case when p_kind='course_draft' then outline else null end,
 case when parent.id is not null then parent.outline_revision::text else null end,
 case when p_kind='course_draft' then outline||jsonb_build_object('completed',completed) else null end) returning * into r;
 return private.ai_authoring_projection(r,true)||jsonb_build_object('workspaceId',org);
end $$;
notify pgrst,'reload schema';
commit;
