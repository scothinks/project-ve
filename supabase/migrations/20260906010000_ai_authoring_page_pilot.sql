begin;

-- Editorial candidates outlive queue-log cleanup. No learner or direct browser
-- table access; all writes use the focused, authorized functions below.
create table private.ai_authoring_results (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id) on delete cascade,
 course_id text not null,
 lesson_id text not null,
 created_by uuid not null,
 title text not null,
 source_revision bigint not null,
 context jsonb not null,
 focus text not null,
 page_type text not null,
 insertion_position integer not null,
 parent_id uuid references private.ai_authoring_results(id) on delete set null,
 refinement text not null default '',
 estimated_units numeric not null default 40,
 expires_at timestamptz not null default now() + interval '10 minutes',
 job_id uuid unique references public.ai_generation_jobs(id) on delete set null,
 stage text not null default 'quote' check(stage in ('quote','starting','writing','ready','failed','stopped')),
 provider_started_at timestamptz,
 stop_requested boolean not null default false,
 candidate jsonb,
 receipt jsonb,
 credit jsonb not null default '{}',
 failure text,
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table private.ai_authoring_results enable row level security;
revoke all on private.ai_authoring_results from public,anon,authenticated,service_role;

-- Same content-editor roles as current_user_can_edit_course, for trusted worker
-- revalidation of the persisted initiating actor (never a client-supplied actor).
create function private.ai_authoring_actor_can_edit(p_actor uuid, p_course text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from courses c where c.id=p_course and (
 exists(select 1 from profiles where id=p_actor and role='admin')
 or (c.catalog_scope='platform' and exists(select 1 from platform_catalog_memberships m
   where m.user_id=p_actor and m.status='active' and m.role in ('organisation_owner','organisation_admin','programme_manager','content_editor')))
 or (c.catalog_scope<>'platform' and exists(select 1 from organization_memberships m
   where m.organization_id=c.organization_id and m.user_id=p_actor and m.status='active'
   and m.role in ('organisation_owner','organisation_admin','programme_manager','content_editor')))))
$$;

create function private.ai_authoring_can_access(p_result private.ai_authoring_results)
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (
   public.current_user_can_edit_course(p_result.course_id)
   or (not exists(select 1 from courses where id=p_result.course_id) and (
     public.current_user_is_admin()
     or (p_result.organization_id is not null and public.current_user_can_edit_organization_content(p_result.organization_id))
     or (p_result.organization_id is null and public.current_user_has_platform_catalog_role(
       array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[])))))
$$;

create function private.ai_authoring_projection(r private.ai_authoring_results, p_detail boolean)
returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('id',r.id,'lessonId',r.lesson_id,'courseId',r.course_id,
 'title',coalesce(r.candidate->>'title',r.title),'stage',r.stage,'createdAt',r.created_at,'updatedAt',r.updated_at,
 'sourceRevision',r.source_revision,'position',r.insertion_position,'pageType',r.page_type,
 'focus',r.focus,'refinement',r.refinement,'parentId',r.parent_id,'estimatedUnits',r.estimated_units,
 'metered',r.organization_id is not null,'quoteExpiresAt',r.expires_at,'stopRequested',r.stop_requested,
 'candidate',case when p_detail then r.candidate else null end,'receipt',r.receipt,
 'credit',r.credit,'failure',r.failure,'deleted',r.deleted_at is not null)
$$;

create function public.admin_quote_ai_page(p_lesson_id text,p_revision bigint,p_focus text,p_page_type text,
 p_position integer,p_parent_id uuid default null,p_refinement text default '')
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare l public.lessons; c public.courses; r private.ai_authoring_results; parent private.ai_authoring_results; ctx jsonb;
begin
 perform private.lock_lesson_revision(p_lesson_id,p_revision);
 select * into l from lessons where id=p_lesson_id;
 select * into c from courses where id=l.course_id;
 if p_page_type not in ('concept','scenario','reflection','summary') or p_focus is null or length(p_focus)>1000
 or p_refinement is null or length(p_refinement)>1000 or p_position is null or p_position<1
 or p_position>(select count(*)+1 from lesson_pages where lesson_id=l.id) then
   raise exception 'Choose a valid page type, position and a shorter instruction.' using errcode='22023';
 end if;
 if p_parent_id is not null then
   select * into parent from private.ai_authoring_results where id=p_parent_id;
   if parent.id is null or not private.ai_authoring_can_access(parent) or parent.lesson_id<>l.id
     or parent.candidate is null or parent.deleted_at is not null then
     raise exception 'The earlier result is unavailable.' using errcode='42501';
   end if;
 end if;
 select jsonb_build_object('course',jsonb_build_object('title',c.title,'category',c.category,'level',c.level),
 'lesson',jsonb_build_object('title',l.title,'description',coalesce(l.description,'')),
 'existingPages',coalesce((select jsonb_agg(jsonb_build_object('title',p.title,'pageType',p.page_type) order by p.page_number)
   from lesson_pages p where p.lesson_id=l.id),'[]'),
 'focus',trim(p_focus),'pageType',p_page_type,'priorDraft',parent.candidate,
 'refinementInstruction',trim(p_refinement),'textOnly',true) into ctx;
 insert into private.ai_authoring_results(organization_id,course_id,lesson_id,created_by,title,source_revision,
 context,focus,page_type,insertion_position,parent_id,refinement)
 values(c.organization_id,c.id,l.id,auth.uid(),'Page for '||l.title,p_revision,ctx,trim(p_focus),p_page_type,p_position,p_parent_id,trim(p_refinement))
 returning * into r;
 return private.ai_authoring_projection(r,true);
end $$;

create function public.admin_start_ai_page(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; j uuid; result jsonb; prompt jsonb;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) or r.created_by<>auth.uid() then
   raise exception 'Page generation access required.' using errcode='42501'; end if;
 -- The quote identity is the intent identity, including after completion.
 if r.stage<>'quote' then return private.ai_authoring_projection(r,true); end if;
 if r.expires_at<now() then raise exception 'This estimate expired. Check the cost again.' using errcode='PT409'; end if;
 perform private.lock_lesson_revision(r.lesson_id,r.source_revision);
 if not exists(select 1 from lessons l join courses c on c.id=l.course_id
   where l.id=r.lesson_id and c.id=r.course_id and c.organization_id is not distinct from r.organization_id) then
   raise exception 'The lesson destination changed. Check the cost again.' using errcode='PT409'; end if;
 prompt:=jsonb_build_object('mode','authoring_page_v1','operationId',r.id,'lessonId',r.lesson_id);
 if r.organization_id is not null then
   result:=public.create_organization_ai_generation_job(p_organization_id=>r.organization_id,p_actor_user_id=>auth.uid(),
    p_job_type=>'course_text',p_prompt=>prompt,p_entity_id=>r.course_id,p_idempotency_key=>'authoring:'||r.id,
    p_operation_type=>'ai_lesson_page_extension',p_estimated_units=>r.estimated_units,p_course_id=>r.course_id,p_lesson_id=>r.lesson_id);
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

create function public.admin_read_ai_results(p_id uuid default null,p_lesson_id text default null,
 p_organization_id uuid default null,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public,private as $$
declare r private.ai_authoring_results;
begin
 if auth.uid() is null then raise exception 'Editor access required.' using errcode='42501'; end if;
 if p_id is not null then
   select * into r from private.ai_authoring_results where id=p_id;
   if r.id is null or not private.ai_authoring_can_access(r) then raise exception 'Result unavailable.' using errcode='42501'; end if;
   return private.ai_authoring_projection(r,true);
 end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(item order by created_at desc,id desc) from (
   select private.ai_authoring_projection(r,false) item,r.created_at,r.id from private.ai_authoring_results r
   where r.organization_id is not distinct from p_organization_id and (p_lesson_id is null or r.lesson_id=p_lesson_id)
   and r.stage<>'quote' and r.deleted_at is null and private.ai_authoring_can_access(r)
   order by r.created_at desc,r.id desc limit 20 offset greatest(0,least(p_offset,100000))) items),'[]'),
 'unusedCount',(select count(*) from private.ai_authoring_results r where r.organization_id is not distinct from p_organization_id
   and (p_lesson_id is null or r.lesson_id=p_lesson_id) and r.candidate is not null and r.receipt is null
   and r.deleted_at is null and private.ai_authoring_can_access(r)));
end $$;

create function public.admin_stop_ai_result(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; j public.ai_generation_jobs; u public.organization_ai_usage_records;
begin
 -- All worker/stop paths lock the job before the result, avoiding inversion.
 select * into j from ai_generation_jobs where id=(select job_id from private.ai_authoring_results where id=p_id) for update;
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) then raise exception 'Result unavailable.' using errcode='42501'; end if;
 if r.stage not in ('starting','writing') then return private.ai_authoring_projection(r,true); end if;
 if r.provider_started_at is null then
   u:=private.reconcile_organization_ai_usage_for_job(j,'failed','{}',null,'validation_error',false);
   update ai_generation_jobs set status='failed',failure_code='stopped_before_provider',locked_by=null,lock_token=null,
    error='Stopped before generation.',completed_at=now() where id=j.id;
   update private.ai_authoring_results set stage='stopped',stop_requested=true,updated_at=now(),
    credit=jsonb_build_object('status',case when organization_id is null then 'unmetered' else 'released' end,'used',0,'released',estimated_units)
    where id=r.id returning * into r;
 else
   update private.ai_authoring_results set stop_requested=true,updated_at=now() where id=r.id returning * into r;
 end if;
 return private.ai_authoring_projection(r,true);
end $$;

create function public.admin_delete_ai_result(p_id uuid) returns void
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) then raise exception 'Result unavailable.' using errcode='42501'; end if;
 if r.stage in ('starting','writing') then raise exception 'Stop generation before deleting this result.' using errcode='PT409'; end if;
 -- Retain the receipt/ledger identity while removing candidate content.
 update private.ai_authoring_results set deleted_at=now(),candidate=null,context='{}',focus='',refinement='',updated_at=now() where id=p_id;
end $$;

create function public.admin_apply_ai_page(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; pid text; b jsonb; n integer:=0; rev bigint; base integer;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) then raise exception 'Result unavailable.' using errcode='42501'; end if;
 if r.receipt is not null then return r.receipt; end if;
 if r.candidate is null or r.deleted_at is not null then raise exception 'This result is not ready to add.' using errcode='PT409'; end if;
 perform private.lock_lesson_revision(r.lesson_id,r.source_revision);
 if not exists(select 1 from lessons l join courses c on c.id=l.course_id
   where l.id=r.lesson_id and c.id=r.course_id and c.organization_id is not distinct from r.organization_id) then
   raise exception 'The lesson destination changed. Create a new version for the current lesson.' using errcode='PT409'; end if;
 if exists(select 1 from lesson_pages where lesson_id=r.lesson_id and lower(trim(title))=lower(trim(r.candidate->>'title'))) then
   raise exception 'A page with this title already exists. Refine the result before adding it.' using errcode='PT409'; end if;
 pid:='page-'||replace(r.id::text,'-','');
 select coalesce(max(page_number),0)+1 into base from lesson_pages where lesson_id=r.lesson_id;
 update lesson_pages set page_number=page_number+base where lesson_id=r.lesson_id and page_number>=r.insertion_position;
 update lesson_pages set page_number=page_number-base+1 where lesson_id=r.lesson_id and page_number>=r.insertion_position+base;
 insert into lesson_pages(id,lesson_id,page_number,title,subtitle,page_type,cover_image)
 values(pid,r.lesson_id,r.insertion_position,r.candidate->>'title',r.candidate->>'subtitle',
 (case when r.candidate->>'pageType'='scenario' then 'example' else r.candidate->>'pageType' end)::lesson_page_type,'{}');
 for b in select value from jsonb_array_elements(r.candidate->'blocks') loop
   n:=n+1;
   insert into lesson_content_blocks(page_id,block_type,sort_order,payload)
   values(pid,(b->>'blockType')::lesson_content_block_type,n,b->'payload');
 end loop;
 -- Existing AI lesson review is invalidated, never approved by generation.
 update lessons set ai_text_status=case when ai_generated then 'draft' else ai_text_status end,
 text_approved_at=case when ai_generated then null else text_approved_at end,
 text_approved_by=case when ai_generated then null else text_approved_by end where id=r.lesson_id;
 select draft_revision into rev from lessons where id=r.lesson_id;
 update private.ai_authoring_results set receipt=jsonb_build_object('status','saved','pageId',pid,'lessonId',r.lesson_id,
 'draftRevision',rev,'savedAt',now()),updated_at=now() where id=r.id returning * into r;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'ai_page_applied','lesson',r.lesson_id,jsonb_build_object('resultId',r.id,'pageId',pid));
 return r.receipt;
end $$;

-- Immediate dispatch claims one specific accepted job using the same leases,
-- entitlement recheck and stale-lease rules as the scheduled worker.
create function public.service_claim_ai_page(p_id uuid,p_worker text)
returns setof public.ai_generation_jobs language plpgsql security definer set search_path=public,private as $$
begin
 if nullif(trim(p_worker),'') is null then raise exception 'Worker identity required.'; end if;
 return query with candidate as (
 select j.id from ai_generation_jobs j join private.ai_authoring_results r on r.job_id=j.id
 where r.id=p_id and j.status in ('queued','running') and j.available_at<=now() and j.attempt_count<3
 and private.organization_ai_job_can_run(j)
 and (j.status='queued' or coalesce(j.heartbeat_at,j.locked_at)<now()-interval '30 minutes')
 for update of j skip locked
 ) update ai_generation_jobs j set status='running',attempt_count=attempt_count+1,locked_at=now(),locked_by=p_worker,
 heartbeat_at=now(),lock_token=gen_random_uuid(),lock_version=lock_version+1,started_at=coalesce(started_at,now())
 from candidate where j.id=candidate.id returning j.*;
end $$;

create function public.service_ai_page_checkpoint(p_job uuid,p_worker text,p_token uuid,p_version integer,
 p_action text,p_candidate jsonb default null)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare j public.ai_generation_jobs; r private.ai_authoring_results; u public.organization_ai_usage_records;
begin
 select * into j from ai_generation_jobs where id=p_job for update;
 perform private.assert_ai_generation_job_lease(j,p_worker,p_token,p_version);
 select * into r from private.ai_authoring_results where job_id=j.id for update;
 if r.id is null then raise exception 'Authoring result missing.'; end if;
 if p_action='begin' then
   if r.provider_started_at is not null then
     -- An expired worker may already have paid for a call. Never replay it.
     raise exception 'A previous provider outcome needs reconciliation.';
   end if;
   if r.stop_requested or not private.organization_ai_job_can_run(j)
      or not private.ai_authoring_actor_can_edit(r.created_by,r.course_id) then
     raise exception 'Generation access changed before provider work.' using errcode='22023';
   end if;
   update private.ai_authoring_results set stage='writing',provider_started_at=now(),updated_at=now() where id=r.id;
   return r.context;
 elsif p_action='ready' then
   if r.provider_started_at is null or jsonb_typeof(p_candidate) is distinct from 'object'
    or coalesce(trim(p_candidate->>'title'),'')='' or p_candidate->>'pageType' not in ('concept','scenario','reflection','summary')
    or jsonb_typeof(p_candidate->'blocks') is distinct from 'array' then raise exception 'Invalid page candidate.'; end if;
   if jsonb_array_length(p_candidate->'blocks') not between 1 and 4
    or exists(select 1 from jsonb_array_elements(p_candidate->'blocks') b where coalesce(b->>'blockType','') not in ('text','callout','table')) then
     raise exception 'The page pilot only supports text, callouts and tables.'; end if;
   perform public.complete_ai_generation_job(j.id,p_worker,p_token,p_version,r.course_id,'completed',jsonb_build_object('operationId',r.id),null);
   select * into u from organization_ai_usage_records where id=j.organization_ai_usage_record_id;
   update private.ai_authoring_results set stage='ready',candidate=p_candidate,updated_at=now(),
    credit=jsonb_build_object('status',coalesce(u.status,'unmetered'),'used',u.final_charged_units,'released',greatest(0,u.reserved_units-u.final_charged_units)) where id=r.id;
 elsif p_action='failed' then
   -- Before-provider failures release allocation. All uncertain/invalid outputs
   -- after dispatch settle under the existing started-work policy, without retry.
   perform public.fail_ai_generation_job(j.id,p_worker,p_token,p_version,'Page generation did not finish.',
    case when r.provider_started_at is null then 'validation_error' else 'worker_error' end,'{}',false);
   select * into u from organization_ai_usage_records where id=j.organization_ai_usage_record_id;
   update private.ai_authoring_results set stage='failed',failure=case when provider_started_at is null then
    'Generation could not start. Check access and try again.' else 'We could not confirm a complete page. Your earlier results are still available.' end,
    updated_at=now(),credit=jsonb_build_object('status',coalesce(u.status,'unmetered'),'used',u.final_charged_units,
    'released',greatest(0,u.reserved_units-u.final_charged_units)) where id=r.id;
 else raise exception 'Unknown checkpoint.'; end if;
 return jsonb_build_object('courseId',r.course_id,'lessonId',r.lesson_id);
end $$;

-- Explicit grants and classification for every new public RPC.
do $$ declare f record; worker boolean; begin
 for f in select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
 ('admin_quote_ai_page','admin_start_ai_page','admin_read_ai_results','admin_stop_ai_result','admin_delete_ai_result',
 'admin_apply_ai_page','service_claim_ai_page','service_ai_page_checkpoint') loop
 worker:=f.proname like 'service_%';
 execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',f.proname,f.args);
 execute format('grant execute on function public.%I(%s) to %s',f.proname,f.args,case when worker then 'service_role' else 'authenticated' end);
 insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles)
 values('public',f.proname,f.args,case when worker then 'SERVICE_ROLE_ONLY' else 'ADMIN_AUTHENTICATED' end,
 'AI page authoring pilot',case when worker then 'Trusted worker; fenced lease and metering.' else 'Current course editorial access; revision-checked writes.' end,
 case when worker then array['service_role'] else array['authenticated'] end);
 end loop;
end $$;
revoke all on function private.ai_authoring_actor_can_edit(uuid,text),private.ai_authoring_can_access(private.ai_authoring_results),
 private.ai_authoring_projection(private.ai_authoring_results,boolean) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
