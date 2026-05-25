create table if not exists public.content_value_tags (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('course', 'lesson', 'mission')),
  content_id text not null,
  dimension_id text not null references public.value_dimensions(id),
  weight numeric not null default 1 check (weight > 0 and weight <= 1),
  recommended_level text check (
    recommended_level is null
    or recommended_level in ('beginner', 'intermediate', 'advanced')
  ),
  outcome_type text check (
    outcome_type is null
    or outcome_type in ('awareness', 'reflection', 'practice', 'action', 'assessment')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_type, content_id, dimension_id)
);

create index if not exists content_value_tags_content_idx
  on public.content_value_tags (content_type, content_id);

create index if not exists content_value_tags_dimension_idx
  on public.content_value_tags (dimension_id);

create index if not exists content_value_tags_recommended_level_idx
  on public.content_value_tags (recommended_level);

create index if not exists content_value_tags_outcome_type_idx
  on public.content_value_tags (outcome_type);

drop trigger if exists content_value_tags_set_updated_at on public.content_value_tags;
create trigger content_value_tags_set_updated_at
  before update on public.content_value_tags
  for each row execute function public.set_updated_at();

alter table public.content_value_tags enable row level security;

drop policy if exists "Published content value tags are readable" on public.content_value_tags;
create policy "Published content value tags are readable"
  on public.content_value_tags for select
  using (
    case
      when content_type = 'course' then exists (
        select 1
        from public.courses
        where id = content_value_tags.content_id
          and status = 'published'
      )
      when content_type = 'lesson' then exists (
        select 1
        from public.lessons
        join public.courses
          on courses.id = lessons.course_id
        where lessons.id = content_value_tags.content_id
          and lessons.status = 'published'
          and courses.status = 'published'
      )
      when content_type = 'mission' then exists (
        select 1
        from public.missions
        where id = content_value_tags.content_id
          and status = 'published'
      )
      else false
    end
  );

drop policy if exists "Admins can read all content value tags" on public.content_value_tags;
create policy "Admins can read all content value tags"
  on public.content_value_tags for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can insert content value tags" on public.content_value_tags;
create policy "Admins can insert content value tags"
  on public.content_value_tags for insert
  with check (public.current_user_is_admin());

drop policy if exists "Admins can update content value tags" on public.content_value_tags;
create policy "Admins can update content value tags"
  on public.content_value_tags for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Admins can delete content value tags" on public.content_value_tags;
create policy "Admins can delete content value tags"
  on public.content_value_tags for delete
  using (public.current_user_is_admin());

insert into public.content_value_tags (
  content_type,
  content_id,
  dimension_id,
  weight,
  recommended_level,
  outcome_type
)
select *
from (
  values
    ('course', 'course-money-basics', 'integrity', 0.8::numeric, 'beginner', 'awareness'),
    ('course', 'course-money-basics', 'self_awareness', 0.7::numeric, 'beginner', 'reflection'),
    ('lesson', 'lesson-starter-budget', 'integrity', 0.9::numeric, 'beginner', 'practice'),
    ('lesson', 'lesson-starter-budget', 'self_awareness', 0.6::numeric, 'beginner', 'reflection'),
    ('course', 'course-digital-safety', 'digital_responsibility', 0.9::numeric, 'beginner', 'awareness'),
    ('course', 'course-digital-safety', 'critical_judgment', 0.7::numeric, 'beginner', 'reflection'),
    ('lesson', 'lesson-avoid-scams', 'digital_responsibility', 0.9::numeric, 'beginner', 'practice'),
    ('lesson', 'lesson-avoid-scams', 'critical_judgment', 0.8::numeric, 'beginner', 'awareness'),
    ('mission', 'mission-complete-starter-budget', 'self_awareness', 0.7::numeric, 'beginner', 'action'),
    ('mission', 'mission-complete-money-basics', 'integrity', 0.8::numeric, 'beginner', 'action'),
    ('mission', 'mission-local-feedback', 'community_action', 0.8::numeric, 'beginner', 'action')
) as seed(content_type, content_id, dimension_id, weight, recommended_level, outcome_type)
where exists (
  select 1
  from public.value_dimensions
  where id = seed.dimension_id
)
and case
  when seed.content_type = 'course' then exists (
    select 1 from public.courses
    where id = seed.content_id
  )
  when seed.content_type = 'lesson' then exists (
    select 1 from public.lessons
    where id = seed.content_id
  )
  when seed.content_type = 'mission' then exists (
    select 1 from public.missions
    where id = seed.content_id
  )
  else false
end
on conflict (content_type, content_id, dimension_id) do update
  set weight = excluded.weight,
      recommended_level = excluded.recommended_level,
      outcome_type = excluded.outcome_type,
      updated_at = now();
