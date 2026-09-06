begin;
create or replace function public.claim_ai_generation_job(
  p_worker_id text,
  p_lease_seconds integer default 1800,
  p_max_attempts integer default 3
)
returns table (
  id uuid,
  entity_type text,
  entity_id text,
  job_type text,
  prompt jsonb,
  attempt_count integer,
  lock_token uuid,
  lock_version integer
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'Worker id is required.';
  end if;

  if not private.current_request_is_service_role() then
    raise exception 'Only the AI worker may claim generation jobs.';
  end if;

  return query
  with candidate as (
    select j.id
    from public.ai_generation_jobs j
    where j.status in ('queued', 'running')
      and j.available_at <= now()
      and (j.job_type<>'media_assets' or j.prompt->>'mode'='authoring_image_v4' or j.started_at is not null or exists(select 1 from private.ai_legacy_job_choices accepted where accepted.job_id=j.id and accepted.decision='continue'))
      and not exists(select 1 from private.ai_legacy_job_choices c where c.job_id=j.id and c.decision in ('pending','cancel'))
      and j.attempt_count < p_max_attempts
      and private.organization_ai_job_can_run(j)
      and (
        j.status = 'queued'
        or (
          j.status = 'running'
          and (
            coalesce(j.heartbeat_at, j.locked_at) is null
            or coalesce(j.heartbeat_at, j.locked_at) < now() - make_interval(secs => p_lease_seconds)
          )
        )
      )
    order by j.available_at asc, j.created_at asc
    for update skip locked
    limit 1
  ),
  claimed as (
    update public.ai_generation_jobs j
    set status = 'running',
        attempt_count = j.attempt_count + 1,
        locked_at = now(),
        locked_by = p_worker_id,
        heartbeat_at = now(),
        lock_token = gen_random_uuid(),
        lock_version = j.lock_version + 1,
        started_at = coalesce(j.started_at, now()),
        error = null,
        failure_code = null,
        failure_detail = '{}'::jsonb
    from candidate
    where j.id = candidate.id
    returning j.id,
              j.entity_type,
              j.entity_id,
              j.job_type,
              j.prompt,
              j.attempt_count,
              j.lock_token,
              j.lock_version
  )
  select claimed.id,
         claimed.entity_type,
         claimed.entity_id,
         claimed.job_type,
         claimed.prompt,
         claimed.attempt_count,
         claimed.lock_token,
         claimed.lock_version
  from claimed;
end;
$$;


create or replace function public.admin_decide_legacy_ai_job(p_job uuid,p_decision text) returns void
language plpgsql security definer set search_path=public,private as $$
declare j public.ai_generation_jobs; c private.ai_legacy_job_choices;
begin
 select * into j from ai_generation_jobs where id=p_job for update;
 if j.id is null or not public.current_user_can_edit_course(j.entity_id) then raise exception 'Request unavailable.' using errcode='42501'; end if;
 if j.status='queued' and j.job_type='media_assets' and coalesce(j.prompt->>'mode','')<>'authoring_image_v4' and j.started_at is null then
 insert into private.ai_legacy_job_choices(job_id) values(j.id) on conflict(job_id) do nothing;
 end if;
 select * into c from private.ai_legacy_job_choices where job_id=j.id for update;
 if c.job_id is null or p_decision not in ('continue','cancel') then raise exception 'Choose a pending earlier request.' using errcode='22023'; end if;
 if c.decision=p_decision then return; end if;
 if c.decision<>'pending' or j.status<>'queued' then raise exception 'This request already changed. Refresh its status.' using errcode='PT409'; end if;
 update private.ai_legacy_job_choices set decision=p_decision,decided_by=auth.uid(),decided_at=now() where job_id=j.id;
 if p_decision='cancel' then
 -- An attempted request may already have incurred provider costs. Do not refund it.
 perform private.reconcile_organization_ai_usage_for_job(j,'failed','{}','Cancelled by editor',case when j.attempt_count=0 and j.started_at is null then 'validation_error' else 'cancelled_after_attempt' end,false);
 update ai_generation_jobs set status='failed',error='Cancelled by editor',failure_code='legacy_cancelled',completed_at=now() where id=j.id;
 end if;
 insert into audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'legacy_ai_request_decided','ai_generation_job',j.id::text,jsonb_build_object('decision',p_decision));
end $$;
revoke all on function public.admin_decide_legacy_ai_job(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_decide_legacy_ai_job(uuid,text) to authenticated;

create or replace function public.admin_legacy_ai_media_workspace(p_course text) returns jsonb
language plpgsql stable security definer set search_path=public,private as $$
begin
 if not public.current_user_can_edit_course(p_course) then raise exception 'Course editing access required.' using errcode='42501'; end if;
 return jsonb_build_object(
 'briefs',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'lessonId',a.lesson_id,'title',a.placement,'kind',a.asset_type,'brief',coalesce(nullif(a.prompt,''),a.script,''),'url',a.url,'alt',a.alt_text,'review',a.review_status,'status',coalesce(m.status,'unmapped'),'reason',m.reason,'targetKind',m.target_kind,'targetId',m.target_id,'provenance',jsonb_build_object('source',a.source,'provider',a.provider,'model',a.model)) order by a.sort_order,a.id) from learning_media_assets a left join private.ai_legacy_media_mappings m on m.asset_id=a.id where a.course_id=p_course),'[]'::jsonb),
 'destinations',coalesce((select jsonb_agg(x.item order by x.label) from (
 select l.title||' — cover' label,jsonb_build_object('kind','lesson_thumbnail','id',l.id,'lessonId',l.id,'label',l.title||' — cover') item from lessons l where l.course_id=p_course
 union all select l.title||' — '||p.title,jsonb_build_object('kind','page_cover','id',p.id,'lessonId',l.id,'label',l.title||' — '||p.title||' — cover') from lesson_pages p join lessons l on l.id=p.lesson_id where l.course_id=p_course
 union all select l.title||' — '||p.title,jsonb_build_object('kind','page_block','id',p.id,'lessonId',l.id,'label',l.title||' — '||p.title||' — new optional media block') from lesson_pages p join lessons l on l.id=p.lesson_id where l.course_id=p_course
 union all select l.title||' — '||p.title,jsonb_build_object('kind','block','id',b.id,'pageId',p.id,'lessonId',l.id,'label',l.title||' — '||p.title||' — '||b.block_type||' '||b.sort_order) from lesson_content_blocks b join lesson_pages p on p.id=b.page_id join lessons l on l.id=p.lesson_id where l.course_id=p_course and b.block_type in ('image','video','audio')
 ) x),'[]'::jsonb),
 'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'status',j.status,'createdAt',j.created_at,'decision',coalesce(c.decision,case when j.status='queued' and j.started_at is null then 'pending' end),'attempted',j.attempt_count>0,'creditStatus',coalesce(u.status,'unmetered'),'reserved',u.reserved_units,'charged',u.final_charged_units,'released',case when u.status='released' then u.reserved_units else 0 end) order by j.created_at desc) from ai_generation_jobs j left join private.ai_legacy_job_choices c on c.job_id=j.id left join organization_ai_usage_records u on u.id=j.organization_ai_usage_record_id where j.entity_id=p_course and j.job_type='media_assets' and coalesce(j.prompt->>'mode','')<>'authoring_image_v4' and (j.status in ('queued','running') or c.job_id is not null)),'[]'::jsonb));
end $$;
revoke all on function public.admin_legacy_ai_media_workspace(text) from public,anon,authenticated,service_role;
grant execute on function public.admin_legacy_ai_media_workspace(text) to authenticated;
notify pgrst,'reload schema';
commit;
