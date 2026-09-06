begin;
-- Keep management bound to the selected workspace even for oversight actors.
alter function public.admin_manage_media(uuid,text,text,text,uuid[],text) rename to media_manage_base;
alter function public.media_manage_base(uuid,text,text,text,uuid[],text) set schema private;
revoke all on function private.media_manage_base(uuid,text,text,text,uuid[],text) from public,anon,authenticated,service_role;
create function public.admin_manage_media(p_version_id uuid,p_action text,p_title text default null,p_audience text default null,p_organizations uuid[] default '{}',p_rights_evidence text default null,p_organization_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare version record; result jsonb; asset uuid;
begin
 if not exists(select 1 from private.media_versions v join private.media_assets a on a.id=v.asset_id where v.id=p_version_id and a.organization_id is not distinct from p_organization_id) then raise exception 'Media does not belong to the selected workspace.' using errcode='42501'; end if;
 if p_action='delete' and (exists(select 1 from private.media_assets where source_version_id=p_version_id)
 or exists(select 1 from public.learning_media_assets where url='/api/media/'||p_version_id)) then raise exception 'This version is still referenced by media or derivatives.' using errcode='23514'; end if;
 if p_action='revoke_asset' then
 select asset_id into asset from private.media_versions where id=p_version_id;
 for version in select id from private.media_versions where asset_id=asset order by id for update loop
 result:=private.media_manage_base(version.id,'revoke',null,null,'{}',null);
 end loop;
 return jsonb_build_object('assetId',asset,'status','revoked');
 end if;
 return private.media_manage_base(p_version_id,p_action,p_title,p_audience,p_organizations,p_rights_evidence);
end $$;
create function public.service_finish_media_deletion(p_version_id uuid) returns void
language plpgsql security definer set search_path=public,private as $$
declare asset uuid;
begin
 select asset_id into asset from private.media_versions where id=p_version_id and revoked_at is not null and withdrawn for update;
 if not found then raise exception 'Only tombstoned media can be removed.'; end if;
 if exists(select 1 from private.media_placements where version_id=p_version_id) or exists(select 1 from public.learning_media_assets where url='/api/media/'||p_version_id) then raise exception 'Referenced media cannot be removed.'; end if;
 delete from private.media_legacy_urls where version_id=p_version_id;
 delete from private.media_org_permissions where version_id=p_version_id;
 delete from private.media_review_flags where version_id=p_version_id;
 delete from private.media_notification_outbox where version_id=p_version_id;
 delete from private.media_versions where id=p_version_id;
 delete from private.media_assets where id=asset and not exists(select 1 from private.media_versions where asset_id=asset);
end $$;
create function public.admin_remove_media_placement(p_media_id uuid) returns void
language plpgsql security definer set search_path=public,private as $$
declare c text;
begin
 select coalesce(m.course_id,l.course_id) into c from public.learning_media_assets m left join public.lessons l on l.id=m.lesson_id where m.id=p_media_id for update of m;
 if auth.uid() is null or c is null or not public.current_user_can_edit_course(c) then raise exception 'Media editor access required.' using errcode='42501'; end if;
 delete from public.learning_media_assets where id=p_media_id;
end $$;
-- Generation rows refer to immutable registered files. Existing quota checks
-- still enforce allowed media types; physical bytes are counted in the registry.
create or replace function private.enforce_organization_learning_media_entitlements()
returns trigger language plpgsql security definer set search_path=public,private as $$
declare org uuid;
begin
 org:=private.learning_media_asset_organization_id(new.course_id,new.lesson_id);
 if org is not null and new.asset_type in ('audio','video') and not private.organization_entitlement_text_array_contains_unchecked(org,'allowed_lesson_block_types',new.asset_type) then
 raise exception 'Video and audio lessons are available on paid organisation plans.' using errcode='23514'; end if;
 return new;
end $$;
create function private.media_generation_reference() returns trigger
language plpgsql security definer set search_path=public,private as $$
declare c text; org uuid; vid uuid;
begin
 if tg_op='DELETE' then delete from private.media_placements where container_key='media:'||old.id; return old; end if;
 select coalesce(new.course_id,l.course_id) into c from public.lessons l where l.id=new.lesson_id;
 c:=coalesce(c,new.course_id);
 new.url:=private.media_normalize(to_jsonb(new.url))#>>'{}';
 if new.url like '/api/media/%' then
 vid:=substring(new.url from '/api/media/([a-f0-9-]{36})')::uuid;
 -- Lock before both registry-use validation and deletion can proceed.
 perform 1 from private.media_versions where id=vid for update;
 perform private.media_sync('media:'||new.id,c,new.lesson_id,to_jsonb(new.url));
 -- The placement no longer owns the file; retaining its path encourages unsafe
 -- legacy deletion and double-counting in callers.
 new.storage_path:=null;
 elsif tg_op='UPDATE' and old.url like '/api/media/%' and new.url is distinct from old.url then
 perform private.media_sync('media:'||new.id,c,new.lesson_id,to_jsonb(new.url));
 end if;
 return new;
end $$;
create trigger media_generation_reference before insert or update or delete on public.learning_media_assets for each row execute function private.media_generation_reference();
-- Register existing generation references as well as learner content references.
update public.learning_media_assets set url=url where url like '/api/media/%';

-- Publishing identical JSON must still recheck emergency revocation. Revert
-- changes neither publication timestamp nor status and remains available.
create function private.media_check_publish() returns trigger
language plpgsql security definer set search_path=public,private as $$
begin
 if (new.published_at is distinct from old.published_at or (new.status='published' and old.status<>'published')) and exists(
 select 1 from private.media_placements p join private.media_versions v on v.id=p.version_id where p.lesson_id=new.id and p.in_draft and v.revoked_at is not null) then
 raise exception 'Replace revoked media before publishing.' using errcode='23514'; end if;
 return new;
end $$;
create trigger media_check_publish before update on public.lessons for each row execute function private.media_check_publish();

-- Operational inventory is read-only; privacy cutover is not claimed until
-- legacy public buckets/URLs and ambiguous ownership have been resolved.
create function public.service_media_inventory() returns jsonb
language sql stable security definer set search_path=public,private as $$
 select jsonb_build_object('issues',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from private.media_migration_issues i),
 'publicBuckets',(select coalesce(jsonb_agg(b.id),'[]') from storage.buckets b where b.public and (b.id='learning-media' or exists(select 1 from private.media_versions v where v.bucket=b.id))),
 'unverifiedVersions',(select count(*) from private.media_versions where rights_profile='unverified'),
 'versions',(select count(*) from private.media_versions));
$$;
revoke all on function public.admin_manage_media(uuid,text,text,text,uuid[],text,uuid),public.admin_remove_media_placement(uuid),public.service_finish_media_deletion(uuid),public.service_media_inventory() from public,anon,authenticated,service_role;
grant execute on function public.admin_manage_media(uuid,text,text,text,uuid[],text,uuid),public.admin_remove_media_placement(uuid) to authenticated;
grant execute on function public.service_finish_media_deletion(uuid),public.service_media_inventory() to service_role;
revoke all on function private.media_generation_reference(),private.media_check_publish() from public,anon,authenticated,service_role;

-- Inventory every new endpoint and helper for the existing default-deny CI gate.
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles)
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),
 case when n.nspname='private' then case when p.prorettype='trigger'::regtype then 'TRIGGER_ONLY' else 'INTERNAL_HELPER' end
 when p.proname like 'service_%' then 'SERVICE_ROLE_ONLY' when p.proname='media_delivery' then 'PUBLIC_ANON' else 'ADMIN_AUTHENTICATED' end,
 'Media ownership, library and saved-placement workflow.',
 'Selected workspace roles, explicit version permissions and saved content authorisations; no direct registry grants.',
 case when n.nspname='private' then '{}'::text[] when p.proname like 'service_%' then array['service_role'] when p.proname='media_delivery' then array['anon','authenticated'] else array['authenticated'] end
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='private' and p.proname like 'media_%') or (n.nspname='public' and p.proname in ('media_workspace_permissions','admin_media_library','admin_manage_media','service_register_media','media_delivery','admin_dispatch_media_notifications','admin_remove_media_placement','service_finish_media_deletion','service_media_inventory'))
on conflict(function_schema,function_name,identity_arguments) do update set classification=excluded.classification,authorization_rule=excluded.authorization_rule,execute_roles=excluded.execute_roles;
notify pgrst,'reload schema';
commit;
