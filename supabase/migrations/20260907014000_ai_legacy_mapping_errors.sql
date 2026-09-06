begin;
create or replace function private.map_legacy_ai_media(p_asset uuid,p_kind text default null,p_target text default null) returns void
language plpgsql security definer set search_path=public,private as $$
declare a public.learning_media_assets; k text; tid text; lid text; existing jsonb; bid text; n integer; block_kind text; intent jsonb; mapping_error text;
begin
 select * into a from learning_media_assets where id=p_asset for update;
 if a.id is null then return; end if;
 if exists(select 1 from private.ai_legacy_media_mappings where asset_id=a.id and status='mapped') then return; end if;
 insert into private.ai_legacy_media_mappings(asset_id,course_id,original,status)
 values(a.id,a.course_id,to_jsonb(a),'needs_resolution') on conflict(asset_id) do nothing;
 -- In-flight legacy workers retain their original destinations and lease behavior.
 if exists(select 1 from ai_generation_jobs j where j.entity_id=a.course_id and j.job_type='media_assets' and j.status in ('queued','running') and coalesce(j.prompt->>'mode','')<>'authoring_image_v4') then
 update private.ai_legacy_media_mappings set status='deferred',reason='An earlier media request is still pending. Finish or cancel it, then retry mapping.',updated_at=now() where asset_id=a.id; return;
 end if;
 k:=coalesce(p_kind,nullif(a.metadata->>'targetKind',''),case when a.asset_type='thumbnail' then case when a.lesson_id is null then 'course_thumbnail' else 'lesson_thumbnail' end when a.asset_type='cover' then case when a.lesson_id is null then 'course_cover' else 'lesson_thumbnail' end end);
 if k='lesson_cover' then k:='lesson_thumbnail'; end if;
 tid:=coalesce(p_target,a.metadata->>'targetBlockId');
 if k in ('page_cover','page_block') then tid:=coalesce(p_target,a.metadata->>'targetPageId'); end if;
 if k in ('course_thumbnail','course_cover') then tid:=a.course_id; end if;
 if k='lesson_thumbnail' then tid:=coalesce(p_target,a.lesson_id); end if;
 select count(*),min(b.id::text) into n,bid from lesson_content_blocks b join lesson_pages p on p.id=b.page_id join lessons l on l.id=p.lesson_id where l.course_id=a.course_id and b.payload->>'aiManagedByAssetId'=a.id::text;
 if p_kind is null and n=1 then k:='block';tid:=bid; end if;
 if n>1 and p_kind is null then k:=null; end if;
 block_kind:=case when a.asset_type in ('audio','video') then a.asset_type else 'image' end;
 intent:=jsonb_build_object('version',1,'kind',block_kind,'purpose',left(coalesce(nullif(a.prompt,''),nullif(a.script,''),a.placement),1000),'aspectRatio','16:9','required',false,'style','inherit');
 begin
 if k in ('page_block','page_cover') then
 select p.lesson_id into lid from lesson_pages p join lessons l on l.id=p.lesson_id where p.id=tid and l.course_id=a.course_id and (a.lesson_id is null or a.lesson_id=l.id) for update of p;
 if lid is null then raise exception 'Choose the exact lesson page for this brief.'; end if;
 elsif k='block' then
 select b.payload,p.lesson_id into existing,lid from lesson_content_blocks b join lesson_pages p on p.id=b.page_id join lessons l on l.id=p.lesson_id where b.id::text=tid and b.block_type::text=block_kind and l.course_id=a.course_id and (a.lesson_id is null or a.lesson_id=l.id) for update of b;
 if lid is null then raise exception 'Choose an existing compatible media block.'; end if;
 elsif k='lesson_thumbnail' then
 select id,cover_image into lid,existing from lessons where id=tid and course_id=a.course_id and (a.lesson_id is null or a.lesson_id=id) for update;
 if lid is null or block_kind<>'image' then raise exception 'Choose an image destination in the original lesson.'; end if;
 elsif k in ('course_thumbnail','course_cover') then
 if a.lesson_id is not null or block_kind<>'image' then raise exception 'Choose a compatible destination in the original lesson.'; end if;
 if k='course_thumbnail' then select thumbnail into existing from courses where id=a.course_id for update; end if;
 else raise exception 'The destination is ambiguous. Choose its block or cover explicitly.';
 end if;
 if k='page_cover' then
 if block_kind<>'image' then raise exception 'Page covers require images.'; end if;
 select cover_image into existing from lesson_pages where id=tid;
 end if;
 if k='course_cover' and exists(select 1 from learning_media_assets x where x.course_id=a.course_id and x.id<>a.id and x.lesson_id is null and (x.metadata->>'targetKind'='course_cover' or x.placement='course_cover') and coalesce(x.url,'')<>'' and x.url is distinct from a.url) then raise exception 'Multiple course covers exist. Keep the current selection and resolve this brief explicitly.'; end if;
 if coalesce(existing->>'src','')<>'' and coalesce(a.url,'')<>'' and existing->>'src'<>a.url then raise exception 'This destination already has another image. Its current selection was preserved.'; end if;
 if k='page_block' then
 -- Only an explicit page mapping can create an optional block. No placement guessing.
 tid:=a.id::text;
 if exists(select 1 from lesson_content_blocks where id::text=tid) then raise exception 'This mapped block identity is already occupied.'; end if;
 insert into lesson_content_blocks(id,page_id,block_type,sort_order,payload)
 select tid::uuid,coalesce(p_target,a.metadata->>'targetPageId'),block_kind::public.lesson_content_block_type,coalesce(max(sort_order),0)+1,
 jsonb_build_object('src',coalesce(a.url,''),'alt',coalesce(a.alt_text,''),'caption',coalesce(a.caption,''),'aiManagedByAssetId',a.id,'mediaIntent',intent,'mediaBrief',intent->>'purpose')
 from lesson_content_blocks where page_id=coalesce(p_target,a.metadata->>'targetPageId');
 k:='block';
 elsif k='block' then
 update lesson_content_blocks set payload=payload||jsonb_build_object('mediaIntent',coalesce(payload->'mediaIntent',intent),'mediaBrief',coalesce(payload->'mediaBrief',to_jsonb(intent->>'purpose')))
 ||case when coalesce(payload->>'src','')='' and coalesce(a.url,'')<>'' then jsonb_build_object('src',a.url,'alt',coalesce(a.alt_text,''),'caption',coalesce(a.caption,'')) else '{}'::jsonb end where id::text=tid;
 elsif coalesce(a.url,'')<>'' and coalesce(existing->>'src','')='' then
 if k='course_thumbnail' then update courses set thumbnail=jsonb_build_object('src',a.url,'alt',coalesce(a.alt_text,'')) where id::text=tid;
 elsif k='lesson_thumbnail' then update lessons set cover_image=jsonb_build_object('src',a.url,'alt',coalesce(a.alt_text,'')) where id::text=tid;
 elsif k='page_cover' then update lesson_pages set cover_image=jsonb_build_object('src',a.url,'alt',coalesce(a.alt_text,'')) where id=tid;
 end if;
 end if;
 update private.ai_legacy_media_mappings set status='mapped',target_kind=k,target_id=tid,reason=null,mapped_at=now(),mapped_by=auth.uid(),updated_at=now() where asset_id=a.id;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'legacy_media_mapped','media_asset',a.id::text,jsonb_build_object('kind',k,'target',tid));
 exception when others then
 get stacked diagnostics mapping_error=message_text;
 update private.ai_legacy_media_mappings set status='needs_resolution',reason=left(mapping_error,500),updated_at=now() where asset_id=a.id;
 end;
end $$;
commit;
