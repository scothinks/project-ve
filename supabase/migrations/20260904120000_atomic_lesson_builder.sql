begin;
alter table public.lessons add column draft_revision bigint not null default 0;

-- Every editorial write invalidates stale editor revisions, including legacy
-- metadata/AI paths. Clients cannot choose or reset this server-owned revision.
create function private.advance_lesson_revision() returns trigger
language plpgsql set search_path = public as $$
begin new.draft_revision := old.draft_revision + 1; return new; end $$;
revoke all on function private.advance_lesson_revision() from public, anon, authenticated, service_role;
create trigger lessons_advance_revision before update on public.lessons
for each row execute function private.advance_lesson_revision();

create function private.advance_content_lesson_revision() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_lesson_id text; v_other_lesson_id text;
begin
  if tg_table_name = 'lesson_pages' then
    if tg_op = 'DELETE' then v_lesson_id := old.lesson_id;
    else v_lesson_id := new.lesson_id; end if;
    if tg_op = 'UPDATE' and old.lesson_id <> new.lesson_id then
      raise exception 'Lesson pages cannot be moved between lessons.';
    end if;
  else
    if tg_op = 'DELETE' then
      select lesson_id into v_lesson_id from public.lesson_pages where id = old.page_id;
    else
      select lesson_id into v_lesson_id from public.lesson_pages where id = new.page_id;
    end if;
    if tg_op = 'UPDATE' and old.page_id <> new.page_id then
      select lesson_id into v_other_lesson_id from public.lesson_pages where id = old.page_id;
      if v_other_lesson_id is distinct from v_lesson_id then
        raise exception 'Lesson blocks cannot be moved between lessons.';
      end if;
    end if;
  end if;
  -- The parent row lock serializes each atomic save with publish/revert.
  update public.lessons set draft_revision = draft_revision + 1 where id = v_lesson_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.advance_content_lesson_revision() from public, anon, authenticated, service_role;
create trigger lesson_pages_advance_revision before insert or update or delete on public.lesson_pages
for each row execute function private.advance_content_lesson_revision();
create trigger lesson_blocks_advance_revision before insert or update or delete on public.lesson_content_blocks
for each row execute function private.advance_content_lesson_revision();

create function private.lock_lesson_revision(p_lesson_id text, p_expected_revision bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_course_id text; v_revision bigint;
begin
  select course_id into v_course_id from public.lessons where id = p_lesson_id;
  if auth.uid() is null or v_course_id is null or not public.current_user_can_edit_course(v_course_id) then
    raise exception 'Lesson content editor access required.' using errcode = '42501';
  end if;
  select draft_revision into v_revision from public.lessons
  where id = p_lesson_id and course_id = v_course_id for update;
  if not found or p_expected_revision is null or v_revision <> p_expected_revision then
    raise exception 'This lesson changed in another session. Reload before saving, publishing or reverting.' using errcode = 'PT409';
  end if;
end $$;
revoke all on function private.lock_lesson_revision(text,bigint) from public, anon, authenticated, service_role;

create function public.admin_save_lesson_builder(
 p_lesson_id text, p_expected_revision bigint, p_pages jsonb, p_blocks jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
 v_pages jsonb; v_blocks jsonb; v_base bigint; v_revision bigint;
begin
 perform private.lock_lesson_revision(p_lesson_id, p_expected_revision);
 if jsonb_typeof(p_pages) is distinct from 'array' or jsonb_typeof(p_blocks) is distinct from 'array'
   or jsonb_array_length(p_pages) < 1 then
   raise exception 'A lesson needs at least one page and valid content arrays.' using errcode = '22023';
 end if;
 if jsonb_array_length(p_pages) > 500 or jsonb_array_length(p_blocks) > 5000 then
   raise exception 'The lesson exceeds the supported editor size.' using errcode = '22023';
 end if;
 if exists(select 1 from jsonb_array_elements(p_pages) p where coalesce(trim(p->>'id'),'') = '' or coalesce(trim(p->>'title'),'') = '')
   or exists(select 1 from jsonb_array_elements(p_blocks) b where coalesce(trim(b->>'id'),'') = '') then
   raise exception 'Page IDs, page titles and block IDs are required.' using errcode = '22023';
 end if;
 if (select count(distinct p->>'id') from jsonb_array_elements(p_pages) p) <> jsonb_array_length(p_pages)
   or (select count(distinct b->>'id') from jsonb_array_elements(p_blocks) b) <> jsonb_array_length(p_blocks) then
   raise exception 'Duplicate editor IDs are not allowed.' using errcode = '22023';
 end if;
 select jsonb_agg(p || jsonb_build_object('clientId', p->>'id',
   'id', case when p->>'id' like 'draft-%' then 'page-' || replace(gen_random_uuid()::text,'-','') else p->>'id' end,
   'page_number', n) order by n) into v_pages
 from (select p, row_number() over(order by (p->>'page_number')::integer, p->>'id') n from jsonb_array_elements(p_pages) p) ordered;
 if exists(select 1 from jsonb_array_elements(v_pages) p join private.lesson_page_identities i on i.id = p->>'id' where i.lesson_id <> p_lesson_id) then
   raise exception 'Lesson page identity belongs to another lesson.' using errcode = '42501';
 end if;
 if exists(select 1 from jsonb_array_elements(p_blocks) b where not exists(select 1 from jsonb_array_elements(v_pages) p where p->>'clientId' = b->>'page_id')) then
   raise exception 'Every block must belong to a submitted lesson page.' using errcode = '22023';
 end if;
 select coalesce(jsonb_agg(b || jsonb_build_object('clientId', b->>'id',
   'id', case when b->>'id' like 'draft-%' then gen_random_uuid()::text else b->>'id' end,
   'page_id', p->>'id')), '[]') into v_blocks
 from jsonb_array_elements(p_blocks) b join jsonb_array_elements(v_pages) p on p->>'clientId' = b->>'page_id';
 if exists(select 1 from jsonb_array_elements(v_blocks) s join public.lesson_content_blocks b on b.id = (s->>'id')::uuid
   join public.lesson_pages p on p.id = b.page_id where p.lesson_id <> p_lesson_id) then
   raise exception 'Lesson block belongs to another lesson.' using errcode = '42501';
 end if;

 -- Delete omitted draft content. Durable page identities retain learner history.
 delete from public.lesson_content_blocks b using public.lesson_pages p
 where p.id = b.page_id and p.lesson_id = p_lesson_id
   and not exists(select 1 from jsonb_array_elements(v_blocks) s where (s->>'id')::uuid = b.id);
 -- A retained block may move away from an omitted page. Move after page upserts,
 -- then delete omitted pages so their FK cascade cannot erase retained blocks.
 select greatest(coalesce(max(page_number),0), jsonb_array_length(v_pages)) into v_base
 from public.lesson_pages where lesson_id = p_lesson_id;
 if v_base + (select count(*) from public.lesson_pages where lesson_id = p_lesson_id) > 2147483647 then
   raise exception 'Lesson content positions exceed the safe renumbering range.';
 end if;
 with positions as (select id,row_number() over(order by id) n from public.lesson_pages where lesson_id = p_lesson_id)
 update public.lesson_pages p set page_number = (v_base + positions.n)::integer from positions where p.id = positions.id;
 insert into public.lesson_pages(id,lesson_id,page_number,title,subtitle,page_type,cover_image)
 select p->>'id',p_lesson_id,(p->>'page_number')::integer,trim(p->>'title'),nullif(p->>'subtitle',''),
   (p->>'page_type')::public.lesson_page_type,coalesce(p->'cover_image','{}')
 from jsonb_array_elements(v_pages) p
 on conflict(id) do update set page_number=excluded.page_number,title=excluded.title,subtitle=excluded.subtitle,
 page_type=excluded.page_type,cover_image=excluded.cover_image
 where lesson_pages.lesson_id = p_lesson_id;
 if (select count(*) from public.lesson_pages where lesson_id=p_lesson_id and id in (select p->>'id' from jsonb_array_elements(v_pages) p)) <> jsonb_array_length(v_pages) then
   raise exception 'Lesson page ownership changed during save.' using errcode = 'PT409';
 end if;

 select greatest(coalesce(max(b.sort_order),0),
   coalesce((select max((s->>'sort_order')::integer) from jsonb_array_elements(v_blocks) s),0)) into v_base
 from public.lesson_content_blocks b join public.lesson_pages p on p.id=b.page_id where p.lesson_id=p_lesson_id;
 if v_base + (select count(*) from public.lesson_content_blocks b join public.lesson_pages p on p.id=b.page_id where p.lesson_id=p_lesson_id) > 2147483647 then
   raise exception 'Lesson content positions exceed the safe renumbering range.';
 end if;
 with positions as (select b.id,row_number() over(order by b.id) n from public.lesson_content_blocks b
   join public.lesson_pages p on p.id=b.page_id where p.lesson_id=p_lesson_id)
 update public.lesson_content_blocks b set sort_order=(v_base+positions.n)::integer from positions where b.id=positions.id;
 insert into public.lesson_content_blocks(id,page_id,block_type,sort_order,payload)
 select (b->>'id')::uuid,b->>'page_id',(b->>'block_type')::public.lesson_content_block_type,
   (b->>'sort_order')::integer,coalesce(b->'payload','{}') from jsonb_array_elements(v_blocks) b
 on conflict(id) do update set page_id=excluded.page_id,block_type=excluded.block_type,sort_order=excluded.sort_order,payload=excluded.payload
 where lesson_content_blocks.page_id in (select id from public.lesson_pages where lesson_id=p_lesson_id);
 if (select count(*) from public.lesson_content_blocks b join public.lesson_pages p on p.id=b.page_id
     where p.lesson_id=p_lesson_id and b.id in (select (s->>'id')::uuid from jsonb_array_elements(v_blocks) s)) <> jsonb_array_length(v_blocks) then
   raise exception 'Lesson block ownership changed during save.' using errcode = 'PT409';
 end if;
 delete from public.lesson_pages p where lesson_id=p_lesson_id
 and not exists(select 1 from jsonb_array_elements(v_pages) s where s->>'id'=p.id);
 select draft_revision into v_revision from public.lessons where id=p_lesson_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'lesson_draft_saved','lesson',p_lesson_id,jsonb_build_object('draftRevision',v_revision,'pageCount',jsonb_array_length(v_pages)));
 return jsonb_build_object('status','saved','draftRevision',v_revision,'savedAt',now(),
 'pages',(select jsonb_agg(jsonb_build_object('clientId',p->>'clientId','pageId',p->>'id','pageNumber',(p->>'page_number')::integer,'page',p - 'clientId','status','saved')) from jsonb_array_elements(v_pages) p),
 'blocks',(select coalesce(jsonb_agg(jsonb_build_object('clientId',b->>'clientId','blockId',b->>'id','pageId',b->>'page_id','sortOrder',(b->>'sort_order')::integer,'block',b - 'clientId','status','saved')),'[]') from jsonb_array_elements(v_blocks) b));
end $$;
revoke all on function public.admin_save_lesson_builder(text,bigint,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.admin_save_lesson_builder(text,bigint,jsonb,jsonb) to authenticated,service_role;

create function public.admin_publish_lesson_checked(p_lesson_id text,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
 perform private.lock_lesson_revision(p_lesson_id,p_expected_revision);
 v_result := public.admin_publish_lesson(p_lesson_id);
 return v_result || (select jsonb_build_object('draftRevision',draft_revision,'publishedSnapshot',published_snapshot) from public.lessons where id=p_lesson_id);
end $$;
create function public.admin_revert_lesson_checked(p_lesson_id text,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
 perform private.lock_lesson_revision(p_lesson_id,p_expected_revision);
 v_result := public.admin_revert_lesson_to_published(p_lesson_id);
 return v_result || (select jsonb_build_object('draftRevision',draft_revision,'publishedSnapshot',published_snapshot) from public.lessons where id=p_lesson_id);
end $$;
revoke all on function public.admin_publish_lesson_checked(text,bigint),public.admin_revert_lesson_checked(text,bigint) from public,anon,authenticated,service_role;
grant execute on function public.admin_publish_lesson_checked(text,bigint),public.admin_revert_lesson_checked(text,bigint) to authenticated,service_role;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles)
values
('public','admin_save_lesson_builder','p_lesson_id text, p_expected_revision bigint, p_pages jsonb, p_blocks jsonb','ADMIN_AUTHENTICATED','Atomic lesson editor autosave.','Requires trusted course edit access and matching server revision.',array['authenticated','service_role']),
('public','admin_publish_lesson_checked','p_lesson_id text, p_expected_revision bigint','ADMIN_AUTHENTICATED','Lesson editor publish.','Requires trusted course edit access and matching server revision; delegates existing publish guard.',array['authenticated','service_role']),
('public','admin_revert_lesson_checked','p_lesson_id text, p_expected_revision bigint','ADMIN_AUTHENTICATED','Lesson editor revert.','Requires trusted course edit access and matching server revision; delegates existing restore.',array['authenticated','service_role']);
notify pgrst,'reload schema';
commit;
