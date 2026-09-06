begin;
drop function public.admin_media_library(uuid,text,text,text,integer,boolean);
delete from private.rpc_security_classifications where function_schema='public' and function_name='admin_media_library';
create function public.admin_media_library(p_organization_id uuid default null,p_source text default 'organization',p_search text default '',p_type text default 'image',p_offset integer default 0,p_manage boolean default false,p_course_id text default null)
returns jsonb language plpgsql stable security definer set search_path=public,private as $$
declare result jsonb;
begin
 if not private.media_can_edit(p_organization_id) then raise exception 'Media editor access required.' using errcode='42501'; end if;
 if p_source not in ('organization','platform') or p_offset < 0 or p_offset > 100000 then raise exception 'Invalid library request.' using errcode='22023'; end if;
 if p_manage and not private.media_can_manage(p_organization_id) then raise exception 'Media manager access required.' using errcode='42501'; end if;
 if p_course_id is not null and not exists(select 1 from public.courses c where c.id=p_course_id and c.organization_id is not distinct from p_organization_id and public.current_user_can_edit_course(c.id)) then raise exception 'Invalid media course filter.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(row),'[]') into result from (
 select v.id, a.id as asset_id,a.title,a.media_type as asset_type,v.alt_text,
 '/api/media/'||v.id as url, a.organization_id, v.rights_profile,v.rights_evidence,v.audience,v.withdrawn,v.revoked_at,
 (select coalesce(jsonb_agg(g.organization_id),'[]') from private.media_org_permissions g where g.version_id=v.id) as permitted_organizations,
 (select count(*) from private.media_placements p where p.version_id=v.id) as usage_count,
 (select coalesce(jsonb_agg(impact),'[]') from (
 select coalesce(o.name,'Platform Catalog') as organization,count(distinct mp.course_id) as courses,count(*) as placements
 from private.media_placements mp left join public.organizations o on o.id=mp.organization_id
 where mp.version_id=v.id group by o.name) impact) as impact,
 v.created_at
 from private.media_versions v join private.media_assets a on a.id=v.asset_id
 where (p_course_id is null or exists(select 1 from private.media_placements mp where mp.version_id=v.id and mp.course_id=p_course_id))
 and (p_type='' or a.media_type=p_type) and a.title ilike '%'||left(p_search,120)||'%'
 and (case when p_source='platform' then a.organization_id is null else a.organization_id is not distinct from p_organization_id end)
 and (case when p_manage then a.organization_id is not distinct from p_organization_id else private.media_permitted(v.id,p_organization_id) end)
 order by v.created_at desc,v.id limit 31 offset p_offset
 ) row;
 -- Sharing evidence/audience details are management metadata, never stock consumer metadata.
 if not p_manage then select coalesce(jsonb_agg(e - 'impact' - 'rights_evidence' - 'permitted_organizations' - 'usage_count'),'[]') into result from jsonb_array_elements(result) e; end if;
 return jsonb_build_object('assets',result,'canManage',private.media_can_manage(p_organization_id));
end $$;

revoke all on function public.admin_media_library(uuid,text,text,text,integer,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_media_library(uuid,text,text,text,integer,boolean,text) to authenticated;
insert into private.rpc_security_classifications values('public','admin_media_library','p_organization_id uuid, p_source text, p_search text, p_type text, p_offset integer, p_manage boolean, p_course_id text','ADMIN_AUTHENTICATED','Paginated workspace media picker.','Workspace role, source permissions and optional trusted course filter.',array['authenticated'],now());
notify pgrst,'reload schema';
commit;
