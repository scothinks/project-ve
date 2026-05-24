create or replace function public.notify_first_earned_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.direction <> 'earn' then
    return new;
  end if;

  if new.source_type not in ('quiz_question', 'mission') then
    return new;
  end if;

  if exists (
    select 1
    from public.xp_transactions xp
    where xp.user_id = new.user_id
      and xp.direction = 'earn'
      and xp.source_type in ('quiz_question', 'mission')
      and xp.id <> new.id
  ) then
    return new;
  end if;

  perform public.queue_user_notification(
    new.user_id,
    'account',
    'first_xp_earned',
    'First XP earned',
    'You earned XP. Turn on alerts to catch more opportunities.',
    '/dashboard',
    'Open app',
    jsonb_build_object(
      'amount', new.amount,
      'sourceId', new.source_id,
      'sourceType', new.source_type,
      'xpTransactionId', new.id
    ),
    'first-xp-earned:' || new.user_id::text
  );

  return new;
end;
$$;

drop trigger if exists xp_transactions_notify_first_earned_xp on public.xp_transactions;
create trigger xp_transactions_notify_first_earned_xp
  after insert on public.xp_transactions
  for each row execute function public.notify_first_earned_xp();
