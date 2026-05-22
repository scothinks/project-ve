create table if not exists public.xp_settings (
  id integer primary key default 1 check (id = 1),
  default_daily_quiz_xp_limit integer not null default 50 check (default_daily_quiz_xp_limit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.xp_settings (id, default_daily_quiz_xp_limit)
values (1, 50)
on conflict (id) do nothing;

alter table public.user_daily_xp_limits
  alter column earnable_quiz_xp_limit set default 50;

alter table public.xp_settings enable row level security;

drop policy if exists "Authenticated users can read XP settings" on public.xp_settings;
create policy "Authenticated users can read XP settings"
  on public.xp_settings for select
  using (auth.uid() is not null);

drop policy if exists "Admins can insert XP settings" on public.xp_settings;
create policy "Admins can insert XP settings"
  on public.xp_settings for insert
  with check (public.current_user_is_admin());

drop policy if exists "Admins can update XP settings" on public.xp_settings;
create policy "Admins can update XP settings"
  on public.xp_settings for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.answer_quiz_question(
  p_attempt_id uuid,
  p_question_id text,
  p_selected_option_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.quiz_attempts%rowtype;
  v_question_xp integer;
  v_attempt_question_count integer;
  v_answered_count integer;
  v_correct_option_ids text[];
  v_selected_option_ids text[];
  v_has_invalid_option boolean;
  v_is_correct boolean;
  v_already_awarded boolean;
  v_daily_limit integer := 50;
  v_daily_earned integer := 0;
  v_daily_remaining integer := 0;
  v_status public.quiz_answer_status;
  v_earned_xp integer := 0;
  v_base_earned_xp integer := 0;
  v_boost_bonus_xp integer := 0;
  v_answer_correct boolean;
  v_award_scope text := 'quiz_question:' || p_question_id;
  v_completed boolean := false;
  v_attempt_status public.quiz_attempt_status;
  v_boost public.user_xp_boosts%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_attempt
    from public.quiz_attempts
   where id = p_attempt_id
     and user_id = v_user_id
   for update;

  if v_attempt.id is null or v_attempt.status <> 'in_progress' then
    raise exception 'Attempt is not active.';
  end if;

  if exists (
    select 1 from public.quiz_answers
    where attempt_id = p_attempt_id and question_id = p_question_id
  ) then
    raise exception 'This question has already been answered.';
  end if;

  select xp
    into v_question_xp
    from public.quiz_attempt_questions
   where attempt_id = p_attempt_id
     and question_id = p_question_id;

  if v_question_xp is null then
    raise exception 'Question is not part of this attempt.';
  end if;

  select coalesce(array_agg(distinct option_id order by option_id), '{}'::text[])
    into v_selected_option_ids
    from unnest(coalesce(p_selected_option_ids, '{}'::text[])) as option_id;

  if coalesce(array_length(v_selected_option_ids, 1), 0) = 0 then
    raise exception 'At least one selected option is required.';
  end if;

  select exists (
    select 1
      from unnest(v_selected_option_ids) selected(option_id)
     where not exists (
       select 1 from public.quiz_options o
        where o.id = selected.option_id
          and o.question_id = p_question_id
     )
  )
    into v_has_invalid_option;

  if v_has_invalid_option then
    raise exception 'One or more selected options do not belong to this question.';
  end if;

  select coalesce(array_agg(id order by id), '{}'::text[])
    into v_correct_option_ids
    from public.quiz_options
   where question_id = p_question_id
     and is_correct = true;

  v_is_correct := v_selected_option_ids = v_correct_option_ids;
  v_answer_correct := v_is_correct;

  select exists (
    select 1 from public.xp_transactions
     where user_id = v_user_id
       and direction = 'earn'
       and award_scope = v_award_scope
  )
    into v_already_awarded;

  select coalesce(
    (
      select earnable_quiz_xp_limit
        from public.user_daily_xp_limits
       where user_id = v_user_id
         and local_date = (now() at time zone 'Africa/Lagos')::date
    ),
    (
      select default_daily_quiz_xp_limit
        from public.xp_settings
       where id = 1
    ),
    50
  )
    into v_daily_limit;

  select coalesce(sum(amount), 0)
    into v_daily_earned
    from public.xp_transactions
   where user_id = v_user_id
     and direction = 'earn'
     and source_type = 'quiz_question'
     and (created_at at time zone 'Africa/Lagos')::date =
       (now() at time zone 'Africa/Lagos')::date;

  v_daily_remaining := greatest(0, v_daily_limit - v_daily_earned);

  update public.user_xp_boosts
     set status = 'expired'
   where user_id = v_user_id
     and status = 'active'
     and ends_at <= now();

  if v_attempt.mode = 'practice' then
    v_status := 'practice';
    v_answer_correct := v_is_correct;
  elsif not v_is_correct then
    v_status := 'missed';
  elsif v_already_awarded then
    v_status := 'already_earned';
  elsif v_daily_remaining < v_question_xp then
    v_status := 'daily_cap_deferred';
    v_answer_correct := false;
  else
    v_status := 'earned';
    v_base_earned_xp := v_question_xp;
    v_earned_xp := v_question_xp;

    select *
      into v_boost
    from public.user_xp_boosts
    where user_id = v_user_id
      and status = 'active'
      and starts_at <= now()
      and ends_at > now()
      and (remaining_uses is null or used_count < remaining_uses)
    order by multiplier desc, ends_at asc
    for update skip locked
    limit 1;

    if v_boost.id is not null then
      v_boost_bonus_xp := greatest(0, floor(v_question_xp * (v_boost.multiplier - 1))::integer);
      v_earned_xp := v_question_xp + v_boost_bonus_xp;
    end if;

    insert into public.xp_transactions (
      user_id,
      amount,
      direction,
      source_type,
      source_id,
      award_scope,
      metadata
    )
    values (
      v_user_id,
      v_base_earned_xp,
      'earn',
      'quiz_question',
      p_question_id,
      v_award_scope,
      jsonb_build_object('attemptId', p_attempt_id, 'quizId', v_attempt.quiz_id)
    );

    if v_boost_bonus_xp > 0 then
      insert into public.xp_transactions (
        user_id,
        amount,
        direction,
        source_type,
        source_id,
        award_scope,
        metadata
      )
      values (
        v_user_id,
        v_boost_bonus_xp,
        'earn',
        'reward_redemption',
        v_boost.redemption_id::text,
        'xp_boost:' || v_boost.id::text || ':' || p_question_id,
        jsonb_build_object('attemptId', p_attempt_id, 'quizId', v_attempt.quiz_id, 'boostId', v_boost.id)
      );

      update public.user_xp_boosts
      set used_count = used_count + 1,
          status = case
            when remaining_uses is not null and used_count + 1 >= remaining_uses then 'consumed'
            else status
          end
      where id = v_boost.id;
    end if;

    update public.profiles
       set xp = xp + v_earned_xp,
           xp_balance_cached = xp_balance_cached + v_earned_xp
     where id = v_user_id;
  end if;

  insert into public.quiz_answers (
    attempt_id,
    user_id,
    question_id,
    selected_option_ids,
    is_correct,
    earned_xp,
    status
  )
  values (
    p_attempt_id,
    v_user_id,
    p_question_id,
    v_selected_option_ids,
    v_answer_correct,
    v_earned_xp,
    v_status
  );

  select count(*)
    into v_attempt_question_count
    from public.quiz_attempt_questions
   where attempt_id = p_attempt_id;

  select count(*)
    into v_answered_count
    from public.quiz_answers
   where attempt_id = p_attempt_id;

  if v_status = 'daily_cap_deferred' then
    v_attempt_status := 'daily_cap_reached';
    v_completed := true;
  elsif v_answered_count >= v_attempt_question_count then
    v_attempt_status := case
      when v_attempt.mode = 'practice' then 'practice_completed'::public.quiz_attempt_status
      else 'graded'::public.quiz_attempt_status
    end;
    v_completed := true;
  end if;

  if v_completed then
    update public.quiz_attempts
       set status = v_attempt_status,
           ended_at = now(),
           ended_reason = v_attempt_status::text
     where id = p_attempt_id;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'completed', v_completed,
    'attemptStatus', coalesce(v_attempt_status::text, 'in_progress'),
    'questionResult', jsonb_build_object(
      'questionId', p_question_id,
      'correct', v_answer_correct,
      'earnedXp', v_earned_xp,
      'status', v_status,
      'boostBonusXp', v_boost_bonus_xp
    ),
    'dailyXpLimit', v_daily_limit,
    'dailyXpRemaining', greatest(0, v_daily_limit - v_daily_earned - v_base_earned_xp),
    'nextResetAt', (
      ((now() at time zone 'Africa/Lagos')::date + interval '1 day') at time zone 'Africa/Lagos'
    )
  );
end;
$$;
