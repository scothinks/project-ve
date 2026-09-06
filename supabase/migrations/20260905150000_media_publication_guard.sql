begin;
-- A timestamp comparison is insufficient when publish is invoked twice within
-- one transaction. Guard the publication operation itself.
alter function public.admin_publish_lesson(text) rename to media_publish_lesson_base;
alter function public.media_publish_lesson_base(text) set schema private;
revoke all on function private.media_publish_lesson_base(text) from public,anon,authenticated,service_role;
create function public.admin_publish_lesson(p_lesson_id text) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare c text;
begin
 select course_id into c from public.lessons where id=p_lesson_id;
 if auth.uid() is null or c is null or not public.current_user_can_edit_course(c) then raise exception 'Lesson content editor access required.'; end if;
 perform 1 from public.lessons where id=p_lesson_id for update;
 perform 1 from private.media_versions where id in (select version_id from private.media_placements where lesson_id=p_lesson_id and in_draft) order by id for update;
 if exists(select 1 from private.media_placements p join private.media_versions v on v.id=p.version_id where p.lesson_id=p_lesson_id and p.in_draft and v.revoked_at is not null) then raise exception 'Replace revoked media before publishing.' using errcode='23514'; end if;
 return private.media_publish_lesson_base(p_lesson_id);
end $$;
revoke all on function public.admin_publish_lesson(text) from public,anon,authenticated,service_role;
grant execute on function public.admin_publish_lesson(text) to authenticated,service_role;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles)
values('private','media_publish_lesson_base','p_lesson_id text','INTERNAL_HELPER','Guarded media-aware publication wrapper.','Existing lesson ownership and AI approval predicates; inaccessible to API roles.','{}');
notify pgrst,'reload schema';
commit;
