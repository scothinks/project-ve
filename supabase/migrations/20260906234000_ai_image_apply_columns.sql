begin;
create or replace function public.admin_apply_ai_image(p_id uuid) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; v private.media_versions; image_payload jsonb; target text; tid text; rev bigint; image_page text;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or r.kind<>'image' or not private.ai_authoring_can_access(r) then raise exception 'Image unavailable.' using errcode='42501'; end if;
 if r.receipt is not null then return r.receipt; end if;
 if r.deleted_at is not null or r.stage<>'ready' or r.candidate is null or r.application_started_at is null then raise exception 'Image is not ready to use.' using errcode='PT409'; end if;
 begin
 if private.lock_ai_authoring_source(r.course_id,r.lesson_id) is distinct from r.source_fingerprint then raise exception 'Your draft changed. Keep your edits and choose the retained image from the library.' using errcode='PT409'; end if;
 target:=r.context->>'target'; tid:=r.context->>'targetId';
 perform private.ai_image_target(target,tid);
 select * into v from private.media_versions where id=(r.candidate->>'versionId')::uuid for update;
 if v.id is null or not private.media_permitted(v.id,r.organization_id) then raise exception 'Image access changed. Choose a permitted image.' using errcode='PT409'; end if;
 image_payload:=jsonb_build_object('src','/api/media/'||v.id,'alt',r.context->>'altText','caption',r.context->>'caption');
 if target='block' then
 update lesson_content_blocks set payload=lesson_content_blocks.payload||image_payload where id::text=tid returning lesson_content_blocks.page_id into image_page;
 elsif target='page_cover' then
 update lesson_pages set cover_image=coalesce(cover_image,'{}')||image_payload where id=tid; image_page:=tid;
 elsif target='lesson_thumbnail' then update lessons set thumbnail=coalesce(thumbnail,'{}')||image_payload where id=tid;
 elsif target='course_thumbnail' then update courses set thumbnail=coalesce(thumbnail,'{}')||image_payload where id=tid;
 elsif target='course_cover' then
 -- Existing course-cover placement adapter; preserve existing requirements and seed identity.
 update learning_media_assets set url='/api/media/'||v.id,alt_text=v.alt_text,source='library',review_status='draft',generation_status='completed' where course_id=r.course_id and lesson_id is null and metadata->>'targetKind'='course_cover';
 if not found then insert into learning_media_assets(course_id,asset_type,placement,source,url,alt_text,metadata,review_status,generation_status,sort_order) values(r.course_id,'cover','course_cover','library','/api/media/'||v.id,v.alt_text,jsonb_build_object('targetKind','course_cover','libraryVersionId',v.id),'draft','completed',0); end if;
 end if;
 update lessons set ai_text_status=case when ai_generated then 'draft' else ai_text_status end,text_approved_at=null,text_approved_by=null where id=r.lesson_id;
 update courses set ai_text_status=case when ai_generated then 'draft' else ai_text_status end,text_approved_at=null,text_approved_by=null,media_approved_at=null,media_approved_by=null where id=r.course_id;
 select draft_revision into rev from lessons where id=r.lesson_id;
 update private.ai_authoring_results set receipt=jsonb_build_object('status','saved','courseId',r.course_id,'lessonId',r.lesson_id,'pageId',image_page,'draftRevision',rev,'versionId',v.id,'savedAt',now(),
 'page',(select to_jsonb(p) from lesson_pages p where p.id=image_page),'blocks',(select coalesce(jsonb_agg(to_jsonb(b) order by sort_order),'[]') from lesson_content_blocks b where b.page_id=image_page)),application_error=null,updated_at=now() where id=r.id returning * into r;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'ai_image_applied','course',r.course_id,jsonb_build_object('resultId',r.id,'versionId',v.id,'target',target,'targetId',tid));
 return r.receipt;
 exception when sqlstate 'PT409' or sqlstate '42501' or check_violation then
 update private.ai_authoring_results set application_error=sqlerrm,updated_at=now() where id=p_id;
 return jsonb_build_object('status','not_saved','error',sqlerrm);
 end;
end $$;

commit;
