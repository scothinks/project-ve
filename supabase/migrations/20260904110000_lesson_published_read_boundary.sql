-- Coordinated lesson reader cutover: draft rows are editorial, snapshots are live.
begin;

-- Preserve page identity and completion history after a draft page is deleted.
create table private.lesson_page_identities (
  id text primary key,
  lesson_id text not null references public.lessons(id) on delete cascade,
  unique (lesson_id, id)
);
alter table private.lesson_page_identities enable row level security;
revoke all on private.lesson_page_identities from public, anon, authenticated, service_role;
insert into private.lesson_page_identities(id, lesson_id)
select id, lesson_id from public.lesson_pages;
insert into private.lesson_page_identities(id, lesson_id)
select p->>'id', l.id from public.lessons l
cross join lateral jsonb_array_elements(coalesce(l.published_snapshot->'pages', '[]')) p
on conflict (id) do nothing;

-- Fail closed on a pre-existing cross-lesson ID reuse, before changing any FK.
do $$ begin
  if exists (
    select 1 from public.lessons l
    cross join lateral jsonb_array_elements(coalesce(l.published_snapshot->'pages','[]')) p
    join private.lesson_page_identities i on i.id = p->>'id'
    where i.lesson_id <> l.id
  ) then raise exception 'Published page identity conflicts must be resolved before cutover.'; end if;
end $$;

alter table public.lesson_page_completions drop constraint lesson_page_completions_page_id_fkey;
alter table public.lesson_page_completions add constraint lesson_page_completions_page_identity_fkey
  foreign key (lesson_id, page_id) references private.lesson_page_identities(lesson_id, id) on delete cascade;
alter table public.programme_lesson_page_completions drop constraint programme_lesson_page_completions_page_id_fkey;
alter table public.programme_lesson_page_completions add constraint programme_lesson_page_completions_page_identity_fkey
  foreign key (lesson_id, page_id) references private.lesson_page_identities(lesson_id, id) on delete cascade;

create function private.retain_lesson_page_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into private.lesson_page_identities(id, lesson_id) values (new.id, new.lesson_id)
  on conflict (id) do nothing;
  if not exists(select 1 from private.lesson_page_identities where id = new.id and lesson_id = new.lesson_id) then
    raise exception 'Lesson page identity belongs to another lesson.';
  end if;
  return new;
end $$;
revoke all on function private.retain_lesson_page_identity() from public, anon, authenticated, service_role;
create trigger lesson_pages_retain_identity before insert or update of id, lesson_id on public.lesson_pages
for each row execute function private.retain_lesson_page_identity();

-- Refresh only missing legacy baselines. Never overwrite an existing publication.
update public.lessons set published_snapshot = private.lesson_draft_snapshot(id), published_at = now()
where status = 'published' and published_snapshot is null;

-- Internal projections expose only the published page set and lesson policy.
-- Snapshot-null lessons are intentionally excluded: no fallback can expose drafts.
create view private.published_lesson_pages as
select l.id as lesson_id, p.id, p.page_number
from public.lessons l
cross join lateral jsonb_to_recordset(l.published_snapshot->'pages') as p(id text, page_number integer)
where l.published_snapshot is not null and l.status = 'published';
revoke all on private.published_lesson_pages from public, anon, authenticated, service_role;

create function public.current_user_can_read_published_lesson(p_lesson_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.lessons l join public.courses c on c.id = l.course_id
    where l.id = p_lesson_id and l.status = 'published' and l.published_snapshot is not null
      and c.status = 'published' and public.current_user_can_read_course(l.course_id));
$$;
revoke all on function public.current_user_can_read_published_lesson(text) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_published_lesson(text) to anon, authenticated, service_role;

create view public.learner_lessons with (security_barrier = true) as
select l.id, l.course_id, l.slug, l.status, l.sort_order,
  l.published_snapshot->'lesson'->>'title' as title,
  l.published_snapshot->'lesson'->>'description' as description,
  l.published_snapshot->'lesson'->'cover_image' as cover_image,
  (l.published_snapshot->'lesson'->>'estimated_minutes')::integer as estimated_minutes,
  (l.published_snapshot->'lesson'->>'retry_mode')::public.lesson_retry_mode as retry_mode,
  (l.published_snapshot->'lesson'->>'retry_cooldown_seconds')::integer as retry_cooldown_seconds,
  (l.published_snapshot->'lesson'->>'retry_requires_reread')::boolean as retry_requires_reread,
  (l.published_snapshot->'lesson'->>'quiz_requires_lesson_completion')::boolean as quiz_requires_lesson_completion,
  (l.published_snapshot->'lesson'->>'max_earning_attempts')::integer as max_earning_attempts,
  l.published_snapshot, l.published_at,
  array(select p->>'id' from jsonb_array_elements(l.published_snapshot->'pages') p order by (p->>'page_number')::integer) as page_ids
from public.lessons l where public.current_user_can_read_published_lesson(l.id);
create view public.learner_lesson_page_references with (security_barrier = true) as
select p.id, p.lesson_id, p.page_number from private.published_lesson_pages p
where public.current_user_can_read_published_lesson(p.lesson_id);
revoke all on public.learner_lessons, public.learner_lesson_page_references from public, anon, authenticated, service_role;
grant select on public.learner_lessons, public.learner_lesson_page_references to anon, authenticated, service_role;

-- RLS closes every raw draft-content read, including draft lesson settings.
alter policy "Published lessons are readable" on public.lessons to authenticated
using (public.current_user_can_edit_course(course_id));
alter policy "Published lesson pages are readable" on public.lesson_pages to authenticated
using (exists(select 1 from public.lessons l where l.id = lesson_id and public.current_user_can_edit_course(l.course_id)));
alter policy "Published lesson blocks are readable" on public.lesson_content_blocks to authenticated
using (exists(select 1 from public.lesson_pages p join public.lessons l on l.id = p.lesson_id
  where p.id = page_id and public.current_user_can_edit_course(l.course_id)));
-- Media library rows remain editor-only; anonymous course readers receive no draft assets.
alter policy "Course editors can read learning media assets" on public.learning_media_assets to authenticated;
-- Quizzes retain their separate lifecycle; their learner authorization cannot
-- depend on SELECT access to the now-editor-only lesson table.
alter policy "Published quizzes are readable" on public.quizzes using (
  status = 'published' and public.current_user_can_read_published_lesson(lesson_id)
);
create policy "Course editors can read draft quizzes" on public.quizzes for select to authenticated
using (exists(select 1 from public.lessons l where l.id = lesson_id and public.current_user_can_edit_course(l.course_id)));
create or replace view public.learner_quiz_questions with (security_barrier = true) as
select qq.id, qq.quiz_id, qq.question_order, qq.question_type, qq.prompt, qq.xp
from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
where q.status = 'published' and public.current_user_can_read_published_lesson(q.lesson_id);
create or replace view public.learner_quiz_options with (security_barrier = true) as
select qo.id, qo.question_id, qo.option_order, qo.label
from public.quiz_options qo join public.quiz_questions qq on qq.id = qo.question_id
join public.quizzes q on q.id = qq.quiz_id
where q.status = 'published' and public.current_user_can_read_published_lesson(q.lesson_id);

CREATE OR REPLACE FUNCTION public.complete_lesson_page(p_lesson_id text, p_page_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_page_exists boolean := false;
  v_completed_pages text[] := '{}';
  v_total_pages integer := 0;
  v_completed_count integer := 0;
  v_is_lesson_complete boolean := false;
  v_existing_quiz_score integer;
  v_started_at timestamptz;
  v_completed_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_lesson_id, '')), '') is null then
    raise exception 'lessonId is required.' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_page_id, '')), '') is null then
    raise exception 'pageId is required.' using errcode = '22023';
  end if;

  select exists (
    select 1
    from private.published_lesson_pages lp
    join public.lessons l
      on l.id = lp.lesson_id
    join public.courses c
      on c.id = l.course_id
    where lp.id = p_page_id
      and lp.lesson_id = p_lesson_id
      and l.status = 'published'
      and c.status = 'published'
      and public.current_user_can_read_published_lesson(l.id)
  )
    into v_page_exists;

  if not v_page_exists then
    raise exception 'Page not found for lesson.' using errcode = 'P0002';
  end if;

  insert into public.lesson_page_completions (
    user_id,
    lesson_id,
    page_id,
    completed_at
  )
  values (
    v_user_id,
    p_lesson_id,
    p_page_id,
    v_now
  )
  on conflict (user_id, lesson_id, page_id) do nothing;

  insert into public.lesson_progress (
    user_id,
    lesson_id,
    completed_pages,
    completed_modules,
    quiz_score,
    started_at,
    completed_at,
    updated_at
  )
  values (
    v_user_id,
    p_lesson_id,
    '{}',
    '{}',
    null,
    v_now,
    null,
    v_now
  )
  on conflict (user_id, lesson_id) do nothing;

  select quiz_score, started_at, completed_at
    into v_existing_quiz_score, v_started_at, v_completed_at
  from public.lesson_progress
  where user_id = v_user_id
    and lesson_id = p_lesson_id
  for update;

  select coalesce(array_agg(lp.id order by lp.page_number), '{}')::text[]
    into v_completed_pages
  from private.published_lesson_pages lp
  join public.lesson_page_completions lpc
    on lpc.page_id = lp.id
   and lpc.lesson_id = lp.lesson_id
   and lpc.user_id = v_user_id
  where lp.lesson_id = p_lesson_id;

  select count(*)::integer
    into v_total_pages
  from private.published_lesson_pages
  where lesson_id = p_lesson_id;

  v_completed_count := coalesce(array_length(v_completed_pages, 1), 0);
  v_is_lesson_complete := v_total_pages > 0 and v_completed_count >= v_total_pages;

  update public.lesson_progress
  set completed_pages = v_completed_pages,
      completed_modules = v_completed_pages,
      quiz_score = v_existing_quiz_score,
      started_at = coalesce(v_started_at, v_now),
      completed_at = case
        when v_is_lesson_complete then coalesce(v_completed_at, v_now)
        else null
      end,
      updated_at = v_now
  where user_id = v_user_id
    and lesson_id = p_lesson_id;

  return jsonb_build_object(
    'lessonId', p_lesson_id,
    'pageId', p_page_id,
    'completedPages', v_completed_pages,
    'completedPageCount', v_completed_count,
    'totalPageCount', v_total_pages,
    'lessonCompleted', v_is_lesson_complete
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.programme_lesson_completed_in_context(p_user_id uuid, p_programme_id uuid, p_lesson_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from private.published_lesson_pages page
    where page.lesson_id = p_lesson_id
  )
  and not exists (
    select 1
    from private.published_lesson_pages page
    where page.lesson_id = p_lesson_id
      and not exists (
        select 1
        from public.programme_lesson_page_completions completion
        where completion.user_id = p_user_id
          and completion.programme_id = p_programme_id
          and completion.lesson_id = p_lesson_id
          and completion.page_id = page.id
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.lesson_is_complete_for_user(p_user_id uuid, p_lesson_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with lesson_pages_for_lesson as (
    select lp.id
    from public.learner_lesson_page_references lp
    join public.learner_lessons l on l.id = lp.lesson_id
    join public.courses c on c.id = l.course_id
    where lp.lesson_id = p_lesson_id
      and l.status = 'published'
      and c.status = 'published'
  ),
  lesson_page_counts as (
    select count(*)::integer as total_pages
    from lesson_pages_for_lesson
  ),
  completed_page_counts as (
    select count(distinct lpc.page_id)::integer as completed_pages
    from public.lesson_page_completions lpc
    where lpc.user_id = p_user_id
      and lpc.lesson_id = p_lesson_id
      and lpc.page_id in (select id from lesson_pages_for_lesson)
  )
  select exists (
      select 1
      from lesson_page_counts lpc_total
      join completed_page_counts lpc_done on true
      where lpc_total.total_pages > 0
        and lpc_done.completed_pages >= lpc_total.total_pages
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_mission_state(p_deliveries jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_deliveries jsonb := coalesce(p_deliveries, '[]'::jsonb);
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if jsonb_typeof(v_deliveries) <> 'array' then
    raise exception 'Mission deliveries must be a JSON array.';
  end if;

  if jsonb_array_length(v_deliveries) > 100 then
    raise exception 'Mission delivery limit exceeded.';
  end if;

  with requested_deliveries as (
    select
      delivery.ordinality::integer as request_order,
      nullif(trim(delivery.item ->> 'deliveryId'), '') as requested_delivery_id,
      nullif(trim(delivery.item ->> 'missionId'), '') as mission_id,
      nullif(trim(delivery.item ->> 'organizationId'), '')::uuid as organization_id,
      nullif(trim(delivery.item ->> 'programmeId'), '')::uuid as programme_id,
      nullif(trim(delivery.item ->> 'programmeMissionId'), '') as programme_mission_id
    from jsonb_array_elements(v_deliveries) with ordinality as delivery(item, ordinality)
  ),
  authorized_deliveries as (
    select
      requested.request_order,
      case
        when requested.programme_id is not null
          then requested.programme_id::text || ':' || mission.id
        when requested.organization_id is not null
          then requested.organization_id::text || ':' || mission.id
        else mission.id
      end as delivery_id,
      mission.id as mission_id,
      mission.repeatability,
      mission.validation_type,
      mission.validation_config,
      mission.starts_at,
      mission.ends_at,
      requested.organization_id,
      requested.programme_id,
      case
        when requested.programme_id is not null then programme_mission.mission_id
        else null
      end as programme_mission_id,
      case
        when mission.repeatability = 'daily' then
          'day:' || (timezone('Africa/Lagos', now()))::date::text
        when mission.repeatability = 'weekly' then
          'week:' || date_trunc('week', timezone('Africa/Lagos', now()))::date::text
        when mission.repeatability = 'campaign' then
          'campaign:'
          || coalesce(to_char(mission.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'open')
          || ':'
          || coalesce(to_char(mission.ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'open')
        when mission.repeatability = 'per_referral' then 'referral'
        else 'lifetime'
      end as period_scope
    from requested_deliveries requested
    join public.missions mission
      on mission.id = requested.mission_id
     and mission.status = 'published'
     and (mission.starts_at is null or mission.starts_at <= now())
     and (mission.ends_at is null or mission.ends_at > now())
    left join public.programmes programme
      on programme.id = requested.programme_id
     and programme.organization_id = requested.organization_id
     and programme.status = 'published'
    left join public.programme_missions programme_mission
      on programme_mission.programme_id = programme.id
     and programme_mission.mission_id = mission.id
    where requested.mission_id is not null
      and (
        (
          requested.organization_id is null
          and requested.programme_id is null
          and mission.catalog_scope = 'platform'
        )
        or (
          requested.organization_id is not null
          and requested.programme_id is null
          and mission.organization_id = requested.organization_id
          and mission.catalog_scope in ('organization_private', 'adapted_platform')
          and mission.delivery_scope = 'organization'
          and exists (
            select 1
            from public.organization_memberships membership
            where membership.organization_id = requested.organization_id
              and membership.user_id = v_user_id
              and membership.status = 'active'
          )
        )
        or (
          requested.organization_id is not null
          and requested.programme_id is not null
          and programme.id is not null
          and programme_mission.mission_id is not null
          and public.current_user_can_read_programme(programme.id)
          and (programme_mission.starts_at is null or programme_mission.starts_at <= now())
          and (programme_mission.due_at is null or programme_mission.due_at > now())
          and (
            mission.catalog_scope = 'platform'
            or mission.organization_id = requested.organization_id
          )
        )
      )
  ),
  scoped_deliveries as (
    select
      delivery.*,
      case
        when delivery.repeatability = 'per_referral' then delivery.period_scope
        when delivery.programme_id is not null then
          'programme:' || delivery.programme_id::text || ':' || delivery.period_scope
        when delivery.organization_id is not null then
          'organization:' || delivery.organization_id::text || ':' || delivery.period_scope
        else delivery.period_scope
      end as award_scope
    from authorized_deliveries delivery
  ),
  lesson_catalog as (
    select
      lesson.id,
      lesson.course_id,
      count(page.id)::integer as page_count
    from public.lessons lesson
    join public.courses course
      on course.id = lesson.course_id
     and course.status = 'published'
    left join private.published_lesson_pages page
      on page.lesson_id = lesson.id
    where lesson.status = 'published' and lesson.published_snapshot is not null
    group by lesson.id, lesson.course_id
  ),
  referral_rows as (
    select attribution.*
    from public.referral_attributions attribution
    where attribution.referrer_user_id = v_user_id
  ),
  progress_users as (
    select v_user_id as user_id
    union
    select referral.referred_user_id from referral_rows referral
  ),
  public_completed_lessons as (
    select completion.user_id, catalog.id as lesson_id, catalog.course_id
    from progress_users progress_user
    join public.lesson_page_completions completion
      on completion.user_id = progress_user.user_id
    join private.published_lesson_pages published_page
      on published_page.lesson_id = completion.lesson_id and published_page.id = completion.page_id
    join lesson_catalog catalog
      on catalog.id = completion.lesson_id
    where catalog.page_count > 0
    group by completion.user_id, catalog.id, catalog.course_id, catalog.page_count
    having count(distinct completion.page_id) >= catalog.page_count
  ),
  programme_completed_lessons as (
    select completion.programme_id, catalog.id as lesson_id, catalog.course_id
    from public.programme_lesson_page_completions completion
    join private.published_lesson_pages published_page
      on published_page.lesson_id = completion.lesson_id and published_page.id = completion.page_id
    join lesson_catalog catalog
      on catalog.id = completion.lesson_id
    where completion.user_id = v_user_id
      and catalog.page_count > 0
    group by completion.programme_id, catalog.id, catalog.course_id, catalog.page_count
    having count(distinct completion.page_id) >= catalog.page_count
  ),
  state_rows as (
    select
      delivery.request_order,
      delivery.delivery_id,
      delivery.mission_id,
      delivery.validation_type,
      delivery.repeatability,
      delivery.organization_id,
      delivery.programme_id,
      delivery.programme_mission_id,
      delivery.award_scope,
      award_state.awarded_count,
      case
        when delivery.repeatability = 'per_referral' then award_state.awarded_count > 0
        else award_state.has_current_award
      end as has_current_award,
      progress.progress_count,
      progress.target_count,
      progress.is_valid,
      proof.review_status,
      proof.required_fields,
      proof.requirement_mode,
      proof.field_statuses,
      referral.invited_count,
      referral.qualified_count,
      referral.qualified_ids,
      referral_token.token as referral_token
    from scoped_deliveries delivery
    cross join lateral (
      select
        count(award.id)::integer as awarded_count,
        coalesce(bool_or(award.award_scope = delivery.award_scope), false) as has_current_award
      from public.mission_awards award
      where award.user_id = v_user_id
        and award.mission_id = delivery.mission_id
        and award.organization_id is not distinct from delivery.organization_id
        and award.programme_id is not distinct from delivery.programme_id
        and award.programme_mission_id is not distinct from delivery.programme_mission_id
    ) award_state
    cross join lateral (
      select
        case delivery.validation_type
          when 'lesson_completed' then case when lesson_progress.completed then 1 else 0 end
          when 'course_completed' then course_progress.completed_count
          when 'lesson_count_completed' then lesson_count_progress.completed_count
          when 'referral_friend_completed_lessons' then referral_progress.qualified_count
          when 'proof_upload' then proof_progress.progress_count
          else 0
        end::integer as progress_count,
        case delivery.validation_type
          when 'course_completed' then greatest(1, course_progress.total_count)
          when 'lesson_count_completed' then lesson_count_progress.target_count
          when 'proof_upload' then proof_progress.target_count
          else 1
        end::integer as target_count,
        case delivery.validation_type
          when 'lesson_completed' then lesson_progress.completed
          when 'course_completed' then course_progress.total_count > 0
            and course_progress.completed_count >= course_progress.total_count
          when 'lesson_count_completed' then
            lesson_count_progress.completed_count >= lesson_count_progress.target_count
          when 'referral_friend_completed_lessons' then referral_progress.qualified_count > 0
          when 'proof_upload' then proof_progress.is_valid
          else false
        end as is_valid
      from lateral (
        select exists (
          select 1
          from lesson_catalog catalog
          where catalog.id = delivery.validation_config ->> 'lessonId'
            and (
              delivery.programme_id is null
              or exists (
                select 1 from public.programme_courses programme_course
                where programme_course.programme_id = delivery.programme_id
                  and programme_course.course_id = catalog.course_id
              )
            )
            and (
              (delivery.programme_id is null and exists (
                select 1 from public_completed_lessons completed
                where completed.user_id = v_user_id and completed.lesson_id = catalog.id
              ))
              or (delivery.programme_id is not null and exists (
                select 1 from programme_completed_lessons completed
                where completed.programme_id = delivery.programme_id and completed.lesson_id = catalog.id
              ))
            )
        ) as completed
      ) lesson_progress
      cross join lateral (
        select
          count(*)::integer as total_count,
          count(*) filter (where
            (delivery.programme_id is null and exists (
              select 1 from public_completed_lessons completed
              where completed.user_id = v_user_id and completed.lesson_id = catalog.id
            ))
            or (delivery.programme_id is not null and exists (
              select 1 from programme_completed_lessons completed
              where completed.programme_id = delivery.programme_id and completed.lesson_id = catalog.id
            ))
          )::integer as completed_count
        from lesson_catalog catalog
        where catalog.course_id = delivery.validation_config ->> 'courseId'
          and (
            delivery.programme_id is null
            or exists (
              select 1 from public.programme_courses programme_course
              where programme_course.programme_id = delivery.programme_id
                and programme_course.course_id = catalog.course_id
            )
          )
      ) course_progress
      cross join lateral (
        select
          greatest(1, coalesce(nullif(delivery.validation_config ->> 'count', '')::integer, 1)) as target_count,
          case
            when delivery.programme_id is not null
              and nullif(delivery.validation_config ->> 'withinDays', '') is not null
            then (
              select count(*)::integer
              from lesson_catalog catalog
              where exists (
                select 1 from public.programme_courses programme_course
                where programme_course.programme_id = delivery.programme_id
                  and programme_course.course_id = catalog.course_id
              )
                and catalog.page_count > 0
                and not exists (
                  select 1
                  from private.published_lesson_pages page
                  where page.lesson_id = catalog.id
                    and not exists (
                      select 1
                      from public.programme_lesson_page_completions completion
                      where completion.user_id = v_user_id
                        and completion.programme_id = delivery.programme_id
                        and completion.lesson_id = catalog.id
                        and completion.page_id = page.id
                        and completion.completed_at >= now() - make_interval(
                          days => nullif(delivery.validation_config ->> 'withinDays', '')::integer
                        )
                    )
                )
            )
            when delivery.programme_id is not null then (
              select count(*)::integer
              from programme_completed_lessons completed
              where completed.programme_id = delivery.programme_id
                and exists (
                  select 1 from public.programme_courses programme_course
                  where programme_course.programme_id = delivery.programme_id
                    and programme_course.course_id = completed.course_id
                )
            )
            when nullif(delivery.validation_config ->> 'withinDays', '') is not null then (
              select count(distinct progress.lesson_id)::integer
              from public.lesson_progress progress
              join lesson_catalog catalog on catalog.id = progress.lesson_id
              join public_completed_lessons completed on completed.lesson_id = progress.lesson_id and completed.user_id = progress.user_id
              where progress.user_id = v_user_id
                and progress.completed_at is not null
                and progress.completed_at >= now() - make_interval(
                  days => nullif(delivery.validation_config ->> 'withinDays', '')::integer
                )
            )
            else (
              select count(*)::integer
              from public_completed_lessons completed
              where completed.user_id = v_user_id
            )
          end as completed_count
      ) lesson_count_progress
      cross join lateral (
        select
          count(*)::integer as invited_count,
          count(*) filter (where
            referral.created_at <= now() - make_interval(
              hours => greatest(
                0,
                coalesce(nullif(delivery.validation_config ->> 'minimumAccountAgeHours', '')::integer, 24)
              )
            )
            and (
              select count(*)
              from public_completed_lessons completed
              where completed.user_id = referral.referred_user_id
                and (
                  delivery.programme_id is null
                  or exists (
                    select 1 from public.programme_courses programme_course
                    where programme_course.programme_id = delivery.programme_id
                      and programme_course.course_id = completed.course_id
                  )
                )
            ) >= greatest(
              1,
              coalesce(nullif(delivery.validation_config ->> 'requiredFriendLessonCount', '')::integer, 1)
            )
          )::integer as qualified_count,
          coalesce(
            jsonb_agg(referral.referred_user_id order by referral.created_at)
              filter (where
                referral.created_at <= now() - make_interval(
                  hours => greatest(
                    0,
                    coalesce(nullif(delivery.validation_config ->> 'minimumAccountAgeHours', '')::integer, 24)
                  )
                )
                and (
                  select count(*)
                  from public_completed_lessons completed
                  where completed.user_id = referral.referred_user_id
                    and (
                      delivery.programme_id is null
                      or exists (
                        select 1 from public.programme_courses programme_course
                        where programme_course.programme_id = delivery.programme_id
                          and programme_course.course_id = completed.course_id
                      )
                    )
                ) >= greatest(
                  1,
                  coalesce(nullif(delivery.validation_config ->> 'requiredFriendLessonCount', '')::integer, 1)
                )
              ),
            '[]'::jsonb
          ) as qualified_ids
        from referral_rows referral
        where referral.organization_id is not distinct from delivery.organization_id
          and referral.programme_id is not distinct from delivery.programme_id
          and referral.programme_mission_id is not distinct from delivery.programme_mission_id
      ) referral_progress
      cross join lateral (
        select
          coalesce(proof_summary.progress_count, 0)::integer as progress_count,
          case when proof_config.requirement_mode = 'any' then 1 else proof_config.required_count end::integer as target_count,
          case
            when proof_config.requires_manual_review then coalesce(proof_summary.approved_count, 0) >=
              case when proof_config.requirement_mode = 'any' then 1 else proof_config.required_count end
            else coalesce(proof_summary.present_count, 0) >=
              case when proof_config.requirement_mode = 'any' then 1 else proof_config.required_count end
          end as is_valid
        from lateral (
          select
            case when coalesce(delivery.validation_config ->> 'requirementMode', 'all') = 'any' then 'any' else 'all' end as requirement_mode,
            coalesce((delivery.validation_config ->> 'requiresManualReview')::boolean, false) as requires_manual_review,
            greatest(1, jsonb_array_length(coalesce(delivery.validation_config -> 'requiredFields', '["text"]'::jsonb))) as required_count
        ) proof_config
        left join lateral (
          select
            count(*) filter (where field_state.status <> 'pending')::integer as progress_count,
            count(*) filter (where field_state.status <> 'pending')::integer as present_count,
            count(*) filter (where field_state.status = 'approved')::integer as approved_count
          from (
            select required_field.field,
              case
                when exists (select 1 from public.mission_proofs proof where proof.user_id = v_user_id and proof.mission_id = delivery.mission_id and proof.award_scope = delivery.award_scope and proof.proof_type::text = required_field.field and proof.status = 'approved') then 'approved'
                when exists (select 1 from public.mission_proofs proof where proof.user_id = v_user_id and proof.mission_id = delivery.mission_id and proof.award_scope = delivery.award_scope and proof.proof_type::text = required_field.field and proof.status = 'submitted') then 'submitted'
                when (
                  proof_config.requirement_mode <> 'any'
                  or not exists (
                    select 1 from public.mission_proofs submitted_proof
                    where submitted_proof.user_id = v_user_id
                      and submitted_proof.mission_id = delivery.mission_id
                      and submitted_proof.award_scope = delivery.award_scope
                      and submitted_proof.status = 'submitted'
                  )
                )
                  and exists (select 1 from public.mission_proofs proof where proof.user_id = v_user_id and proof.mission_id = delivery.mission_id and proof.award_scope = delivery.award_scope and proof.proof_type::text = required_field.field and proof.status = 'rejected') then 'rejected'
                else 'pending'
              end as status
            from jsonb_array_elements_text(coalesce(delivery.validation_config -> 'requiredFields', '["text"]'::jsonb)) required_field(field)
          ) field_state
        ) proof_summary on true
      ) proof_progress
    ) progress
    cross join lateral (
      select
        case
          when delivery.validation_type <> 'proof_upload' then null
          when bool_or(field_state.status = 'rejected') then 'rejected'
          when proof_config.requires_manual_review
            and count(*) filter (where field_state.status = 'approved') >=
              case
                when proof_config.requirement_mode = 'any' then 1
                else jsonb_array_length(proof_config.required_fields)
              end
            then 'approved'
          when proof_config.requires_manual_review and bool_or(field_state.status in ('submitted', 'approved')) then 'submitted'
          else null
        end as review_status,
        case when delivery.validation_type = 'proof_upload' then proof_config.required_fields else null end as required_fields,
        case when delivery.validation_type = 'proof_upload' then proof_config.requirement_mode else null end as requirement_mode,
        case
          when delivery.validation_type = 'proof_upload' then coalesce(jsonb_object_agg(field_state.field, field_state.status), '{}'::jsonb)
          else null
        end as field_statuses
      from lateral (
        select
          case when coalesce(delivery.validation_config ->> 'requirementMode', 'all') = 'any' then 'any' else 'all' end as requirement_mode,
          coalesce((delivery.validation_config ->> 'requiresManualReview')::boolean, false) as requires_manual_review,
          coalesce(delivery.validation_config -> 'requiredFields', '["text"]'::jsonb) as required_fields
      ) proof_config
      left join lateral (
        select required_field.field,
          case
            when exists (select 1 from public.mission_proofs proof where proof.user_id = v_user_id and proof.mission_id = delivery.mission_id and proof.award_scope = delivery.award_scope and proof.proof_type::text = required_field.field and proof.status = 'approved') then 'approved'
            when exists (select 1 from public.mission_proofs proof where proof.user_id = v_user_id and proof.mission_id = delivery.mission_id and proof.award_scope = delivery.award_scope and proof.proof_type::text = required_field.field and proof.status = 'submitted') then 'submitted'
            when (
              proof_config.requirement_mode <> 'any'
              or not exists (
                select 1 from public.mission_proofs submitted_proof
                where submitted_proof.user_id = v_user_id
                  and submitted_proof.mission_id = delivery.mission_id
                  and submitted_proof.award_scope = delivery.award_scope
                  and submitted_proof.status = 'submitted'
              )
            )
              and exists (select 1 from public.mission_proofs proof where proof.user_id = v_user_id and proof.mission_id = delivery.mission_id and proof.award_scope = delivery.award_scope and proof.proof_type::text = required_field.field and proof.status = 'rejected') then 'rejected'
            else 'pending'
          end as status
        from jsonb_array_elements_text(proof_config.required_fields) required_field(field)
      ) field_state on true
      group by proof_config.requirement_mode, proof_config.requires_manual_review, proof_config.required_fields
    ) proof
    cross join lateral (
      select
        referral_progress.invited_count,
        referral_progress.qualified_count,
        referral_progress.qualified_ids
      from (
        select
          count(*)::integer as invited_count,
          count(*) filter (where
            referral.created_at <= now() - make_interval(
              hours => greatest(0, coalesce(nullif(delivery.validation_config ->> 'minimumAccountAgeHours', '')::integer, 24))
            )
            and (
              select count(*) from public_completed_lessons completed
              where completed.user_id = referral.referred_user_id
                and (
                  delivery.programme_id is null
                  or exists (
                    select 1 from public.programme_courses programme_course
                    where programme_course.programme_id = delivery.programme_id
                      and programme_course.course_id = completed.course_id
                  )
                )
            ) >= greatest(1, coalesce(nullif(delivery.validation_config ->> 'requiredFriendLessonCount', '')::integer, 1))
          )::integer as qualified_count,
          coalesce(jsonb_agg(referral.referred_user_id) filter (where
            referral.created_at <= now() - make_interval(
              hours => greatest(0, coalesce(nullif(delivery.validation_config ->> 'minimumAccountAgeHours', '')::integer, 24))
            )
            and (
              select count(*) from public_completed_lessons completed
              where completed.user_id = referral.referred_user_id
                and (
                  delivery.programme_id is null
                  or exists (
                    select 1 from public.programme_courses programme_course
                    where programme_course.programme_id = delivery.programme_id
                      and programme_course.course_id = completed.course_id
                  )
                )
            ) >= greatest(1, coalesce(nullif(delivery.validation_config ->> 'requiredFriendLessonCount', '')::integer, 1))
          ), '[]'::jsonb) as qualified_ids
        from referral_rows referral
        where referral.organization_id is not distinct from delivery.organization_id
          and referral.programme_id is not distinct from delivery.programme_id
          and referral.programme_mission_id is not distinct from delivery.programme_mission_id
      ) referral_progress
    ) referral
    left join lateral (
      select token.token
      from public.contextual_referral_tokens token
      where delivery.validation_type = 'referral_friend_completed_lessons'
        and delivery.programme_id is not null
        and token.referrer_user_id = v_user_id
        and token.organization_id = delivery.organization_id
        and token.programme_id = delivery.programme_id
        and token.programme_mission_id = delivery.programme_mission_id
        and token.status = 'published'
        and (token.expires_at is null or token.expires_at > now())
      order by token.created_at desc
      limit 1
    ) referral_token on true
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'deliveryId', state.delivery_id,
        'missionId', state.mission_id,
        'awardedCount', state.awarded_count,
        'hasCurrentAward', state.has_current_award,
        'progressCount', state.progress_count,
        'targetCount', state.target_count,
        'valid', state.is_valid,
        'reviewStatus', state.review_status,
        'proofRequiredFields', state.required_fields,
        'proofRequirementMode', state.requirement_mode,
        'proofFieldStatuses', state.field_statuses,
        'referralInvitedCount', state.invited_count,
        'referralQualifiedCount', state.qualified_count,
        'referralQualifiedIds', state.qualified_ids,
        'referralToken', state.referral_token,
        'organizationId', state.organization_id,
        'programmeId', state.programme_id,
        'programmeMissionId', state.programme_mission_id,
        'awardScope', state.award_scope
      )
      order by state.request_order
    ),
    '[]'::jsonb
  )
  into v_result
  from state_rows state;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.start_quiz_attempt_legacy(p_quiz_id text, p_lesson_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_attempt_id uuid := gen_random_uuid();
  v_quiz public.quizzes%rowtype;
  v_lesson public.lessons%rowtype;
  v_course public.courses%rowtype;
  v_last_ended_at timestamptz;
  v_page_count integer := 0;
  v_completed_count integer := 0;
  v_requires_fresh_reread boolean := false;
  v_retry_available_at timestamptz;
  v_daily_limit integer := 50;
  v_daily_earned integer := 0;
  v_daily_remaining integer := 0;
  v_unawarded_count integer := 0;
  v_question_ids text[] := '{}';
  v_mode public.quiz_attempt_mode := 'earning';
  v_seed text;
  v_total_possible_xp integer := 0;
  v_questions jsonb := '[]'::jsonb;
  v_account_id uuid := coalesce(
    nullif(current_setting('app.xp_account_id', true), '')::uuid,
    '00000000-0000-4000-8000-00000000e001'::uuid
  );
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_quiz
  from public.quizzes
  where id = p_quiz_id
    and status = 'published';

  if not found then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'lesson_incomplete',
      'message', 'We could not find this quiz for the selected lesson.'
    );
  end if;

  select *
    into v_lesson
  from public.lessons
  where id = v_quiz.lesson_id
    and status = 'published';

  if not found or (p_lesson_id is not null and p_lesson_id <> v_lesson.id) then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'lesson_incomplete',
      'message', 'We could not find this quiz for the selected lesson.'
    );
  end if;

  if v_lesson.published_snapshot is null or not public.current_user_can_read_published_lesson(v_lesson.id) then
    raise exception 'Published lesson access required.' using errcode = '42501';
  end if;
  v_lesson := jsonb_populate_record(v_lesson, v_lesson.published_snapshot->'lesson');

  select *
    into v_course
  from public.courses
  where id = v_lesson.course_id
    and status = 'published';

  if not found then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'lesson_incomplete',
      'message', 'We could not find this quiz for the selected lesson.'
    );
  end if;

  select ended_at
    into v_last_ended_at
  from public.quiz_attempts
  where user_id = v_user_id
    and lesson_id = v_lesson.id
    and ended_at is not null
  order by ended_at desc
  limit 1;

  v_requires_fresh_reread := v_last_ended_at is not null
    and coalesce(v_lesson.retry_requires_reread, false);

  select count(*)
    into v_page_count
  from private.published_lesson_pages
  where lesson_id = v_lesson.id;

  select count(distinct lpc.page_id)
    into v_completed_count
  from public.lesson_page_completions lpc
  join private.published_lesson_pages lp
    on lp.id = lpc.page_id
   and lp.lesson_id = v_lesson.id
  where lpc.user_id = v_user_id
    and lpc.lesson_id = v_lesson.id
    and (
      not v_requires_fresh_reread
      or lpc.completed_at > v_last_ended_at
    );

  if coalesce(v_lesson.quiz_requires_lesson_completion, true)
    and v_completed_count < v_page_count
  then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'lesson_incomplete',
      'message', case
        when v_requires_fresh_reread then 'Please reread the lesson pages before retrying this quiz.'
        else 'Complete the lesson pages before starting the quiz.'
      end
    );
  end if;

  if v_lesson.retry_mode = 'disabled' and v_last_ended_at is not null then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'retry_disabled',
      'message', 'This lesson quiz can only be completed once.'
    );
  end if;

  if v_lesson.retry_mode = 'cooldown' and v_last_ended_at is not null then
    v_retry_available_at := v_last_ended_at
      + make_interval(secs => coalesce(v_lesson.retry_cooldown_seconds, 86400));

    if v_retry_available_at > now() then
      return jsonb_build_object(
        'status', 'blocked',
        'reason', 'cooldown',
        'message', 'Your progress is saved. This quiz unlocks again after the retry window.',
        'retryAvailableAt', v_retry_available_at
      );
    end if;
  end if;

  select coalesce(
    (
      select earnable_quiz_xp_limit
      from public.user_daily_xp_limits
      where user_id = v_user_id
        and local_date = (now() at time zone 'Africa/Lagos')::date
    ),
    private.resolve_daily_quiz_xp_limit(v_account_id)
  )
  into v_daily_limit;

  select coalesce(sum(amount), 0)
    into v_daily_earned
  from public.xp_transactions
  where user_id = v_user_id
    and xp_account_id = v_account_id
    and direction = 'earn'
    and source_type = 'quiz_question'
    and (created_at at time zone 'Africa/Lagos')::date =
      (now() at time zone 'Africa/Lagos')::date;

  v_daily_remaining := greatest(0, v_daily_limit - v_daily_earned);

  select count(*)
    into v_unawarded_count
  from public.quiz_questions qq
  where qq.quiz_id = v_quiz.id
    and not exists (
      select 1
      from public.xp_transactions xp
      where xp.user_id = v_user_id
        and xp.xp_account_id = v_account_id
        and xp.direction = 'earn'
        and xp.source_type = 'quiz_question'
        and xp.source_id = qq.id
    );

  v_mode := case
    when v_unawarded_count > 0 then 'earning'::public.quiz_attempt_mode
    else 'practice'::public.quiz_attempt_mode
  end;

  if v_mode = 'earning' then
    select coalesce(array_agg(id order by question_order), '{}')::text[]
      into v_question_ids
    from public.quiz_questions qq
    where qq.quiz_id = v_quiz.id
      and qq.xp <= v_daily_remaining
      and not exists (
        select 1
        from public.xp_transactions xp
        where xp.user_id = v_user_id
          and xp.xp_account_id = v_account_id
          and xp.direction = 'earn'
          and xp.source_type = 'quiz_question'
          and xp.source_id = qq.id
      );
  else
    select coalesce(array_agg(id order by question_order), '{}')::text[]
      into v_question_ids
    from public.quiz_questions
    where quiz_id = v_quiz.id;
  end if;

  if v_mode = 'earning' and coalesce(array_length(v_question_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'daily_cap_reached',
      'message', 'You have reached today''s quiz XP limit.',
      'nextResetAt', (
        ((now() at time zone 'Africa/Lagos')::date + interval '1 day')
          at time zone 'Africa/Lagos'
      )
    );
  end if;

  v_seed := v_quiz.id || ':' || v_attempt_id::text;

  insert into public.quiz_attempts (
    id,
    user_id,
    lesson_id,
    quiz_id,
    quiz_version,
    mode,
    status,
    seed
  ) values (
    v_attempt_id,
    v_user_id,
    v_lesson.id,
    v_quiz.id,
    v_quiz.version,
    v_mode,
    'in_progress',
    v_seed
  );

  insert into public.quiz_attempt_questions (
    attempt_id,
    question_id,
    question_order,
    question_snapshot,
    options_snapshot,
    xp
  )
  select
    v_attempt_id,
    qq.id,
    row_number() over (order by qq.question_order)::integer,
    jsonb_build_object(
      'id', qq.id,
      'prompt', qq.prompt,
      'type', qq.question_type,
      'xp', qq.xp,
      'order', qq.question_order
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', qo.id,
            'questionId', qo.question_id,
            'label', qo.label,
            'order', qo.option_order
          )
          order by qo.option_order
        )
        from public.quiz_options qo
        where qo.question_id = qq.id
      ),
      '[]'::jsonb
    ),
    qq.xp
  from public.quiz_questions qq
  where qq.id = any(v_question_ids)
  order by qq.question_order;

  select coalesce(sum(xp), 0)
    into v_total_possible_xp
  from public.quiz_attempt_questions
  where attempt_id = v_attempt_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', aq.question_id,
        'quizId', v_quiz.id,
        'prompt', aq.question_snapshot ->> 'prompt',
        'type', aq.question_snapshot ->> 'type',
        'xp', aq.xp,
        'order', aq.question_order,
        'options', aq.options_snapshot
      )
      order by aq.question_order
    ),
    '[]'::jsonb
  )
  into v_questions
  from public.quiz_attempt_questions aq
  where aq.attempt_id = v_attempt_id;

  return jsonb_build_object(
    'status', 'started',
    'attemptId', v_attempt_id,
    'mode', v_mode,
    'questions', v_questions,
    'dailyXpLimit', v_daily_limit,
    'dailyXpRemaining', v_daily_remaining,
    'totalPossibleXp', v_total_possible_xp
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.start_quiz_attempt(p_quiz_id text, p_lesson_id text, p_programme_id uuid, p_organization_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_account_id uuid := '00000000-0000-4000-8000-00000000e001'::uuid;
  v_course_id text;
  v_lesson public.lessons%rowtype;
  v_programme_organization_id uuid;
begin
  select lesson.*
    into v_lesson
  from public.quizzes quiz
  join public.lessons lesson on lesson.id = quiz.lesson_id
  where quiz.id = p_quiz_id;

  if v_lesson.published_snapshot is not null then
    v_lesson := jsonb_populate_record(v_lesson, v_lesson.published_snapshot->'lesson');
  end if;

  v_course_id := v_lesson.course_id;

  if v_course_id is null then
    return public.start_quiz_attempt_legacy(p_quiz_id, p_lesson_id);
  end if;

  if p_programme_id is not null then
    select organization_id
      into v_programme_organization_id
    from public.programmes
    where id = p_programme_id;

    if p_organization_id is not null and p_organization_id <> v_programme_organization_id then
      raise exception 'Programme does not belong to the requested organisation context.' using errcode = '42501';
    end if;

    v_account_id := private.resolve_programme_xp_account(
      v_user_id, p_programme_id, 'course', v_course_id
    );

    if coalesce(v_lesson.quiz_requires_lesson_completion, true)
       and exists (
         select 1
         from public.programme_courses programme_course
         where programme_course.programme_id = p_programme_id
           and programme_course.course_id = v_course_id
           and programme_course.prior_completion_policy = 'require_completion_in_context'
       )
       and not private.programme_lesson_completed_in_context(v_user_id, p_programme_id, v_lesson.id) then
      return jsonb_build_object(
        'status', 'blocked',
        'reason', 'lesson_incomplete',
        'message', 'Complete the lesson pages in this programme before starting the quiz.'
      );
    end if;

    perform set_config('app.xp_account_id', v_account_id::text, true);
    perform set_config('app.xp_programme_id', p_programme_id::text, true);
  elsif p_organization_id is not null then
    v_account_id := private.resolve_organization_delivery_xp_account(v_user_id, p_organization_id, v_course_id);
    perform set_config('app.xp_account_id', v_account_id::text, true);
    perform set_config('app.xp_programme_id', '', true);
  end if;

  begin
    v_result := public.start_quiz_attempt_legacy(p_quiz_id, p_lesson_id);
  exception when others then
    perform set_config('app.xp_account_id', '', true);
    perform set_config('app.xp_programme_id', '', true);
    raise;
  end;

  perform set_config('app.xp_account_id', '', true);
  perform set_config('app.xp_programme_id', '', true);

  return v_result || jsonb_build_object(
    'organizationId', p_organization_id,
    'programmeId', p_programme_id,
    'xpAccountId', v_account_id
  );
end;
$function$;

insert into private.rpc_security_classifications
(function_schema, function_name, identity_arguments, classification, intended_callers, authorization_rule, execute_roles)
values ('public','current_user_can_read_published_lesson','p_lesson_id text','PUBLIC_ANON_READ',
 'Published lesson views and quiz authorization.',
 'Requires published snapshot, published lesson/course, and current_user_can_read_course.', array['anon','authenticated','service_role']);
-- Completion rollups and mission awards must agree with the published page set.
CREATE OR REPLACE FUNCTION public.award_valid_mission_xp(p_mission_id text, p_award_scope text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_valid boolean := false;
  v_lesson_id text;
  v_course_id text;
  v_required_count integer;
  v_within_days integer;
  v_total_lessons integer;
  v_completed_lessons integer;
  v_referred_user_id uuid;
  v_minimum_account_age_hours integer := 24;
  v_required_fields text[];
  v_requires_manual_review boolean;
  v_requirement_mode text := 'all';
  v_programme_id uuid;
  v_programme public.programmes%rowtype;
  v_programme_mission public.programme_missions%rowtype;
  v_metadata jsonb := '{}'::jsonb;
  v_award_scope_payload text := p_award_scope;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_mission
    from public.missions
   where id = p_mission_id
     and status = 'published'
     and (starts_at is null or starts_at <= now())
     and (ends_at is null or ends_at > now());

  if v_mission.id is null then
    raise exception 'Mission not found.';
  end if;

  if p_award_scope ~ '^programme:' then
    v_programme_id := split_part(p_award_scope, ':', 2)::uuid;

    select *
      into v_programme
    from public.programmes
    where id = v_programme_id
      and status = 'published';

    if not found or not public.current_user_can_read_programme(v_programme.id) then
      raise exception 'Programme mission context is not available.';
    end if;

    select *
      into v_programme_mission
    from public.programme_missions
    where programme_id = v_programme_id
      and mission_id = p_mission_id;

    if not found then
      raise exception 'Programme mission context is not available.';
    end if;

    if v_programme_mission.starts_at is not null and v_programme_mission.starts_at > now() then
      raise exception 'Programme mission is not available yet.';
    end if;

    if v_programme_mission.due_at is not null and v_programme_mission.due_at <= now() then
      raise exception 'Programme mission is past its due date.';
    end if;

    v_metadata := jsonb_build_object(
      'organizationId', v_programme.organization_id,
      'programmeId', v_programme.id,
      'programmeMissionId', v_programme_mission.mission_id,
      'xpAccountId', v_programme_mission.xp_account_id,
      'rewardXpOverride', v_programme_mission.reward_xp_override
    );
    v_award_scope_payload := regexp_replace(p_award_scope, '^programme:[^:]+:', '');
  end if;

  case v_mission.validation_type
    when 'lesson_completed' then
      v_lesson_id := v_mission.validation_config ->> 'lessonId';

      select exists (
        select 1
        from public.lessons lesson
        join public.courses course
          on course.id = lesson.course_id
        where lesson.id = v_lesson_id
          and lesson.status = 'published' and lesson.published_snapshot is not null
          and course.status = 'published'
          and (
            v_programme_id is null
            or exists (
              select 1
              from public.programme_courses programme_course
              where programme_course.programme_id = v_programme_id
                and programme_course.course_id = lesson.course_id
            )
          )
          and public.lesson_is_complete_for_user(v_user_id, lesson.id)
      )
        into v_valid;

    when 'course_completed' then
      v_course_id := v_mission.validation_config ->> 'courseId';

      select count(*)
        into v_total_lessons
        from public.lessons lesson
        join public.courses course on course.id = lesson.course_id
       where lesson.course_id = v_course_id
         and lesson.status = 'published' and lesson.published_snapshot is not null
         and course.status = 'published'
         and (
           v_programme_id is null
           or exists (
             select 1
             from public.programme_courses programme_course
             where programme_course.programme_id = v_programme_id
               and programme_course.course_id = lesson.course_id
           )
         );

      select count(*)
        into v_completed_lessons
        from public.lessons lesson
        join public.courses course on course.id = lesson.course_id
       where lesson.course_id = v_course_id
         and lesson.status = 'published' and lesson.published_snapshot is not null
         and course.status = 'published'
         and (
           v_programme_id is null
           or exists (
             select 1
             from public.programme_courses programme_course
             where programme_course.programme_id = v_programme_id
               and programme_course.course_id = lesson.course_id
           )
         )
         and public.lesson_is_complete_for_user(v_user_id, lesson.id);

      v_valid := v_total_lessons > 0 and v_completed_lessons >= v_total_lessons;

    when 'lesson_count_completed' then
      v_required_count := greatest(1, coalesce((v_mission.validation_config ->> 'count')::integer, 1));
      v_within_days := nullif(v_mission.validation_config ->> 'withinDays', '')::integer;

      if v_within_days is null then
        select count(*)
          into v_completed_lessons
          from public.lessons lesson
          join public.courses course on course.id = lesson.course_id
         where lesson.status = 'published' and lesson.published_snapshot is not null
           and course.status = 'published'
           and (
             v_programme_id is null
             or exists (
               select 1
               from public.programme_courses programme_course
               where programme_course.programme_id = v_programme_id
                 and programme_course.course_id = lesson.course_id
             )
           )
           and public.lesson_is_complete_for_user(v_user_id, lesson.id);
      else
        select count(distinct progress.lesson_id)
          into v_completed_lessons
          from public.lesson_progress progress
          join public.lessons lesson on lesson.id = progress.lesson_id
          join public.courses course on course.id = lesson.course_id
         where progress.user_id = v_user_id
           and progress.completed_at is not null
           and public.lesson_is_complete_for_user(v_user_id, progress.lesson_id)
           and progress.completed_at >= now() - make_interval(days => v_within_days)
           and lesson.status = 'published' and lesson.published_snapshot is not null
           and course.status = 'published'
           and (
             v_programme_id is null
             or exists (
               select 1
               from public.programme_courses programme_course
               where programme_course.programme_id = v_programme_id
                 and programme_course.course_id = lesson.course_id
             )
           );
      end if;

      v_valid := v_completed_lessons >= v_required_count;

    when 'referral_friend_completed_lessons' then
      v_required_count := greatest(
        1,
        coalesce((v_mission.validation_config ->> 'requiredFriendLessonCount')::integer, 1)
      );
      v_minimum_account_age_hours := greatest(
        0,
        coalesce((v_mission.validation_config ->> 'minimumAccountAgeHours')::integer, 24)
      );

      if v_award_scope_payload !~ '^referral:' then
        raise exception 'Invalid referral award scope.';
      end if;

      v_referred_user_id := replace(v_award_scope_payload, 'referral:', '')::uuid;

      if not exists (
        select 1
          from public.referral_attributions
         where referrer_user_id = v_user_id
           and referred_user_id = v_referred_user_id
           and created_at <= now() - make_interval(hours => v_minimum_account_age_hours)
           and (
             (
               v_programme_id is null
               and organization_id is null
               and programme_id is null
               and programme_mission_id is null
             )
             or (
               v_programme_id is not null
               and organization_id = v_programme.organization_id
               and programme_id = v_programme.id
               and programme_mission_id = v_programme_mission.mission_id
             )
           )
      ) then
        raise exception 'Referral is not eligible yet.';
      end if;

      select count(*)
        into v_completed_lessons
        from public.lessons lesson
        join public.courses course on course.id = lesson.course_id
       where lesson.status = 'published' and lesson.published_snapshot is not null
         and course.status = 'published'
         and (
           v_programme_id is null
           or exists (
             select 1
             from public.programme_courses programme_course
             where programme_course.programme_id = v_programme_id
               and programme_course.course_id = lesson.course_id
           )
         )
         and public.lesson_is_complete_for_user(v_referred_user_id, lesson.id);

      v_valid := v_completed_lessons >= v_required_count;

    when 'proof_upload' then
      select array_agg(value::text)
        into v_required_fields
        from jsonb_array_elements_text(
          coalesce(v_mission.validation_config -> 'requiredFields', '["text"]'::jsonb)
        ) as value;

      v_requires_manual_review :=
        coalesce((v_mission.validation_config ->> 'requiresManualReview')::boolean, false);
      v_requirement_mode :=
        case
          when coalesce(v_mission.validation_config ->> 'requirementMode', 'all') = 'any' then 'any'
          else 'all'
        end;

      if v_requires_manual_review then
        select public.mission_proof_fields_satisfy(
          v_required_fields,
          v_requirement_mode,
          v_user_id,
          v_mission.id,
          p_award_scope,
          array['approved']
        )
          into v_valid;
      else
        select public.mission_proof_fields_satisfy(
          v_required_fields,
          v_requirement_mode,
          v_user_id,
          v_mission.id,
          p_award_scope,
          array['submitted', 'approved']
        )
          into v_valid;
      end if;

    else
      v_valid := false;
  end case;

  v_valid := coalesce(v_valid, false);

  if not v_valid then
    raise exception 'Mission is not complete.';
  end if;

  return public.grant_mission_award(v_user_id, v_mission.id, p_award_scope, v_metadata);
end;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_course_completion_for_user(p_user_id uuid, p_course_id text)
 RETURNS course_completions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_course public.courses%rowtype;
  v_rule public.course_completion_rules%rowtype;
  v_required_lesson_ids text[] := '{}';
  v_required_quiz_ids text[] := '{}';
  v_required_mission_ids text[] := '{}';
  v_completed_lesson_ids text[] := '{}';
  v_completed_quiz_ids text[] := '{}';
  v_completed_mission_ids text[] := '{}';
  v_missing_lesson_ids text[] := '{}';
  v_missing_quiz_ids text[] := '{}';
  v_missing_mission_ids text[] := '{}';
  v_assessment_completed boolean := true;
  v_requirement_count integer := 0;
  v_completed_count integer := 0;
  v_progress_percent integer := 100;
  v_status public.lms_completion_status := 'in_progress';
  v_completed_at timestamptz := null;
  v_result public.course_completions%rowtype;
  v_minimum_quiz_score integer := 0;
  v_minimum_completion_threshold integer := 100;
begin
  if p_user_id is null then
    raise exception 'User is required.';
  end if;

  select *
    into v_course
  from public.courses
  where id = p_course_id;

  if not found then
    raise exception 'Course not found.';
  end if;

  select *
    into v_rule
  from public.course_completion_rules
  where course_id = p_course_id;

  if found then
    v_required_lesson_ids := coalesce(v_rule.required_lesson_ids, '{}');
    v_required_quiz_ids := coalesce(v_rule.required_quiz_ids, '{}');
    v_required_mission_ids := coalesce(v_rule.required_mission_ids, '{}');
    v_minimum_quiz_score := coalesce(v_rule.minimum_quiz_score, 0);
    v_minimum_completion_threshold := coalesce(v_rule.minimum_completion_threshold, 100);
  else
    select coalesce(array_agg(lesson.id order by lesson.sort_order), '{}')::text[]
      into v_required_lesson_ids
    from public.lessons lesson
    where lesson.course_id = p_course_id
      and lesson.status = 'published' and lesson.published_snapshot is not null;

    select coalesce(array_agg(quiz.id order by lesson.sort_order), '{}')::text[]
      into v_required_quiz_ids
    from public.quizzes quiz
    join public.lessons lesson
      on lesson.id = quiz.lesson_id
    where lesson.course_id = p_course_id
      and lesson.status = 'published' and lesson.published_snapshot is not null
      and quiz.status = 'published';
  end if;

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_completed_lesson_ids
  from unnest(v_required_lesson_ids) required_id
  where exists (
    select 1
    from public.lesson_progress progress
    where progress.user_id = p_user_id
      and progress.lesson_id = required_id
      and progress.completed_at is not null
      and public.lesson_is_complete_for_user(p_user_id, progress.lesson_id)
  );

  with attempt_scores as (
    select
      attempt.quiz_id,
      attempt.id,
      case
        when count(answer.id) = 0 then 0
        else round(avg(case when answer.is_correct then 100::numeric else 0::numeric end))::integer
      end as score
    from public.quiz_attempts attempt
    left join public.quiz_answers answer
      on answer.attempt_id = attempt.id
     and answer.user_id = attempt.user_id
    where attempt.user_id = p_user_id
      and attempt.status in ('graded', 'practice_completed', 'daily_cap_reached')
      and attempt.quiz_id = any(v_required_quiz_ids)
    group by attempt.quiz_id, attempt.id
  )
  select coalesce(array_agg(distinct quiz_id order by quiz_id), '{}')::text[]
    into v_completed_quiz_ids
  from attempt_scores
  where score >= v_minimum_quiz_score;

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_completed_mission_ids
  from unnest(v_required_mission_ids) required_id
  where exists (
    select 1
    from public.mission_awards award
    where award.user_id = p_user_id
      and award.mission_id = required_id
  );

  v_assessment_completed := public.user_completed_assessment(
    p_user_id,
    v_rule.required_final_assessment_version_id
  );

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_missing_lesson_ids
  from unnest(v_required_lesson_ids) required_id
  where not required_id = any(v_completed_lesson_ids);

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_missing_quiz_ids
  from unnest(v_required_quiz_ids) required_id
  where not required_id = any(v_completed_quiz_ids);

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_missing_mission_ids
  from unnest(v_required_mission_ids) required_id
  where not required_id = any(v_completed_mission_ids);

  v_requirement_count :=
    coalesce(array_length(v_required_lesson_ids, 1), 0)
    + coalesce(array_length(v_required_quiz_ids, 1), 0)
    + coalesce(array_length(v_required_mission_ids, 1), 0)
    + case when v_rule.required_final_assessment_version_id is not null then 1 else 0 end;
  v_completed_count :=
    coalesce(array_length(v_completed_lesson_ids, 1), 0)
    + coalesce(array_length(v_completed_quiz_ids, 1), 0)
    + coalesce(array_length(v_completed_mission_ids, 1), 0)
    + case when v_rule.required_final_assessment_version_id is not null and v_assessment_completed then 1 else 0 end;
  v_progress_percent := case
    when v_requirement_count = 0 then 100
    else least(100, greatest(0, round((v_completed_count::numeric / v_requirement_count::numeric) * 100)::integer))
  end;
  v_status := case
    when v_progress_percent >= v_minimum_completion_threshold
      and v_assessment_completed
      then 'completed'::public.lms_completion_status
    else 'in_progress'::public.lms_completion_status
  end;

  select completed_at
    into v_completed_at
  from public.course_completions
  where user_id = p_user_id
    and course_id = p_course_id;

  if v_status = 'completed' then
    v_completed_at := coalesce(v_completed_at, now());
  else
    v_completed_at := null;
  end if;

  insert into public.course_completions (
    organization_id,
    user_id,
    course_id,
    status,
    progress_percent,
    completed_required_lessons,
    completed_required_quizzes,
    completed_required_missions,
    missing_requirements,
    completed_at,
    evaluated_at,
    metadata
  )
  values (
    v_course.organization_id,
    p_user_id,
    p_course_id,
    v_status,
    v_progress_percent,
    v_completed_lesson_ids,
    v_completed_quiz_ids,
    v_completed_mission_ids,
    jsonb_build_object(
      'lessonIds', v_missing_lesson_ids,
      'quizIds', v_missing_quiz_ids,
      'missionIds', v_missing_mission_ids,
      'assessmentVersionId', case when v_assessment_completed then null else v_rule.required_final_assessment_version_id end
    ),
    v_completed_at,
    now(),
    jsonb_build_object(
      'requiredLessonIds', v_required_lesson_ids,
      'requiredQuizIds', v_required_quiz_ids,
      'requiredMissionIds', v_required_mission_ids,
      'minimumQuizScore', v_minimum_quiz_score,
      'minimumCompletionThreshold', v_minimum_completion_threshold,
      'requiredFinalAssessmentVersionId', v_rule.required_final_assessment_version_id
    )
  )
  on conflict (user_id, course_id) do update
    set organization_id = excluded.organization_id,
        status = excluded.status,
        progress_percent = excluded.progress_percent,
        completed_required_lessons = excluded.completed_required_lessons,
        completed_required_quizzes = excluded.completed_required_quizzes,
        completed_required_missions = excluded.completed_required_missions,
        missing_requirements = excluded.missing_requirements,
        completed_at = excluded.completed_at,
        evaluated_at = excluded.evaluated_at,
        metadata = excluded.metadata
  returning *
    into v_result;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.record_programme_course_completion(p_user_id uuid, p_programme_id uuid, p_course_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_programme public.programmes%rowtype;
  v_course_link public.programme_courses%rowtype;
  v_rule public.course_completion_rules%rowtype;
  v_public_completion public.course_completions%rowtype;
  v_required_lesson_ids text[] := '{}';
  v_required_quiz_ids text[] := '{}';
  v_required_mission_ids text[] := '{}';
  v_completed_lessons integer := 0;
  v_completed_quizzes integer := 0;
  v_completed_missions integer := 0;
  v_requirements integer := 0;
  v_completed integer := 0;
  v_progress integer := 0;
  v_contextual_activity boolean := false;
  v_assessment_completed boolean := true;
  v_completed_at timestamptz;
begin
  select * into v_programme from public.programmes where id = p_programme_id;
  select * into v_course_link
  from public.programme_courses
  where programme_id = p_programme_id and course_id = p_course_id;

  if v_programme.id is null or v_course_link.programme_id is null then
    raise exception 'Programme course context is invalid.';
  end if;

  if not exists (
    select 1 from public.enrolments
    where user_id = p_user_id and programme_id = p_programme_id
      and status in ('active', 'completed')
  ) then
    raise exception 'Active programme enrolment is required.' using errcode = '42501';
  end if;

  select * into v_rule from public.course_completion_rules where course_id = p_course_id;
  if v_rule.course_id is null then
    select coalesce(array_agg(lesson.id order by lesson.sort_order), '{}')::text[]
      into v_required_lesson_ids
    from public.lessons lesson
    where lesson.course_id = p_course_id and lesson.status = 'published' and lesson.published_snapshot is not null;

    select coalesce(array_agg(quiz.id order by lesson.sort_order), '{}')::text[]
      into v_required_quiz_ids
    from public.quizzes quiz
    join public.lessons lesson on lesson.id = quiz.lesson_id
    where lesson.course_id = p_course_id
      and lesson.status = 'published' and lesson.published_snapshot is not null
      and quiz.status = 'published';
  else
    v_required_lesson_ids := coalesce(v_rule.required_lesson_ids, '{}');
    v_required_quiz_ids := coalesce(v_rule.required_quiz_ids, '{}');
    v_required_mission_ids := coalesce(v_rule.required_mission_ids, '{}');
  end if;

  if v_course_link.prior_completion_policy = 'recognize_prior_completion' then
    select * into v_public_completion
    from public.course_completions
    where user_id = p_user_id and course_id = p_course_id;

    if v_public_completion.id is null then
      v_public_completion := public.upsert_course_completion_for_user(p_user_id, p_course_id);
    end if;

    insert into public.programme_course_completions (
      organization_id, user_id, programme_id, course_id, status,
      progress_percent, completed_at, evaluated_at, metadata
    ) values (
      v_programme.organization_id, p_user_id, p_programme_id, p_course_id,
      v_public_completion.status, v_public_completion.progress_percent,
      v_public_completion.completed_at, now(),
      jsonb_build_object('priorCompletionPolicy', v_course_link.prior_completion_policy, 'source', 'public_completion')
    )
    on conflict (user_id, programme_id, course_id) do update
      set status = excluded.status,
          progress_percent = excluded.progress_percent,
          completed_at = excluded.completed_at,
          evaluated_at = excluded.evaluated_at,
          metadata = excluded.metadata;
    return;
  end if;

  select count(*) into v_completed_lessons
  from unnest(v_required_lesson_ids) required_id
  where private.programme_lesson_completed_in_context(p_user_id, p_programme_id, required_id);

  select count(*) into v_completed_quizzes
  from unnest(v_required_quiz_ids) required_id
  where exists (
    select 1 from public.quiz_attempts attempt
    where attempt.user_id = p_user_id
      and attempt.programme_id = p_programme_id
      and attempt.quiz_id = required_id
      and attempt.status in ('graded', 'practice_completed', 'daily_cap_reached')
  );

  select count(*) into v_completed_missions
  from unnest(v_required_mission_ids) required_id
  where exists (
    select 1 from public.mission_awards award
    where award.user_id = p_user_id
      and award.programme_id = p_programme_id
      and award.mission_id = required_id
  );

  v_contextual_activity := exists (
    select 1 from public.programme_lesson_page_completions completion
    join public.lessons lesson on lesson.id = completion.lesson_id
    where completion.user_id = p_user_id
      and completion.programme_id = p_programme_id
      and lesson.course_id = p_course_id
  ) or exists (
    select 1 from public.quiz_attempts attempt
    join public.quizzes quiz on quiz.id = attempt.quiz_id
    join public.lessons lesson on lesson.id = quiz.lesson_id
    where attempt.user_id = p_user_id
      and attempt.programme_id = p_programme_id
      and lesson.course_id = p_course_id
  ) or exists (
    select 1 from public.user_assessment_attempts attempt
    where attempt.user_id = p_user_id and attempt.programme_id = p_programme_id
      and v_rule.required_final_assessment_version_id is not null
      and attempt.assessment_version_id = v_rule.required_final_assessment_version_id
  ) or exists (
    select 1 from public.mission_awards award
    where award.user_id = p_user_id
      and award.programme_id = p_programme_id
      and award.mission_id = any(v_required_mission_ids)
  );

  if v_rule.required_final_assessment_version_id is not null then
    v_assessment_completed := exists (
      select 1 from public.user_assessment_attempts attempt
      where attempt.user_id = p_user_id
        and attempt.programme_id = p_programme_id
        and attempt.assessment_version_id = v_rule.required_final_assessment_version_id
        and attempt.status = 'completed'
    );
  end if;

  v_requirements := coalesce(array_length(v_required_lesson_ids, 1), 0)
    + coalesce(array_length(v_required_quiz_ids, 1), 0)
    + coalesce(array_length(v_required_mission_ids, 1), 0)
    + case when v_rule.required_final_assessment_version_id is not null then 1 else 0 end;
  v_completed := v_completed_lessons + v_completed_quizzes + v_completed_missions
    + case when v_rule.required_final_assessment_version_id is not null and v_assessment_completed then 1 else 0 end;
  v_progress := case when v_requirements = 0 then 0 else least(100, round(v_completed::numeric / v_requirements * 100)::integer) end;

  if v_contextual_activity and v_requirements = v_completed then
    v_completed_at := now();
  end if;

  insert into public.programme_course_completions (
    organization_id, user_id, programme_id, course_id, status,
    progress_percent, completed_at, evaluated_at, metadata
  ) values (
    v_programme.organization_id, p_user_id, p_programme_id, p_course_id,
    case when v_completed_at is not null then 'completed' else 'in_progress' end::public.lms_completion_status,
    v_progress, v_completed_at, now(),
    jsonb_build_object(
      'priorCompletionPolicy', v_course_link.prior_completion_policy,
      'contextualActivity', v_contextual_activity,
      'completedLessons', v_completed_lessons,
      'completedQuizzes', v_completed_quizzes,
      'completedMissions', v_completed_missions
    )
  )
  on conflict (user_id, programme_id, course_id) do update
    set status = excluded.status,
        progress_percent = excluded.progress_percent,
        completed_at = excluded.completed_at,
        evaluated_at = excluded.evaluated_at,
        metadata = excluded.metadata;
end;
$function$;

notify pgrst, 'reload schema';
commit;
