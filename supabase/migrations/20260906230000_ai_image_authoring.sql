begin;
alter table private.ai_authoring_results drop constraint ai_authoring_results_kind_check;
alter table private.ai_authoring_results add constraint ai_authoring_results_kind_check check(kind in ('page','quiz','lesson_plan','lesson_draft','course_outline','course_draft','image'));
alter table private.media_versions add column authoring_result_id uuid references private.ai_authoring_results(id);
create unique index media_image_result_version on private.media_versions(authoring_result_id) where authoring_result_id is not null;
create table private.ai_course_image_styles(course_id text primary key references public.courses(id) on delete cascade, style jsonb not null);
alter table private.ai_course_image_styles enable row level security;
revoke all on private.ai_course_image_styles from public,anon,authenticated,service_role;

create function private.validate_ai_image_style(s jsonb) returns jsonb language plpgsql set search_path=public as $$
begin
 if jsonb_typeof(s) is distinct from 'object' or coalesce(s->>'preset','') not in ('photography','realistic','flat','diagram','custom')
 or jsonb_typeof(s->'palette') is distinct from 'string' or length(s->>'palette')>200
 or jsonb_typeof(s->'direction') is distinct from 'string' or length(s->>'direction')>1000
 or (s->>'preset'='custom' and trim(s->>'direction')='') then raise exception 'Choose an image style and describe any custom direction.' using errcode='22023'; end if;
 return jsonb_build_object('preset',s->>'preset','palette',trim(s->>'palette'),'direction',trim(s->>'direction'));
end $$;

-- Target identity is resolved from actual saved rows, never a caller-supplied owner.
create function private.ai_image_target(p_kind text,p_id text) returns jsonb language plpgsql stable security definer set search_path=public,private as $$
declare cid text; lid text; payload jsonb; title text; rev bigint; ratio text;
begin
 if p_kind='block' then
 select l.course_id,l.id,b.payload,p.title,l.draft_revision into cid,lid,payload,title,rev from lesson_content_blocks b join lesson_pages p on p.id=b.page_id join lessons l on l.id=p.lesson_id where b.id::text=p_id and b.block_type='image' and coalesce(b.payload->>'mediaKind','')<>'gif';
 elsif p_kind='page_cover' then
 select l.course_id,l.id,p.cover_image,p.title,l.draft_revision into cid,lid,payload,title,rev from lesson_pages p join lessons l on l.id=p.lesson_id where p.id=p_id;
 elsif p_kind='lesson_thumbnail' then
 select course_id,id,thumbnail,lessons.title,draft_revision into cid,lid,payload,title,rev from lessons where id=p_id;
 elsif p_kind in ('course_thumbnail','course_cover') then
 select id,thumbnail,courses.title into cid,payload,title from courses where id=p_id;
 else raise exception 'Choose a supported image destination.' using errcode='22023'; end if;
 if cid is null or not public.current_user_can_edit_course(cid) then raise exception 'Image destination unavailable.' using errcode='42501'; end if;
 ratio:=case when p_kind='block' then coalesce(payload->'mediaIntent'->>'aspectRatio','1:1') else '16:9' end;
 return jsonb_build_object('courseId',cid,'lessonId',lid,'revision',coalesce(rev,0),'title',title,'aspectRatio',ratio,
 'brief',coalesce(payload->>'mediaBrief',payload->'mediaIntent'->>'purpose','Create an image that supports '||title),
 'style',coalesce(payload->'mediaStyle','"inherit"'),'courseStyle',(select style from private.ai_course_image_styles where course_id=cid));
end $$;
create function public.admin_ai_image_setup(p_target text,p_target_id text) returns jsonb language sql stable security definer set search_path=public,private as $$ select private.ai_image_target(p_target,p_target_id) $$;
create function public.admin_save_ai_image_style(p_course text,p_style jsonb) returns void language plpgsql security definer set search_path=public,private as $$
begin
 if not public.current_user_can_edit_course(p_course) then raise exception 'Course editing access required.' using errcode='42501'; end if;
 if p_style is null then delete from private.ai_course_image_styles where course_id=p_course;
 else insert into private.ai_course_image_styles values(p_course,private.validate_ai_image_style(p_style)) on conflict(course_id) do update set style=excluded.style; end if;
end $$;
create function private.check_ai_image_storage(p_org uuid) returns void language plpgsql security definer set search_path=public,private as $$
begin
 if p_org is not null then
 perform 1 from organizations where id=p_org for update;
 if private.organization_learning_storage_bytes_unchecked(p_org)+10485760>private.organization_entitlement_integer_unchecked(p_org,'max_storage_bytes') then
 raise exception 'Free at least 10 MB of storage before generating an image.' using errcode='22023'; end if;
 end if;
end $$;
create function public.admin_quote_ai_image(p_target text,p_target_id text,p_revision bigint,p_brief text,p_style jsonb,p_alt text,p_caption text default '',p_parent uuid default null)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare ctx jsonb; r private.ai_authoring_results; org uuid; fingerprint text; style jsonb;
begin
 ctx:=private.ai_image_target(p_target,p_target_id);
 fingerprint:=private.lock_ai_authoring_source(ctx->>'courseId',ctx->>'lessonId');
 ctx:=private.ai_image_target(p_target,p_target_id);
 if (ctx->>'revision')::bigint is distinct from p_revision then raise exception 'Your draft changed. Save it and check the cost again.' using errcode='PT409'; end if;
 if p_brief is null or length(trim(p_brief)) not between 1 and 6000 or p_alt is null or length(trim(p_alt)) not between 1 and 240 or p_caption is null or length(p_caption)>500 then raise exception 'Add a brief and alt text within the text limits.' using errcode='22023'; end if;
 style:=private.validate_ai_image_style(case when p_style='"inherit"'::jsonb then ctx->'courseStyle' else p_style end);
 select organization_id into org from courses where id=ctx->>'courseId';
 perform private.check_ai_image_storage(org);
 if p_parent is not null and not exists(select 1 from private.ai_authoring_results p where p.id=p_parent and p.kind='image' and p.organization_id is not distinct from org and private.ai_authoring_can_access(p) and p.deleted_at is null) then raise exception 'Earlier image unavailable.' using errcode='42501'; end if;
 insert into private.ai_authoring_results(organization_id,course_id,lesson_id,created_by,title,source_revision,source_fingerprint,context,focus,page_type,insertion_position,kind,estimated_units,parent_id)
 values(org,ctx->>'courseId',ctx->>'lessonId',auth.uid(),'Image for '||(ctx->>'title'),p_revision,fingerprint,
 jsonb_build_object('target',p_target,'targetId',p_target_id,'brief',trim(p_brief),'style',style,'aspectRatio',ctx->>'aspectRatio','altText',trim(p_alt),'caption',trim(p_caption)),trim(p_brief),'concept',1,'image',75,p_parent) returning * into r;
 return private.ai_authoring_projection(r,true);
end $$;

alter function private.ai_authoring_projection(private.ai_authoring_results,boolean) rename to ai_authoring_projection_v3;
create function private.ai_authoring_projection(r private.ai_authoring_results,p_detail boolean) returns jsonb language sql stable set search_path=public,private as $$
 select private.ai_authoring_projection_v3(r,p_detail)||case when r.kind='image' then jsonb_build_object('image',case when p_detail then r.context else null end,
 'targetAvailable',exists(select 1 from courses c where c.id=r.course_id) and (r.lesson_id is null or exists(select 1 from lessons l where l.id=r.lesson_id and l.course_id=r.course_id))) else '{}'::jsonb end
$$;
alter function public.admin_start_ai_page(uuid) rename to ai_authoring_start_v3;
alter function public.ai_authoring_start_v3(uuid) set schema private;
revoke all on function private.ai_authoring_start_v3(uuid) from public,anon,authenticated,service_role;
create function public.admin_start_ai_page(p_id uuid) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; j uuid; result jsonb; prompt jsonb;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or not private.ai_authoring_can_access(r) or r.created_by<>auth.uid() then raise exception 'Generation access required.' using errcode='42501'; end if;
 if r.kind<>'image' then return private.ai_authoring_start_v3(p_id); end if;
 if r.stage<>'quote' then return private.ai_authoring_projection(r,true); end if;
 if r.deleted_at is not null or r.expires_at<now() then raise exception 'This estimate expired. Check the cost again.' using errcode='PT409'; end if;
 if private.lock_ai_authoring_source(r.course_id,r.lesson_id) is distinct from r.source_fingerprint then raise exception 'Your draft changed. Check the cost again.' using errcode='PT409'; end if;
 perform private.ai_image_target(r.context->>'target',r.context->>'targetId');
 perform private.check_ai_image_storage(r.organization_id);
 prompt:=jsonb_build_object('mode','authoring_image_v4','operationId',r.id);
 if r.organization_id is not null then
 result:=public.create_organization_ai_generation_job(p_organization_id=>r.organization_id,p_actor_user_id=>auth.uid(),p_job_type=>'course_media',p_prompt=>prompt,p_entity_id=>r.course_id,p_idempotency_key=>'authoring:'||r.id,p_operation_type=>'ai_single_media_asset',p_estimated_units=>75,p_course_id=>r.course_id,p_lesson_id=>r.lesson_id);
 j:=(result->>'jobId')::uuid;
 else insert into ai_generation_jobs(entity_type,entity_id,course_id,lesson_id,job_type,status,prompt,created_by,idempotency_key) values('course',r.course_id,r.course_id,r.lesson_id,'course_media','queued',prompt,auth.uid(),'authoring:'||r.id) returning id into j; end if;
 update private.ai_authoring_results set job_id=j,stage='starting',updated_at=now(),credit=jsonb_build_object('status',case when organization_id is null then 'unmetered' else 'reserved' end,'reserved',75) where id=r.id returning * into r;
 return private.ai_authoring_projection(r,true);
end $$;
create function public.service_ai_image_checkpoint(p_job uuid,p_worker text,p_token uuid,p_version integer,p_action text,p_file jsonb default null)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare j public.ai_generation_jobs; r private.ai_authoring_results; u public.organization_ai_usage_records; registered jsonb;
begin
 select * into j from ai_generation_jobs where id=p_job for update;
 perform private.assert_ai_generation_job_lease(j,p_worker,p_token,p_version);
 select * into r from private.ai_authoring_results where job_id=j.id for update;
 if r.id is null or r.kind<>'image' then raise exception 'Image operation unavailable.'; end if;
 if p_action='begin' then
 if r.provider_started_at is not null then raise exception 'An earlier provider outcome is uncertain; do not replay it.'; end if;
 if r.stop_requested or not private.organization_ai_job_can_run(j) or not private.ai_authoring_actor_can_edit(r.created_by,r.course_id) then raise exception 'Generation access changed before provider work.' using errcode='22023'; end if;
 perform private.check_ai_image_storage(r.organization_id);
 update private.ai_authoring_results set stage='writing',provider_started_at=now(),updated_at=now() where id=r.id;
 return r.context||jsonb_build_object('id',r.id);
 elsif p_action='ready' then
 if r.provider_started_at is null or p_file->>'path' is distinct from 'registry/authoring-'||r.id||'.png'
 or coalesce((p_file->>'size')::bigint,0) not between 1 and 10485760
 or not exists(select 1 from storage.objects where bucket_id='learning-media-private' and name=p_file->>'path') then raise exception 'Image file is not durably stored.'; end if;
 registered:=public.service_register_media(r.organization_id,p_file->>'path','image/png',(p_file->>'size')::bigint,r.title,r.context->>'altText','Generated within Project VE; platform stock approval is a separate rights review.');
 update private.media_versions set authoring_result_id=r.id where id=(registered->>'id')::uuid;
 perform public.complete_ai_generation_job(j.id,p_worker,p_token,p_version,r.course_id,'completed',jsonb_build_object('operationId',r.id,'actualUnits',75),null);
 select * into u from organization_ai_usage_records where id=j.organization_ai_usage_record_id;
 update private.ai_authoring_results set stage='ready',candidate=jsonb_build_object('title',r.title,'versionId',registered->>'id','url',registered->>'url','altText',r.context->>'altText','caption',r.context->>'caption'),updated_at=now(),failure=null,
 credit=jsonb_build_object('status',coalesce(u.status,'unmetered'),'used',u.final_charged_units,'released',greatest(0,u.reserved_units-u.final_charged_units)) where id=r.id;
 elsif p_action='failed' then
 perform public.fail_ai_generation_job(j.id,p_worker,p_token,p_version,'Image generation did not finish.',case when r.provider_started_at is null then 'validation_error' else 'worker_error' end,'{}',false);
 select * into u from organization_ai_usage_records where id=j.organization_ai_usage_record_id;
 update private.ai_authoring_results set stage='failed',failure=case when provider_started_at is null then 'Image generation could not start. Check access and storage, then try again.' else 'The image could not be confirmed as retained. Earlier images are still available. This request will not be automatically repeated.' end,updated_at=now(),
 credit=jsonb_build_object('status',coalesce(u.status,'unmetered'),'used',u.final_charged_units,'released',greatest(0,u.reserved_units-u.final_charged_units)) where id=r.id;
 else raise exception 'Unknown image checkpoint.'; end if;
 return jsonb_build_object('done',true);
end $$;

create function public.admin_prepare_ai_image_apply(p_id uuid) returns void language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results;
begin
 select * into r from private.ai_authoring_results where id=p_id for update;
 if r.id is null or r.kind<>'image' or not private.ai_authoring_can_access(r) then raise exception 'Image unavailable.' using errcode='42501'; end if;
 if r.receipt is not null then return; end if;
 if r.deleted_at is not null or r.stage<>'ready' or r.candidate is null then raise exception 'Image is not ready.' using errcode='PT409'; end if;
 update private.ai_authoring_results set application_started_at=coalesce(application_started_at,now()),application_error=null,updated_at=now() where id=p_id;
end $$;
create function public.admin_apply_ai_image(p_id uuid) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare r private.ai_authoring_results; v private.media_versions; payload jsonb; target text; tid text; rev bigint; page_id text;
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
 payload:=jsonb_build_object('src','/api/media/'||v.id,'alt',r.context->>'altText','caption',r.context->>'caption');
 if target='block' then
 update lesson_content_blocks set payload=lesson_content_blocks.payload||payload where id::text=tid returning lesson_content_blocks.page_id into page_id;
 elsif target='page_cover' then
 update lesson_pages set cover_image=coalesce(cover_image,'{}')||payload where id=tid; page_id:=tid;
 elsif target='lesson_thumbnail' then update lessons set thumbnail=coalesce(thumbnail,'{}')||payload where id=tid;
 elsif target='course_thumbnail' then update courses set thumbnail=coalesce(thumbnail,'{}')||payload where id=tid;
 elsif target='course_cover' then
 -- Existing course-cover placement adapter; preserve existing requirements and seed identity.
 update learning_media_assets set url='/api/media/'||v.id,alt_text=v.alt_text,source='library',review_status='draft',generation_status='completed' where course_id=r.course_id and lesson_id is null and metadata->>'targetKind'='course_cover';
 if not found then insert into learning_media_assets(course_id,asset_type,placement,source,url,alt_text,metadata,review_status,generation_status,sort_order) values(r.course_id,'cover','course_cover','library','/api/media/'||v.id,v.alt_text,jsonb_build_object('targetKind','course_cover','libraryVersionId',v.id),'draft','completed',0); end if;
 end if;
 update lessons set ai_text_status=case when ai_generated then 'draft' else ai_text_status end,text_approved_at=null,text_approved_by=null where id=r.lesson_id;
 update courses set ai_text_status=case when ai_generated then 'draft' else ai_text_status end,text_approved_at=null,text_approved_by=null,media_approved_at=null,media_approved_by=null where id=r.course_id;
 select draft_revision into rev from lessons where id=r.lesson_id;
 update private.ai_authoring_results set receipt=jsonb_build_object('status','saved','courseId',r.course_id,'lessonId',r.lesson_id,'pageId',page_id,'draftRevision',rev,'versionId',v.id,'savedAt',now(),
 'page',(select to_jsonb(p) from lesson_pages p where p.id=page_id),'blocks',(select coalesce(jsonb_agg(to_jsonb(b) order by sort_order),'[]') from lesson_content_blocks b where b.page_id=page_id)),application_error=null,updated_at=now() where id=r.id returning * into r;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'ai_image_applied','course',r.course_id,jsonb_build_object('resultId',r.id,'versionId',v.id,'target',target,'targetId',tid));
 return r.receipt;
 exception when sqlstate 'PT409' or sqlstate '42501' or check_violation then
 update private.ai_authoring_results set application_error=sqlerrm,updated_at=now() where id=p_id;
 return jsonb_build_object('status','not_saved','error',sqlerrm);
 end;
end $$;

-- Hiding a result does not delete a paid file; explicit library deletion retains
-- existing reference protections and never alters the generation ledger.
revoke all on function private.validate_ai_image_style(jsonb),private.ai_image_target(text,text),private.check_ai_image_storage(uuid),private.ai_authoring_projection(private.ai_authoring_results,boolean) from public,anon,authenticated,service_role;
do $$ declare f record; worker boolean; begin
 for f in select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('admin_ai_image_setup','admin_save_ai_image_style','admin_quote_ai_image','admin_start_ai_page','service_ai_image_checkpoint','admin_prepare_ai_image_apply','admin_apply_ai_image') loop
 worker:=f.proname like 'service_%';
 execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',f.proname,f.args);
 execute format('grant execute on function public.%I(%s) to %s',f.proname,f.args,case when worker then 'service_role' else 'authenticated' end);
 insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles)
 values('public',f.proname,f.args,case when worker then 'SERVICE_ROLE_ONLY' else 'ADMIN_AUTHENTICATED' end,'Contextual image authoring',case when worker then 'Fenced lease; stored file; single settlement.' else 'Current target/workspace editor; snapshot and revision checks.' end,case when worker then array['service_role'] else array['authenticated'] end)
 on conflict(function_schema,function_name,identity_arguments) do update set authorization_rule=excluded.authorization_rule;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
