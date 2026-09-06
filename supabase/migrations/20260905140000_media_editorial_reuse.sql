begin;
create function public.admin_apply_registered_media(p_media_id uuid,p_version_id uuid,p_course_id text)
returns void language plpgsql security definer set search_path=public,private as $$
declare org uuid; v private.media_versions;
begin
 if auth.uid() is null or not public.current_user_can_edit_course(p_course_id) then raise exception 'Course editor access required.' using errcode='42501'; end if;
 perform 1 from public.learning_media_assets where id=p_media_id and course_id=p_course_id for update;
 if not found then raise exception 'Media placement does not belong to this course.' using errcode='42501'; end if;
 select organization_id into org from public.courses where id=p_course_id;
 select * into v from private.media_versions where id=p_version_id for update;
 if not private.media_permitted(p_version_id,org) then raise exception 'Media is not permitted for new use.' using errcode='42501'; end if;
 update public.learning_media_assets set url='/api/media/'||v.id,storage_path=null,source='library',alt_text=v.alt_text,
 generation_status='completed',generation_error=null,review_status='draft',metadata=metadata||jsonb_build_object('libraryVersionId',v.id)
 where id=p_media_id;
end $$;
revoke all on function public.admin_apply_registered_media(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_apply_registered_media(uuid,uuid,text) to authenticated;
insert into private.rpc_security_classifications values('public','admin_apply_registered_media','p_media_id uuid, p_version_id uuid, p_course_id text','ADMIN_AUTHENTICATED','Editorial reuse of permitted library versions.','Requires destination course edit permission and current source version permission.',array['authenticated'],now());
notify pgrst,'reload schema';
commit;
