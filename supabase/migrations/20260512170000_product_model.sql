create extension if not exists pgcrypto;

do $$ begin
  create type public.course_level as enum ('beginner', 'intermediate', 'advanced');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.content_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lesson_page_type as enum ('primer', 'concept', 'example', 'reflection', 'summary');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lesson_content_block_type as enum ('text', 'image', 'video', 'audio', 'table', 'callout');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lesson_retry_mode as enum ('disabled', 'anytime', 'cooldown');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.quiz_question_type as enum ('single_choice', 'multiple_choice', 'true_false');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.quiz_attempt_mode as enum ('earning', 'practice');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.quiz_attempt_status as enum (
    'in_progress',
    'graded',
    'daily_cap_reached',
    'practice_completed',
    'abandoned'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.quiz_answer_status as enum (
    'earned',
    'missed',
    'already_earned',
    'daily_cap_deferred',
    'practice'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.xp_source_type as enum (
    'quiz_question',
    'mission',
    'reward_redemption',
    'adjustment'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.xp_direction as enum ('earn', 'spend');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mission_category as enum ('course', 'referral', 'feedback', 'campaign', 'custom');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mission_repeatability as enum ('once', 'daily', 'weekly', 'campaign', 'per_referral');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mission_validation_type as enum (
    'course_completed',
    'lesson_completed',
    'lesson_count_completed',
    'referral_friend_completed_lessons',
    'proof_upload',
    'manual_review'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mission_proof_type as enum ('image', 'video', 'text', 'link', 'location');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.review_status as enum ('submitted', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.referral_status as enum ('signed_up', 'in_progress', 'qualified', 'awarded', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.redemption_status as enum ('requested', 'approved', 'fulfilled', 'rejected', 'cancelled');
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  referral_code text unique,
  xp integer not null default 0 check (xp >= 0),
  xp_balance_cached integer not null default 0 check (xp_balance_cached >= 0),
  role text not null default 'learner' check (role in ('learner', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists xp_balance_cached integer not null default 0 check (xp_balance_cached >= 0);
alter table public.profiles add column if not exists role text not null default 'learner' check (role in ('learner', 'admin'));
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create or replace function public.generate_referral_code(user_id uuid)
returns text
language sql
stable
as $$
  select 've-' || lower(substr(replace(user_id::text, '-', ''), 1, 12));
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, referral_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    public.generate_referral_code(new.id)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.courses (
  id text primary key,
  slug text not null unique,
  title text not null,
  description text not null,
  category text not null,
  level public.course_level not null default 'beginner',
  thumbnail jsonb,
  status public.content_status not null default 'draft',
  sort_order integer not null default 0,
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id text primary key,
  course_id text not null references public.courses(id) on delete cascade,
  slug text not null,
  title text not null,
  subtitle text,
  description text,
  cover_image jsonb,
  status public.content_status not null default 'draft',
  sort_order integer not null default 0,
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  retry_mode public.lesson_retry_mode not null default 'anytime',
  retry_cooldown_seconds integer check (retry_cooldown_seconds is null or retry_cooldown_seconds >= 0),
  retry_requires_reread boolean not null default true,
  quiz_requires_lesson_completion boolean not null default true,
  max_earning_attempts integer check (max_earning_attempts is null or max_earning_attempts > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug)
);

create table if not exists public.lesson_pages (
  id text primary key,
  lesson_id text not null references public.lessons(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  title text not null,
  subtitle text,
  page_type public.lesson_page_type not null default 'concept',
  cover_image jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, page_number)
);

create table if not exists public.lesson_content_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id text not null references public.lesson_pages(id) on delete cascade,
  block_type public.lesson_content_block_type not null,
  sort_order integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id, sort_order)
);

create table if not exists public.quizzes (
  id text primary key,
  lesson_id text not null unique references public.lessons(id) on delete cascade,
  title text not null,
  version integer not null default 1 check (version > 0),
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id text primary key,
  quiz_id text not null references public.quizzes(id) on delete cascade,
  question_order integer not null check (question_order > 0),
  question_type public.quiz_question_type not null,
  prompt text not null,
  explanation text,
  xp integer not null check (xp > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, question_order)
);

create table if not exists public.quiz_options (
  id text primary key,
  question_id text not null references public.quiz_questions(id) on delete cascade,
  option_order integer not null check (option_order > 0),
  label text not null,
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, option_order)
);

create table if not exists public.lesson_page_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,
  page_id text not null references public.lesson_pages(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id, page_id)
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,
  completed_pages text[] not null default '{}',
  completed_modules text[] not null default '{}',
  quiz_score integer,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

alter table public.lesson_progress add column if not exists completed_pages text[] not null default '{}';
alter table public.lesson_progress add column if not exists started_at timestamptz not null default now();
alter table public.lesson_progress add column if not exists completed_at timestamptz;

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,
  quiz_id text not null references public.quizzes(id) on delete cascade,
  quiz_version integer not null check (quiz_version > 0),
  mode public.quiz_attempt_mode not null default 'earning',
  status public.quiz_attempt_status not null default 'in_progress',
  seed text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_attempt_questions (
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id text not null references public.quiz_questions(id),
  question_order integer not null check (question_order > 0),
  question_snapshot jsonb not null,
  options_snapshot jsonb not null,
  xp integer not null check (xp > 0),
  primary key (attempt_id, question_id)
);

create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null references public.quiz_questions(id),
  selected_option_ids text[] not null default '{}',
  is_correct boolean not null,
  earned_xp integer not null default 0 check (earned_xp >= 0),
  status public.quiz_answer_status not null,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table if not exists public.user_daily_xp_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  timezone text not null default 'Africa/Lagos',
  earnable_quiz_xp_limit integer not null default 30 check (earnable_quiz_xp_limit >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

create table if not exists public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  direction public.xp_direction not null,
  source_type public.xp_source_type not null,
  source_id text not null,
  award_scope text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists xp_transactions_unique_award_scope
  on public.xp_transactions (user_id, award_scope)
  where direction = 'earn' and award_scope is not null;

create table if not exists public.missions (
  id text primary key,
  title text not null,
  description text not null,
  category public.mission_category not null,
  reward_xp integer not null check (reward_xp > 0),
  repeatability public.mission_repeatability not null default 'once',
  validation_type public.mission_validation_type not null,
  validation_config jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.content_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.mission_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id text not null references public.missions(id) on delete cascade,
  award_scope text not null,
  xp_transaction_id uuid not null unique references public.xp_transactions(id) on delete restrict,
  awarded_at timestamptz not null default now(),
  unique (user_id, mission_id, award_scope)
);

create table if not exists public.mission_proofs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id text not null references public.missions(id) on delete cascade,
  award_scope text not null,
  proof_type public.mission_proof_type not null,
  value text not null,
  status public.review_status not null default 'submitted',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  status public.referral_status not null default 'signed_up',
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referrer_user_id <> referred_user_id)
);

create index if not exists referral_attributions_referrer_idx
  on public.referral_attributions (referrer_user_id);

create table if not exists public.rewards (
  id text primary key,
  title text not null,
  description text,
  cost_xp integer not null check (cost_xp > 0),
  inventory_count integer check (inventory_count is null or inventory_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id text not null references public.rewards(id) on delete restrict,
  status public.redemption_status not null default 'requested',
  xp_transaction_id uuid unique references public.xp_transactions(id) on delete restrict,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  fulfilled_at timestamptz,
  notes text
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lesson_pages_lesson_idx on public.lesson_pages (lesson_id, page_number);
create index if not exists lesson_blocks_page_idx on public.lesson_content_blocks (page_id, sort_order);
create index if not exists quiz_questions_quiz_idx on public.quiz_questions (quiz_id, question_order);
create index if not exists quiz_options_question_idx on public.quiz_options (question_id, option_order);
create index if not exists quiz_attempts_user_lesson_idx on public.quiz_attempts (user_id, lesson_id, started_at desc);
create index if not exists quiz_answers_user_question_idx on public.quiz_answers (user_id, question_id);
create index if not exists xp_transactions_user_created_idx on public.xp_transactions (user_id, created_at desc);
create index if not exists mission_awards_user_idx on public.mission_awards (user_id, mission_id);
create index if not exists mission_proofs_user_idx on public.mission_proofs (user_id, mission_id, created_at desc);
create index if not exists reward_redemptions_user_idx on public.reward_redemptions (user_id, requested_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

drop trigger if exists lesson_pages_set_updated_at on public.lesson_pages;
create trigger lesson_pages_set_updated_at
  before update on public.lesson_pages
  for each row execute function public.set_updated_at();

drop trigger if exists lesson_content_blocks_set_updated_at on public.lesson_content_blocks;
create trigger lesson_content_blocks_set_updated_at
  before update on public.lesson_content_blocks
  for each row execute function public.set_updated_at();

drop trigger if exists quizzes_set_updated_at on public.quizzes;
create trigger quizzes_set_updated_at
  before update on public.quizzes
  for each row execute function public.set_updated_at();

drop trigger if exists quiz_questions_set_updated_at on public.quiz_questions;
create trigger quiz_questions_set_updated_at
  before update on public.quiz_questions
  for each row execute function public.set_updated_at();

drop trigger if exists quiz_options_set_updated_at on public.quiz_options;
create trigger quiz_options_set_updated_at
  before update on public.quiz_options
  for each row execute function public.set_updated_at();

drop trigger if exists lesson_progress_set_updated_at on public.lesson_progress;
create trigger lesson_progress_set_updated_at
  before update on public.lesson_progress
  for each row execute function public.set_updated_at();

drop trigger if exists missions_set_updated_at on public.missions;
create trigger missions_set_updated_at
  before update on public.missions
  for each row execute function public.set_updated_at();

drop trigger if exists mission_proofs_set_updated_at on public.mission_proofs;
create trigger mission_proofs_set_updated_at
  before update on public.mission_proofs
  for each row execute function public.set_updated_at();

drop trigger if exists referral_attributions_set_updated_at on public.referral_attributions;
create trigger referral_attributions_set_updated_at
  before update on public.referral_attributions
  for each row execute function public.set_updated_at();

drop trigger if exists rewards_set_updated_at on public.rewards;
create trigger rewards_set_updated_at
  before update on public.rewards
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_pages enable row level security;
alter table public.lesson_content_blocks enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.lesson_page_completions enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_questions enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.user_daily_xp_limits enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.missions enable row level security;
alter table public.mission_awards enable row level security;
alter table public.mission_proofs enable row level security;
alter table public.referral_attributions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can read their profile"
  on public.profiles for select
  using (auth.uid() = id);
create policy "Users can update their profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Published courses are readable" on public.courses;
create policy "Published courses are readable"
  on public.courses for select
  using (status = 'published');

drop policy if exists "Published lessons are readable" on public.lessons;
create policy "Published lessons are readable"
  on public.lessons for select
  using (
    status = 'published'
    and exists (
      select 1 from public.courses c
      where c.id = lessons.course_id and c.status = 'published'
    )
  );

drop policy if exists "Published lesson pages are readable" on public.lesson_pages;
create policy "Published lesson pages are readable"
  on public.lesson_pages for select
  using (
    exists (
      select 1
      from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.id = lesson_pages.lesson_id
        and l.status = 'published'
        and c.status = 'published'
    )
  );

drop policy if exists "Published lesson blocks are readable" on public.lesson_content_blocks;
create policy "Published lesson blocks are readable"
  on public.lesson_content_blocks for select
  using (
    exists (
      select 1
      from public.lesson_pages p
      join public.lessons l on l.id = p.lesson_id
      join public.courses c on c.id = l.course_id
      where p.id = lesson_content_blocks.page_id
        and l.status = 'published'
        and c.status = 'published'
    )
  );

drop policy if exists "Published quizzes are readable" on public.quizzes;
create policy "Published quizzes are readable"
  on public.quizzes for select
  using (
    status = 'published'
    and exists (
      select 1 from public.lessons l
      where l.id = quizzes.lesson_id and l.status = 'published'
    )
  );

drop policy if exists "Users can read their lesson progress" on public.lesson_progress;
drop policy if exists "Users can write their lesson progress" on public.lesson_progress;
drop policy if exists "Users can update their lesson progress" on public.lesson_progress;
create policy "Users can read their lesson progress"
  on public.lesson_progress for select
  using (auth.uid() = user_id);
create policy "Users can write their lesson progress"
  on public.lesson_progress for insert
  with check (auth.uid() = user_id);
create policy "Users can update their lesson progress"
  on public.lesson_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read their page completions" on public.lesson_page_completions;
drop policy if exists "Users can write their page completions" on public.lesson_page_completions;
create policy "Users can read their page completions"
  on public.lesson_page_completions for select
  using (auth.uid() = user_id);
create policy "Users can write their page completions"
  on public.lesson_page_completions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can read their quiz attempts" on public.quiz_attempts;
create policy "Users can read their quiz attempts"
  on public.quiz_attempts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their attempt questions" on public.quiz_attempt_questions;
create policy "Users can read their attempt questions"
  on public.quiz_attempt_questions for select
  using (
    exists (
      select 1 from public.quiz_attempts a
      where a.id = quiz_attempt_questions.attempt_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists "Users can read their quiz answers" on public.quiz_answers;
create policy "Users can read their quiz answers"
  on public.quiz_answers for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their daily XP limits" on public.user_daily_xp_limits;
create policy "Users can read their daily XP limits"
  on public.user_daily_xp_limits for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their XP transactions" on public.xp_transactions;
create policy "Users can read their XP transactions"
  on public.xp_transactions for select
  using (auth.uid() = user_id);

drop policy if exists "Published missions are readable" on public.missions;
create policy "Published missions are readable"
  on public.missions for select
  using (
    status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists "Users can read their mission awards" on public.mission_awards;
create policy "Users can read their mission awards"
  on public.mission_awards for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their mission proofs" on public.mission_proofs;
drop policy if exists "Users can submit mission proofs" on public.mission_proofs;
create policy "Users can read their mission proofs"
  on public.mission_proofs for select
  using (auth.uid() = user_id);
create policy "Users can submit mission proofs"
  on public.mission_proofs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can read their referrals" on public.referral_attributions;
create policy "Users can read their referrals"
  on public.referral_attributions for select
  using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);

drop policy if exists "Published rewards are readable" on public.rewards;
create policy "Published rewards are readable"
  on public.rewards for select
  using (
    status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists "Users can read their redemptions" on public.reward_redemptions;
create policy "Users can read their redemptions"
  on public.reward_redemptions for select
  using (auth.uid() = user_id);
