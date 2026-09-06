begin;
-- Resolve existing course artwork requirements through permitted library placement.
-- Draft generation creates no media seeds, provider jobs or reservations.
create function public.admin_set_ai_course_artwork(p_course text,p_version uuid,p_target text) returns void
language plpgsql security definer set search_path=public,private as $$
declare c public.courses; v private.media_versions; asset_id uuid;
begin
 if not public.current_user_can_edit_course(p_course) then raise exception 'Course editing access required.' using errcode='42501'; end if;
 select * into c from courses where id=p_course for update;
 if c.ai_generation_notes->>'authoringVersion' is distinct from '3' or p_target is null or p_target not in ('course_thumbnail','course_cover') then raise exception 'Choose course artwork.' using errcode='22023'; end if;
 select * into v from private.media_versions where id=p_version for update;
 if v.id is null or not private.media_permitted(p_version,c.organization_id) then raise exception 'Media is not permitted for this course.' using errcode='42501'; end if;
 if v.mime_type not like 'image/%' or coalesce(trim(v.alt_text),'')='' then raise exception 'Choose an image with alt text.' using errcode='22023'; end if;
 select id into asset_id from learning_media_assets where course_id=c.id and lesson_id is null and metadata->>'targetKind'=p_target order by id limit 1 for update;
 if asset_id is null then
 insert into learning_media_assets(course_id,asset_type,placement,source,url,alt_text,metadata,review_status,generation_status,sort_order)
 values(c.id,case when p_target='course_cover' then 'cover' else 'thumbnail' end,p_target,'library','/api/media/'||v.id,v.alt_text,jsonb_build_object('targetKind',p_target,'libraryVersionId',v.id),'draft','completed',0);
 else
 update learning_media_assets set url='/api/media/'||v.id,alt_text=v.alt_text,source='library',metadata=metadata||jsonb_build_object('libraryVersionId',v.id),review_status='draft',generation_status='completed' where id=asset_id;
 end if;
 update courses set thumbnail=case when p_target='course_thumbnail' then jsonb_build_object('src','/api/media/'||v.id,'alt',v.alt_text) else thumbnail end,
 ai_text_status='draft',ai_media_status='not_started',ai_publish_status='not_ready',text_approved_at=null,text_approved_by=null,media_approved_at=null,media_approved_by=null where id=c.id;
end $$;
revoke all on function public.admin_set_ai_course_artwork(text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_set_ai_course_artwork(text,uuid,text) to authenticated;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles) values
('public','admin_set_ai_course_artwork','p_course text, p_version uuid, p_target text','ADMIN_AUTHENTICATED','Course editors','Current course editor; registry permission and image validation; explicit placement resets review.',array['authenticated']);
notify pgrst,'reload schema';
commit;
