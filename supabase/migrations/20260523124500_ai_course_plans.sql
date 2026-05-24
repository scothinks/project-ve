create table if not exists public.ai_course_plans (
  id uuid primary key default gen_random_uuid(),
  mode text not null,
  course_id text references public.courses(id) on delete cascade,
  status text not null default 'draft',
  input_prompt text not null,
  generated_plan jsonb not null default '{}'::jsonb,
  selected_items jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_course_plans_mode_check
    check (mode in ('new_course', 'expand_course')),
  constraint ai_course_plans_status_check
    check (status in ('draft', 'selected', 'dismissed', 'used'))
);

create index if not exists ai_course_plans_course_id_idx on public.ai_course_plans (course_id);
create index if not exists ai_course_plans_mode_status_idx on public.ai_course_plans (mode, status);
create index if not exists ai_course_plans_created_at_idx on public.ai_course_plans (created_at desc);

drop trigger if exists ai_course_plans_set_updated_at on public.ai_course_plans;
create trigger ai_course_plans_set_updated_at
  before update on public.ai_course_plans
  for each row execute function public.set_updated_at();

alter table public.ai_course_plans enable row level security;

drop policy if exists "Admins can read AI course plans" on public.ai_course_plans;
create policy "Admins can read AI course plans"
  on public.ai_course_plans for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can insert AI course plans" on public.ai_course_plans;
create policy "Admins can insert AI course plans"
  on public.ai_course_plans for insert
  with check (public.current_user_is_admin());

drop policy if exists "Admins can update AI course plans" on public.ai_course_plans;
create policy "Admins can update AI course plans"
  on public.ai_course_plans for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());
