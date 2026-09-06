begin;
-- Durable files are independent of course/generation placements. No API role
-- can write the registry directly; all operations use the boundaries below.
create table private.media_assets (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id),
 title text not null,
 media_type text not null check(media_type in ('image','audio','video')),
 source_version_id uuid,
 created_at timestamptz not null default now()
);
create table private.media_versions (
 id uuid primary key default gen_random_uuid(),
 asset_id uuid not null references private.media_assets(id),
 bucket text not null,
 storage_path text not null,
 byte_size bigint not null default 0 check(byte_size >= 0),
 mime_type text not null,
 alt_text text not null default '',
 rights_profile text not null default 'unverified' check(rights_profile in ('unverified','project_reuse')),
 rights_evidence text not null default '',
 audience text not null default 'none' check(audience in ('none','all','selected')),
 withdrawn boolean not null default false,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 unique(bucket,storage_path)
);
alter table private.media_assets add foreign key(source_version_id) references private.media_versions(id);
create table private.media_org_permissions (
 version_id uuid not null references private.media_versions(id),
 organization_id uuid not null references public.organizations(id),
 primary key(version_id,organization_id)
);
create table private.media_legacy_urls (
 url text primary key,
 version_id uuid not null references private.media_versions(id)
);
create table private.media_migration_issues (
 id bigint generated always as identity primary key,
 legacy_asset_id uuid,
 reason text not null,
 detail jsonb not null default '{}'
);
create table private.media_placements (
 container_key text not null,
 slot text not null,
 version_id uuid not null references private.media_versions(id),
 course_id text not null references public.courses(id) on delete cascade,
 lesson_id text references public.lessons(id) on delete cascade,
 organization_id uuid references public.organizations(id),
 in_draft boolean not null default true,
 in_publication boolean not null default false,
 authorised_at timestamptz not null default now(),
 primary key(container_key,slot,version_id)
);
create table private.media_restore_context (
 transaction_id bigint not null, lesson_id text not null,
 primary key(transaction_id,lesson_id)
);
create table private.media_review_flags (
 version_id uuid not null references private.media_versions(id),
 course_id text not null references public.courses(id) on delete cascade,
 lesson_id text,
 created_at timestamptz not null default now(),
 primary key(version_id,course_id)
);
-- Review flags survive notification failures. Delivery can be retried by a manager.
create table private.media_notification_outbox (
 version_id uuid primary key references private.media_versions(id),
 delivered_at timestamptz
);
do $$ declare t text; begin
 foreach t in array array['media_assets','media_versions','media_org_permissions','media_legacy_urls','media_migration_issues','media_placements','media_restore_context','media_review_flags','media_notification_outbox'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

create function private.media_can_edit(p_org uuid) returns boolean
language sql stable security definer set search_path=public,private as $$
 select auth.uid() is not null and (public.current_user_is_admin() or case when p_org is null then
 public.current_user_has_platform_catalog_role(array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[])
 else public.current_user_can_edit_organization_content(p_org) end);
$$;
create function private.media_can_manage(p_org uuid) returns boolean
language sql stable security definer set search_path=public,private as $$
 select auth.uid() is not null and (public.current_user_is_admin() or case when p_org is null then
 public.current_user_has_platform_catalog_role(array['organisation_owner','organisation_admin']::public.organization_role_key[])
 else public.current_user_has_organization_role(p_org,array['organisation_owner','organisation_admin']::public.organization_role_key[]) end);
$$;
create function public.media_workspace_permissions(p_organization_id uuid default null) returns jsonb
language sql stable security definer set search_path=public,private as $$
 select jsonb_build_object('canEdit',private.media_can_edit(p_organization_id),'canManage',private.media_can_manage(p_organization_id));
$$;
-- Permission to make a NEW use; existing placement authorisations are separate.
create function private.media_permitted(p_version uuid,p_org uuid) returns boolean
language sql stable security definer set search_path=public,private as $$
 select exists(select 1 from private.media_versions v join private.media_assets a on a.id=v.asset_id
 where v.id=p_version and v.revoked_at is null and not v.withdrawn and (
 a.organization_id is not distinct from p_org or
 (a.organization_id is null and p_org is not null and v.rights_profile='project_reuse' and
 (v.audience='all' or (v.audience='selected' and exists(select 1 from private.media_org_permissions g where g.version_id=v.id and g.organization_id=p_org))))));
$$;
create function public.admin_media_library(p_organization_id uuid default null,p_source text default 'organization',p_search text default '',p_type text default 'image',p_offset integer default 0,p_manage boolean default false)
returns jsonb language plpgsql stable security definer set search_path=public,private as $$
declare result jsonb;
begin
 if not private.media_can_edit(p_organization_id) then raise exception 'Media editor access required.' using errcode='42501'; end if;
 if p_source not in ('organization','platform') or p_offset < 0 or p_offset > 100000 then raise exception 'Invalid library request.' using errcode='22023'; end if;
 if p_manage and not private.media_can_manage(p_organization_id) then raise exception 'Media manager access required.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(row),'[]') into result from (
 select v.id, a.id as asset_id,a.title,a.media_type as asset_type,v.alt_text,
 '/api/media/'||v.id as url, a.organization_id, v.rights_profile,v.rights_evidence,v.audience,v.withdrawn,v.revoked_at,
 (select coalesce(jsonb_agg(g.organization_id),'[]') from private.media_org_permissions g where g.version_id=v.id) as permitted_organizations,
 (select count(*) from private.media_placements p where p.version_id=v.id) as usage_count,
 v.created_at
 from private.media_versions v join private.media_assets a on a.id=v.asset_id
 where (p_type='' or a.media_type=p_type) and a.title ilike '%'||left(p_search,120)||'%'
 and (case when p_source='platform' then a.organization_id is null else a.organization_id is not distinct from p_organization_id end)
 and (case when p_manage then a.organization_id is not distinct from p_organization_id else private.media_permitted(v.id,p_organization_id) end)
 order by v.created_at desc,v.id limit 31 offset p_offset
 ) row;
 -- Sharing evidence/audience details are management metadata, never stock consumer metadata.
 if not p_manage then select coalesce(jsonb_agg(e - 'rights_evidence' - 'permitted_organizations' - 'usage_count'),'[]') into result from jsonb_array_elements(result) e; end if;
 return jsonb_build_object('assets',result,'canManage',private.media_can_manage(p_organization_id));
end $$;

create function public.service_register_media(p_organization_id uuid,p_storage_path text,p_mime_type text,p_size bigint,p_title text,p_alt_text text,p_rights_evidence text,p_asset_id uuid default null,p_source_version_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare a uuid:=p_asset_id; v uuid; used bigint; max_bytes bigint;
begin
 if p_size <= 0 or p_size > 104857600 or length(trim(p_rights_evidence))=0 or p_storage_path not like 'registry/%' then raise exception 'Invalid registered upload.' using errcode='22023'; end if;
 if p_organization_id is not null then
 perform 1 from public.organizations where id=p_organization_id for update;
 if not found then raise exception 'Organisation not found.'; end if;
 select private.organization_learning_storage_bytes_unchecked(p_organization_id) into used;
 max_bytes:=private.organization_entitlement_integer_unchecked(p_organization_id,'max_storage_bytes');
 if used+p_size > max_bytes then raise exception 'This upload exceeds the organisation storage allowance.' using errcode='23514'; end if;
 end if;
 if a is null then
 insert into private.media_assets(organization_id,title,media_type,source_version_id)
 values(p_organization_id,left(p_title,180),split_part(p_mime_type,'/',1),p_source_version_id) returning id into a;
 elsif not exists(select 1 from private.media_assets where id=a and organization_id is not distinct from p_organization_id) then raise exception 'Asset ownership mismatch.' using errcode='42501'; end if;
 insert into private.media_versions(asset_id,bucket,storage_path,byte_size,mime_type,alt_text,rights_profile,rights_evidence)
 values(a,'learning-media-private',p_storage_path,p_size,p_mime_type,left(p_alt_text,240),'project_reuse',left(p_rights_evidence,2000)) returning id into v;
 return jsonb_build_object('id',v,'asset_id',a,'asset_type',split_part(p_mime_type,'/',1),'placement',left(p_title,180),'alt_text',p_alt_text,'url','/api/media/'||v);
end $$;

-- Count physical org-owned bytes once, including unattached uploads and versions.
create or replace function private.organization_learning_storage_bytes_unchecked(p_organization_id uuid)
returns bigint language sql stable security definer set search_path=public,private as $$
 select coalesce(sum(v.byte_size),0)::bigint from private.media_versions v
 join private.media_assets a on a.id=v.asset_id where a.organization_id=p_organization_id;
$$;

create function public.admin_manage_media(p_version_id uuid,p_action text,p_title text default null,p_audience text default null,p_organizations uuid[] default '{}',p_rights_evidence text default null)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare v private.media_versions; a private.media_assets; impacts jsonb;
begin
 select * into v from private.media_versions where id=p_version_id for update;
 select * into a from private.media_assets where id=v.asset_id;
 if v.id is null or not private.media_can_manage(a.organization_id) then raise exception 'Media manager access required.' using errcode='42501'; end if;
 if p_action='describe' then
 if nullif(trim(p_title),'') is null then raise exception 'A title is required.'; end if;
 update private.media_assets set title=left(trim(p_title),180) where id=a.id;
 elsif p_action='share' then
 if a.organization_id is not null or v.rights_profile<>'project_reuse' or v.revoked_at is not null or p_audience not in ('none','all','selected') then raise exception 'Only eligible platform media can be shared.' using errcode='23514'; end if;
 delete from private.media_org_permissions where version_id=v.id;
 insert into private.media_org_permissions select v.id,o from unnest(p_organizations) o on conflict do nothing;
 update private.media_versions set audience=p_audience,withdrawn=false where id=v.id;
 elsif p_action='withdraw' then update private.media_versions set withdrawn=true where id=v.id;
 elsif p_action='revoke' then
 update private.media_versions set revoked_at=coalesce(revoked_at,now()),withdrawn=true where id=v.id;
 insert into private.media_review_flags(version_id,course_id,lesson_id)
 select v.id,p.course_id,min(p.lesson_id) from private.media_placements p where p.version_id=v.id group by p.course_id on conflict do nothing;
 insert into private.media_notification_outbox(version_id) values(v.id) on conflict do nothing;
 elsif p_action='delete' then
 if exists(select 1 from private.media_placements where version_id=v.id) then raise exception 'This version is still used by content.' using errcode='23514'; end if;
 -- Tombstone first; physical cleanup is service-only and cannot race a new use.
 update private.media_versions set withdrawn=true,revoked_at=coalesce(revoked_at,now()) where id=v.id;
 elsif p_action='rights' then
 raise exception 'Rights changes require a new version with new evidence.' using errcode='23514';
 else raise exception 'Unknown media action.' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('courseId',course_id,'lessonId',lesson_id)),'[]') into impacts
 from (select distinct course_id,lesson_id from private.media_placements where version_id=v.id) p;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'media_'||p_action,'media_version',v.id::text,jsonb_build_object('assetId',a.id,'affectedContent',impacts));
 return jsonb_build_object('assetId',a.id,'affectedContent',impacts,'bucket',case when p_action='delete' then v.bucket end,'storagePath',case when p_action='delete' then v.storage_path end);
end $$;

-- Backfill a single registry identity per stored object; ambiguous cross-owner
-- duplicates are quarantined for the explicit migration review.
create function private.media_backfill_registry() returns void
language plpgsql security definer set search_path=public,private as $$
declare r record; aid uuid; vid uuid; begin
 for r in select storage_path,coalesce(nullif(substring(url from '/object/public/([^/]+)/'),''),'learning-media') bucket,min(url) url,min(asset_type) asset_type,min(coalesce(alt_text,'')) alt_text,
 min(coalesce(c.organization_id,lc.organization_id)::text)::uuid org,
 count(distinct coalesce(coalesce(c.organization_id,lc.organization_id)::text,'platform')) owners,
 max(private.learning_media_asset_storage_size(m.metadata)) bytes
 from public.learning_media_assets m left join public.courses c on c.id=m.course_id
 left join public.lessons l on l.id=m.lesson_id left join public.courses lc on lc.id=l.course_id
 where nullif(m.storage_path,'') is not null group by storage_path,coalesce(nullif(substring(url from '/object/public/([^/]+)/'),''),'learning-media') loop
 if r.owners>1 then
 insert into private.media_migration_issues(reason,detail) values('shared_object_multiple_owners',jsonb_build_object('storagePath',r.storage_path,'bucket',r.bucket));
 continue;
 end if;
 select id into vid from private.media_versions where bucket=r.bucket and storage_path=r.storage_path;
 if found then continue; end if;
 insert into private.media_assets(organization_id,title,media_type) values(r.org,coalesce(nullif(r.alt_text,''),'Imported media'),case when r.asset_type in ('audio','video') then r.asset_type else 'image' end) returning id into aid;
 insert into private.media_versions(asset_id,bucket,storage_path,byte_size,mime_type,alt_text)
 values(aid,r.bucket,r.storage_path,r.bytes,case when r.asset_type='audio' then 'audio/mpeg' when r.asset_type='video' then 'video/mp4' else 'image/png' end,r.alt_text) returning id into vid;
 insert into private.media_legacy_urls select distinct m.url,vid from public.learning_media_assets m where m.storage_path=r.storage_path and coalesce(nullif(substring(m.url from '/object/public/([^/]+)/'),''),'learning-media')=r.bucket and nullif(m.url,'') is not null on conflict do nothing;
 end loop;
 insert into private.media_migration_issues(legacy_asset_id,reason,detail)
 select id,'external_or_missing_storage',jsonb_build_object('url',url) from public.learning_media_assets where nullif(url,'') is not null and nullif(storage_path,'') is null;
end $$;
revoke all on function private.media_backfill_registry() from public,anon,authenticated,service_role;
select private.media_backfill_registry();
insert into storage.buckets(id,name,public) values('learning-media-private','learning-media-private',false) on conflict(id) do update set public=false;

-- Only these explicit entry points are exposed. Private helper ACLs stay closed.
revoke all on function public.media_workspace_permissions(uuid),public.admin_media_library(uuid,text,text,text,integer,boolean),public.admin_manage_media(uuid,text,text,text,uuid[],text),public.service_register_media(uuid,text,text,bigint,text,text,text,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.media_workspace_permissions(uuid),public.admin_media_library(uuid,text,text,text,integer,boolean),public.admin_manage_media(uuid,text,text,text,uuid[],text) to authenticated;
grant execute on function public.service_register_media(uuid,text,text,bigint,text,text,text,uuid,uuid) to service_role;
revoke all on function private.media_can_edit(uuid),private.media_can_manage(uuid),private.media_permitted(uuid,uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
