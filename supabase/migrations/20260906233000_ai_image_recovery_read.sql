begin;
create or replace function public.admin_ai_image_setup(p_target text,p_target_id text) returns jsonb language sql stable security definer set search_path=public,private as $$
 select private.ai_image_target(p_target,p_target_id)||jsonb_build_object('latestResult',(
 select private.ai_authoring_projection(r,true) from private.ai_authoring_results r where r.kind='image' and r.context->>'target'=p_target and r.context->>'targetId'=p_target_id and r.deleted_at is null and r.stage<>'quote' and private.ai_authoring_can_access(r) order by r.created_at desc,r.id desc limit 1))
$$;
commit;
