begin;
create function public.admin_media_issues(p_organization_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,private as $$
declare result jsonb;
begin
 if not private.media_can_edit(p_organization_id) then raise exception 'Media editor access required.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(row),'[]') into result from (
 select distinct p.course_id as "courseId",p.lesson_id as "lessonId",c.title
 from private.media_review_flags f join private.media_placements p on p.version_id=f.version_id and p.course_id=f.course_id
 join public.courses c on c.id=p.course_id where c.organization_id is not distinct from p_organization_id limit 100
 ) row;
 return result;
end $$;
create function public.admin_media_permission_targets(p_search text default '',p_selected uuid[] default '{}')
returns jsonb language plpgsql stable security definer set search_path=public,private as $$
declare result jsonb;
begin
 if not private.media_can_manage(null) then raise exception 'Platform Catalog manager access required.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(row),'[]') into result from (
 select id,name from public.organizations where id=any(p_selected) or name ilike '%'||left(p_search,120)||'%' order by (id=any(p_selected)) desc,name limit 100
 ) row;
 return result;
end $$;
-- A release operator calls this only after inventory review and application
-- compatibility verification. The migration never silently makes legacy URLs fail.
create function public.service_close_legacy_media_buckets() returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare r record; leftovers bigint; closed jsonb;
begin
 if exists(select 1 from private.media_migration_issues) then raise exception 'Resolve the media migration inventory before closing legacy storage.'; end if;
 -- Search every public table, including non-CMS consumers, for managed public
 -- object URLs. This bounded operational scan is not a rendering/read path.
 for r in select tablename from pg_tables where schemaname='public' loop
 execute format('select count(*) from public.%I t where position(%L in to_jsonb(t)::text)>0 or exists(select 1 from private.media_versions v where position(''/storage/v1/object/public/''||v.bucket||''/'' in to_jsonb(t)::text)>0)',r.tablename,'/storage/v1/object/public/learning-media/') into leftovers;
 if leftovers>0 then raise exception 'Unconverted public media references remain in %.',r.tablename; end if;
 end loop;
 select coalesce(jsonb_agg(distinct bucket),'[]') into closed from private.media_versions where bucket<>'learning-media-private';
 update storage.buckets set public=false where id in (select bucket from private.media_versions) or id='learning-media';
 return closed;
end $$;
revoke all on function public.admin_media_issues(uuid),public.admin_media_permission_targets(text,uuid[]),public.service_close_legacy_media_buckets() from public,anon,authenticated,service_role;
grant execute on function public.admin_media_issues(uuid),public.admin_media_permission_targets(text,uuid[]) to authenticated;
grant execute on function public.service_close_legacy_media_buckets() to service_role;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles)
select 'public',p.proname,pg_get_function_identity_arguments(p.oid),case when p.proname like 'service_%' then 'SERVICE_ROLE_ONLY' else 'ADMIN_AUTHENTICATED' end,
 'Media review and explicit release cutover.','Workspace editor/manager predicate or trusted release operator; inventory gates legacy cutover.',
 case when p.proname like 'service_%' then array['service_role'] else array['authenticated'] end
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('admin_media_issues','admin_media_permission_targets','service_close_legacy_media_buckets');
notify pgrst,'reload schema';
commit;
