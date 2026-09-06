begin;
create function private.media_normalize(p_value jsonb) returns jsonb
language plpgsql stable security definer set search_path=public,private as $$
declare result jsonb; r record; s text;
begin
 if p_value is null then return null; end if;
 case jsonb_typeof(p_value)
 when 'object' then
 select coalesce(jsonb_object_agg(key,private.media_normalize(value)),'{}') into result from jsonb_each(p_value);
 when 'array' then
 select coalesce(jsonb_agg(private.media_normalize(value) order by n),'[]') into result from jsonb_array_elements(p_value) with ordinality e(value,n);
 when 'string' then
 s:=p_value#>>'{}';
 for r in select url,version_id from private.media_legacy_urls where position(url in s)>0 loop s:=replace(s,r.url,'/api/media/'||r.version_id); end loop;
 result:=to_jsonb(s);
 else result:=p_value;
 end case;
 return result;
end $$;
create function private.media_references(p_value jsonb,p_path text default '$')
returns table(slot text,version_id uuid) language plpgsql immutable set search_path=public,private as $$
declare r record;
begin
 case jsonb_typeof(p_value)
 when 'object' then
 for r in select key,value from jsonb_each(p_value) loop return query select * from private.media_references(r.value,p_path||'.'||r.key); end loop;
 when 'array' then
 for r in select value,n from jsonb_array_elements(p_value) with ordinality e(value,n) loop return query select * from private.media_references(r.value,p_path||'['||r.n||']'); end loop;
 when 'string' then
 return query select p_path||':'||n, (m[1])::uuid from regexp_matches(p_value#>>'{}','/api/media/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})','g') with ordinality e(m,n);
 else null;
 end case;
end $$;
create function private.media_sync(p_container text,p_course text,p_lesson text,p_value jsonb,p_publication boolean default false,p_backfill boolean default false)
returns void language plpgsql security definer set search_path=public,private as $$
declare r record; org uuid; owner_org uuid; revoked timestamptz; permitted boolean; retained boolean; restoring boolean;
begin
 select organization_id into org from public.courses where id=p_course;
 restoring:=exists(select 1 from private.media_restore_context where transaction_id=txid_current() and lesson_id=p_lesson);
 -- Serialize grants/withdrawal and saved uses with the same version-row locks.
 perform 1 from private.media_versions v where id in (select version_id from private.media_references(p_value)) order by id for update;
 for r in select * from private.media_references(p_value) loop
 select a.organization_id,v.revoked_at into owner_org,revoked from private.media_versions v join private.media_assets a on a.id=v.asset_id where v.id=r.version_id;
 if not found then raise exception 'Media version does not exist.' using errcode='23514'; end if;
 if owner_org is not null and owner_org is distinct from org then raise exception 'Organisation media cannot be used outside its owner.' using errcode='42501'; end if;
 if p_publication then
 retained:=exists(select 1 from private.media_placements where container_key=p_container and slot=r.slot and version_id=r.version_id and course_id=p_course and lesson_id is not distinct from p_lesson and in_draft);
 if not p_backfill and (not retained or revoked is not null) then raise exception 'Publication requires saved, non-revoked media placements.' using errcode='23514'; end if;
 else
 retained:=exists(select 1 from private.media_placements where container_key=p_container and slot=r.slot and version_id=r.version_id and course_id=p_course and lesson_id is not distinct from p_lesson and organization_id is not distinct from org and (in_draft or (restoring and in_publication)));
 permitted:=private.media_permitted(r.version_id,org);
 if not p_backfill and not retained and not permitted then raise exception 'Media permission has changed. Choose a permitted replacement.' using errcode='42501'; end if;
 end if;
 insert into private.media_placements(container_key,slot,version_id,course_id,lesson_id,organization_id,in_draft,in_publication)
 values(p_container,r.slot,r.version_id,p_course,p_lesson,org,not p_publication,p_publication)
 on conflict(container_key,slot,version_id) do update set
 in_draft=case when p_publication then media_placements.in_draft else true end,
 in_publication=case when p_publication then true else media_placements.in_publication end;
 end loop;
 if not p_publication then
 update private.media_placements p set in_draft=false where container_key=p_container and not exists(select 1 from private.media_references(p_value) ref where ref.slot=p.slot and ref.version_id=p.version_id);
 delete from private.media_placements where container_key=p_container and not in_draft and not in_publication;
 end if;
end $$;
create function private.media_sync_publication(p_lesson text,p_snapshot jsonb,p_backfill boolean default false)
returns void language plpgsql security definer set search_path=public,private as $$
declare c text; r record;
begin
 select course_id into c from public.lessons where id=p_lesson;
 update private.media_placements set in_publication=false where lesson_id=p_lesson;
 perform private.media_sync('lesson:'||p_lesson,c,p_lesson,p_snapshot->'lesson'->'cover_image',true,p_backfill);
 for r in select value from jsonb_array_elements(coalesce(p_snapshot->'pages','[]')) loop
 perform private.media_sync('page:'||(r.value->>'id'),c,p_lesson,r.value->'cover_image',true,p_backfill);
 end loop;
 for r in select value from jsonb_array_elements(coalesce(p_snapshot->'blocks','[]')) loop
 perform private.media_sync('block:'||(r.value->>'id'),c,p_lesson,r.value->'payload',true,p_backfill);
 end loop;
 delete from private.media_placements where lesson_id=p_lesson and not in_draft and not in_publication;
end $$;

-- Transform only known managed URLs, preserving all unrelated content and the
-- publication boundary. No forced publication or snapshot recapture.
update public.courses set thumbnail=private.media_normalize(thumbnail) where thumbnail is not null;
update public.lessons set cover_image=private.media_normalize(cover_image),published_snapshot=private.media_normalize(published_snapshot);
update public.lesson_pages set cover_image=private.media_normalize(cover_image) where cover_image is not null;
update public.lesson_content_blocks set payload=private.media_normalize(payload);
update public.learning_media_assets m set url='/api/media/'||u.version_id from private.media_legacy_urls u where m.url=u.url;
do $$ declare r record; begin
 for r in select id,thumbnail from public.courses loop perform private.media_sync('course:'||r.id,r.id,null,r.thumbnail,false,true); end loop;
 for r in select id,course_id,cover_image from public.lessons loop perform private.media_sync('lesson:'||r.id,r.course_id,r.id,r.cover_image,false,true); end loop;
 for r in select p.id,p.lesson_id,l.course_id,p.cover_image from public.lesson_pages p join public.lessons l on l.id=p.lesson_id loop perform private.media_sync('page:'||r.id,r.course_id,r.lesson_id,r.cover_image,false,true); end loop;
 for r in select b.id,b.payload,p.lesson_id,l.course_id from public.lesson_content_blocks b join public.lesson_pages p on p.id=b.page_id join public.lessons l on l.id=p.lesson_id loop perform private.media_sync('block:'||r.id,r.course_id,r.lesson_id,r.payload,false,true); end loop;
 for r in select id,published_snapshot from public.lessons where published_snapshot is not null loop perform private.media_sync_publication(r.id,r.published_snapshot,true); end loop;
end $$;

create function private.media_content_before() returns trigger
language plpgsql security definer set search_path=public,private as $$
begin
 if tg_table_name='courses' then
 new.thumbnail:=private.media_normalize(new.thumbnail);
 if tg_op='UPDATE' and new.status='published' and old.status<>'published' and exists(select 1 from private.media_references(new.thumbnail) ref join private.media_versions v on v.id=ref.version_id where v.revoked_at is not null) then raise exception 'Replace revoked media before publishing.' using errcode='23514'; end if;
 if tg_op='UPDATE' and new.organization_id is distinct from old.organization_id and exists(select 1 from private.media_placements where course_id=old.id) then raise exception 'Move content by creating authorised copies; media ownership cannot be reassigned.' using errcode='23514'; end if;
 elsif tg_table_name='lessons' then
 new.cover_image:=private.media_normalize(new.cover_image);
 new.published_snapshot:=private.media_normalize(new.published_snapshot);
 if tg_op='UPDATE' and new.course_id<>old.course_id and exists(select 1 from private.media_placements where lesson_id=old.id) then raise exception 'Move content by creating authorised copies.' using errcode='23514'; end if;
 elsif tg_table_name='lesson_pages' then new.cover_image:=private.media_normalize(new.cover_image);
 else new.payload:=private.media_normalize(new.payload);
 end if;
 return new;
end $$;
create function private.media_content_after() returns trigger
language plpgsql security definer set search_path=public,private as $$
declare key text; c text; l text; val jsonb;
begin
 key:=(case tg_table_name when 'courses' then 'course:' when 'lessons' then 'lesson:' when 'lesson_pages' then 'page:' else 'block:' end)||case when tg_op='DELETE' then old.id::text else new.id::text end;
 if tg_op='DELETE' then
 update private.media_placements set in_draft=false where container_key=key;
 delete from private.media_placements where container_key=key and not in_publication;
 return old;
 end if;
 if tg_table_name='courses' then c:=new.id; val:=new.thumbnail;
 elsif tg_table_name='lessons' then c:=new.course_id; l:=new.id; val:=new.cover_image;
 elsif tg_table_name='lesson_pages' then l:=new.lesson_id; select course_id into c from public.lessons where id=l; val:=new.cover_image;
 else select p.lesson_id,ls.course_id into l,c from public.lesson_pages p join public.lessons ls on ls.id=p.lesson_id where p.id=new.page_id; val:=new.payload;
 end if;
 perform private.media_sync(key,c,l,val);
 if tg_table_name='lessons' then
 if tg_op='INSERT' then
 if new.published_snapshot is not null then perform private.media_sync_publication(new.id,new.published_snapshot); end if;
 elsif new.published_snapshot is distinct from old.published_snapshot then perform private.media_sync_publication(new.id,new.published_snapshot);
 end if;
 end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['courses','lessons','lesson_pages','lesson_content_blocks'] loop
 execute format('create trigger media_content_before before insert or update on public.%I for each row execute function private.media_content_before()',t);
 execute format('create trigger media_content_after after insert or update or delete on public.%I for each row execute function private.media_content_after()',t);
 end loop;
end $$;
-- A server-owned transaction marker distinguishes trusted revert from clients
-- replaying a deleted published block ID. No session setting can forge it.
alter function public.admin_revert_lesson_to_published(text) rename to media_revert_lesson_base;
alter function public.media_revert_lesson_base(text) set schema private;
revoke all on function private.media_revert_lesson_base(text) from public,anon,authenticated,service_role;
create function public.admin_revert_lesson_to_published(p_lesson_id text) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare result jsonb;
begin
 if not public.current_user_can_edit_course((select course_id from public.lessons where id=p_lesson_id)) then raise exception 'Lesson content editor access required.'; end if;
 insert into private.media_restore_context values(txid_current(),p_lesson_id);
 result:=private.media_revert_lesson_base(p_lesson_id);
 delete from private.media_restore_context where transaction_id=txid_current() and lesson_id=p_lesson_id;
 return result;
end $$;
revoke all on function public.admin_revert_lesson_to_published(text) from public,anon,authenticated,service_role;
grant execute on function public.admin_revert_lesson_to_published(text) to authenticated,service_role;

create function public.media_delivery(p_version_id uuid,p_organization_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,private as $$
declare v private.media_versions; allowed boolean;
begin
 select * into v from private.media_versions where id=p_version_id;
 if v.id is null or v.revoked_at is not null then return null; end if;
 allowed:=private.media_can_edit(p_organization_id) and (private.media_permitted(v.id,p_organization_id) or exists(select 1 from private.media_assets a where a.id=v.asset_id and a.organization_id is not distinct from p_organization_id and private.media_can_manage(p_organization_id)));
 if not allowed and p_organization_id is null and auth.uid() is not null then
 select exists(select 1 from private.media_assets a where a.id=v.asset_id and a.organization_id is not null and private.media_can_edit(a.organization_id))
 or exists(select 1 from public.organization_memberships m where m.user_id=auth.uid() and m.status='active' and private.media_can_edit(m.organization_id) and private.media_permitted(v.id,m.organization_id)) into allowed;
 end if;
 if not allowed then
 select exists(select 1 from private.media_placements p join public.courses c on c.id=p.course_id where p.version_id=v.id and (
 (auth.uid() is not null and public.current_user_can_edit_course(p.course_id)) or
 (p.container_key like 'course:%' and c.status='published' and public.current_user_can_read_course(c.id)) or
 (p.in_publication and public.current_user_can_read_published_lesson(p.lesson_id)))) into allowed;
 end if;
 if not allowed then return null; end if;
 return jsonb_build_object('bucket',v.bucket,'storagePath',v.storage_path,'mimeType',v.mime_type);
end $$;
revoke all on function public.media_delivery(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.media_delivery(uuid,uuid) to anon,authenticated;
-- Notification enqueue is independent of the durable review flags, retryable and
-- deduplicated through the existing notification primitive.
create function public.admin_dispatch_media_notifications() returns integer
language plpgsql security definer set search_path=public,private as $$
declare v record; u record; n integer:=0;
begin
 for v in select o.version_id from private.media_notification_outbox o join private.media_versions mv on mv.id=o.version_id join private.media_assets a on a.id=mv.asset_id
 where o.delivered_at is null and private.media_can_manage(a.organization_id) for update of o skip locked loop
 for u in select distinct m.user_id from private.media_review_flags f join public.courses c on c.id=f.course_id
 join public.organization_memberships m on m.organization_id=c.organization_id and m.status='active' and m.role in ('organisation_owner','organisation_admin') where f.version_id=v.version_id
 union select m.user_id from public.platform_catalog_memberships m where m.status='active' and m.role in ('organisation_owner','organisation_admin') and exists(select 1 from private.media_review_flags f join public.courses c on c.id=f.course_id where f.version_id=v.version_id and c.organization_id is null)
 loop
 perform private.queue_user_notification(u.user_id,'system','media_revoked','Media needs replacement','A media asset used in your content is unavailable. Review affected courses.','/admin/media','Review media',jsonb_build_object('versionId',v.version_id),'media-revoked:'||v.version_id||':'||u.user_id);
 end loop;
 update private.media_notification_outbox set delivered_at=now() where version_id=v.version_id; n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.admin_dispatch_media_notifications() from public,anon,authenticated,service_role;
grant execute on function public.admin_dispatch_media_notifications() to authenticated;

do $$ declare r record; begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'media_%' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature); end loop;
end $$;
notify pgrst,'reload schema';
commit;
