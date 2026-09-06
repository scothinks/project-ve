begin;
-- Bounded maintenance on the existing trusted worker endpoint. Never runs on
-- rendering, status reads or user navigation; never invokes a provider.
create function public.service_recover_ai_authoring_jobs(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare j public.ai_generation_jobs; r private.ai_authoring_results; object_meta jsonb;
 worker text:='recovery-'||gen_random_uuid(); recovered integer:=0; failed integer:=0; deferred integer:=0;
begin
 if not private.current_request_is_service_role() then raise exception 'Worker access required.' using errcode='42501'; end if;
 for j in
 select jobs.* from public.ai_generation_jobs jobs
 join private.ai_authoring_results results on results.job_id=jobs.id
 where results.deleted_at is null and results.receipt is null
 and (
   (results.stage in ('starting','writing') and
     ((jobs.status='running' and coalesce(jobs.heartbeat_at,jobs.locked_at,jobs.created_at)<now()-interval '30 minutes')
      or (jobs.status='queued' and (jobs.attempt_count>=3 or not private.organization_ai_job_can_run(jobs)))))
   or (results.kind='image' and results.stage='failed' and jobs.status='failed'
     and exists(select 1 from storage.objects o where o.bucket_id='learning-media-private' and o.name='registry/authoring-'||results.id||'.png'))
 )
 order by jobs.created_at limit greatest(1,least(coalesce(p_limit,20),20))
 for update of jobs skip locked
 loop
  begin
   select * into r from private.ai_authoring_results where job_id=j.id for update;
   -- Replace the expired lease before settling; any late worker now fails its fence.
   update ai_generation_jobs set status='running',locked_by=worker,lock_token=gen_random_uuid(),
    lock_version=lock_version+1,heartbeat_at=now(),locked_at=now()
    where id=j.id returning * into j;
   object_meta:=null;
   if r.kind='image' and r.provider_started_at is not null then
    select metadata into object_meta from storage.objects where bucket_id='learning-media-private'
      and name='registry/authoring-'||r.id||'.png';
   end if;
   if object_meta->>'mimetype'='image/png' and object_meta->>'size' ~ '^[0-9]{1,8}$'
      and (object_meta->>'size')::bigint between 8 and 10485760 then
    perform public.service_ai_image_checkpoint(j.id,worker,j.lock_token,j.lock_version,'ready',
      jsonb_build_object('path','registry/authoring-'||r.id||'.png','size',(object_meta->>'size')::bigint));
    recovered:=recovered+1;
   elsif r.kind in ('course_outline','course_draft') then
    perform public.service_ai_course_checkpoint(j.id,worker,j.lock_token,j.lock_version,'failed');
    failed:=failed+1;
   elsif r.kind='image' then
    perform public.service_ai_image_checkpoint(j.id,worker,j.lock_token,j.lock_version,'failed');
    failed:=failed+1;
   else
    perform public.service_ai_page_checkpoint(j.id,worker,j.lock_token,j.lock_version,'failed');
    failed:=failed+1;
   end if;
  exception when others then
   -- Roll back this item, including its temporary lease. Keep stored bytes and
   -- report deferred work; quota/registry failures can be retried after repair.
   deferred:=deferred+1;
  end;
 end loop;
 return jsonb_build_object('recoveredImages',recovered,'settledIncomplete',failed,'deferred',deferred);
end $$;
revoke all on function public.service_recover_ai_authoring_jobs(integer) from public,anon,authenticated,service_role;
grant execute on function public.service_recover_ai_authoring_jobs(integer) to service_role;
insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles)
values('public','service_recover_ai_authoring_jobs','p_limit integer','SERVICE_ROLE_ONLY','Existing trusted AI worker','Service identity; at most 20 expired/exhausted authoring jobs; row locks and replacement lease; no provider calls.',array['service_role']);
commit;
