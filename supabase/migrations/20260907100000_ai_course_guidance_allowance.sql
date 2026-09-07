begin;
-- A small platform-funded setup allowance, separate from organisation credits.
-- No prompts or transcripts are retained. Failed/uncertain calls keep their slot.
create table private.ai_course_guidance_requests (
 id uuid primary key,
 actor_id uuid not null references auth.users(id) on delete cascade,
 organization_id uuid references public.organizations(id) on delete cascade,
 session_id uuid not null,
 created_at timestamptz not null default now()
);
create index ai_course_guidance_recent on private.ai_course_guidance_requests(created_at);
create index ai_course_guidance_session on private.ai_course_guidance_requests(actor_id,session_id);
revoke all on private.ai_course_guidance_requests from public,anon,authenticated,service_role;

create function public.admin_reserve_ai_course_guidance(p_id uuid,p_session uuid,p_organization_id uuid default null)
returns boolean language plpgsql security definer set search_path=public,private as $$
declare actor uuid:=auth.uid(); n_all integer; n_actor integer; n_workspace integer;
begin
 if p_id is null or p_session is null or not private.ai_course_workspace_editor(actor,p_organization_id) then
  raise exception 'Workspace editing access required.' using errcode='42501';
 end if;
 if p_organization_id is not null and not coalesce((private.resolve_organization_entitlements_unchecked(p_organization_id)->>'ai_authoring_enabled')::boolean,false) then
  raise exception 'AI authoring is not available on this organisation plan.' using errcode='42501';
 end if;
 -- Serialize this deliberately small global allowance before testing all limits.
 perform pg_advisory_xact_lock(hashtextextended('ai-course-guidance-allowance',0));
 if exists(select 1 from private.ai_course_guidance_requests where id=p_id) then return false; end if;
 if (select count(*) from private.ai_course_guidance_requests where actor_id=actor and session_id=p_session)>=4 then return false; end if;
 select count(*),count(*) filter(where actor_id=actor),count(*) filter(where organization_id is not distinct from p_organization_id)
 into n_all,n_actor,n_workspace from private.ai_course_guidance_requests where created_at>=now()-interval '24 hours';
 if n_all>=200 or n_actor>=12 or n_workspace>=60 then return false; end if;
 insert into private.ai_course_guidance_requests(id,actor_id,organization_id,session_id) values(p_id,actor,p_organization_id,p_session);
 return true;
end $$;
revoke all on function public.admin_reserve_ai_course_guidance(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_reserve_ai_course_guidance(uuid,uuid,uuid) to authenticated;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles)
values('public','admin_reserve_ai_course_guidance','p_id uuid, p_session uuid, p_organization_id uuid','ADMIN_AUTHENTICATED','Course editors','Workspace editor and entitlement; serialized bounded platform-funded allowance; no organisation credits.',array['authenticated']);
notify pgrst,'reload schema';
commit;
