-- Keep the selected detail record distinct from list query aliases.
create or replace function public.admin_read_ai_results(p_id uuid default null,p_lesson_id text default null,
 p_organization_id uuid default null,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public,private as $$
declare selected_result private.ai_authoring_results;
begin
 if auth.uid() is null then raise exception 'Editor access required.' using errcode='42501'; end if;
 if p_id is not null then
   select * into selected_result from private.ai_authoring_results where id=p_id;
   if selected_result.id is null or not private.ai_authoring_can_access(selected_result) then raise exception 'Result unavailable.' using errcode='42501'; end if;
   return private.ai_authoring_projection(selected_result,true);
 end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(item order by created_at desc,id desc) from (
   select private.ai_authoring_projection(r,false) item,r.created_at,r.id from private.ai_authoring_results r
   where r.organization_id is not distinct from p_organization_id and (p_lesson_id is null or r.lesson_id=p_lesson_id)
   and r.stage<>'quote' and r.deleted_at is null and private.ai_authoring_can_access(r)
   order by r.created_at desc,r.id desc limit 20 offset greatest(0,least(p_offset,100000))) items),'[]'),
 'unusedCount',(select count(*) from private.ai_authoring_results r where r.organization_id is not distinct from p_organization_id
   and (p_lesson_id is null or r.lesson_id=p_lesson_id) and r.candidate is not null and r.receipt is null
   and r.deleted_at is null and private.ai_authoring_can_access(r)));
end $$;
