begin;
create or replace function private.organization_learning_storage_bytes_unchecked(p_organization_id uuid)
returns bigint language sql stable security definer set search_path=public,private as $$
 select (select coalesce(sum(v.byte_size),0) from private.media_versions v join private.media_assets a on a.id=v.asset_id where a.organization_id=p_organization_id)
 + (select coalesce(sum(bytes),0) from (
 select m.storage_path,max(private.learning_media_asset_storage_size(m.metadata)) bytes
 from public.learning_media_assets m left join public.courses c on c.id=m.course_id
 left join public.lessons l on l.id=m.lesson_id left join public.courses lc on lc.id=l.course_id
 where coalesce(c.organization_id,lc.organization_id)=p_organization_id and m.storage_path is not null
 and m.asset_type in ('image','infographic','thumbnail','cover')
 and not exists(select 1 from private.media_versions v where v.storage_path=m.storage_path)
 group by m.storage_path) legacy);
$$;
create or replace function private.enforce_organization_learning_media_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_organization_id uuid;
  v_old_organization_id uuid;
  v_current_storage_bytes bigint;
  v_max_storage_bytes bigint;
  v_new_storage_bytes bigint := 0;
  v_old_storage_bytes bigint := 0;
begin
  v_organization_id := private.learning_media_asset_organization_id(new.course_id, new.lesson_id);

  if v_organization_id is null then
    return new;
  end if;

  if new.asset_type in ('video', 'audio')
     and not private.organization_entitlement_text_array_contains_unchecked(
       v_organization_id,
       'allowed_lesson_block_types',
       new.asset_type
     ) then
    raise exception 'Video and audio lessons are available on paid organisation plans.'
      using errcode = 'check_violation';
  end if;

  if new.storage_path is not null
     and new.asset_type in ('image', 'infographic', 'thumbnail', 'cover') then
    v_new_storage_bytes := private.learning_media_asset_storage_size(new.metadata);
  end if;

  if tg_op = 'UPDATE' then
    v_old_organization_id := private.learning_media_asset_organization_id(old.course_id, old.lesson_id);
    if v_old_organization_id = v_organization_id
       and old.storage_path is not null
       and old.asset_type in ('image', 'infographic', 'thumbnail', 'cover') then
      v_old_storage_bytes := private.learning_media_asset_storage_size(old.metadata);
    end if;
  end if;

  perform 1 from public.organizations where id=v_organization_id for update;
  v_current_storage_bytes := private.organization_learning_storage_bytes_unchecked(v_organization_id);
  v_max_storage_bytes := private.organization_entitlement_integer_unchecked(v_organization_id, 'max_storage_bytes');

  if v_current_storage_bytes - v_old_storage_bytes + v_new_storage_bytes > v_max_storage_bytes then
    if v_max_storage_bytes = 104857600 then
      raise exception 'Starter organisations include 100 MB of image storage.'
        using errcode = 'check_violation';
    end if;

    raise exception 'This upload exceeds the organisation storage allowance.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_organization_learning_media_entitlements() from public,anon,authenticated,service_role;
commit;
