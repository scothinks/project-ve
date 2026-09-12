-- Record new sample awards through the existing preference-aware notification
-- primitive in the same transaction. Replay creates neither XP nor notifications.
create or replace function public.service_claim_welcome_progress(p_user_id uuid, p_receipt_id uuid, p_topics text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_topic text; v_xp integer; v_count integer; v_existing text[]; v_awarded integer := 0;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501'; end if;
  if p_user_id is null or p_receipt_id is null or p_topics is null or cardinality(p_topics) not between 1 and 3
    or exists (select 1 from unnest(p_topics) t where t is null or t not in ('listen','think','act')) then
    raise exception 'Invalid welcome receipt.';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then
    raise exception 'Confirmed account required.' using errcode='42501';
  end if;
  -- Serialize claims for this account; the receipt PK separately prevents cross-account replay.
  perform 1 from public.profiles where id=p_user_id for update;
  insert into private.welcome_receipt_claims(receipt_id,user_id) values(p_receipt_id,p_user_id) on conflict do nothing;
  select user_id into v_owner from private.welcome_receipt_claims where receipt_id=p_receipt_id;
  if v_owner is distinct from p_user_id then raise exception 'Receipt already claimed.' using errcode='42501'; end if;
  select coalesce(array_agg(award_scope),array[]::text[]) into v_existing
    from public.xp_transactions where user_id=p_user_id and direction='earn'
      and award_scope in ('welcome:listen','welcome:think','welcome:act');
  for v_topic in select distinct unnest(p_topics) loop
    if ('welcome:' || v_topic) = any(v_existing) then continue; end if;
    perform private.post_xp_transaction(p_user_id,'earn'::public.xp_direction,10,'quiz_question'::public.xp_source_type,
      'welcome:' || v_topic,'welcome:' || v_topic,jsonb_build_object('kind','welcome_lesson','topic',v_topic));
    v_awarded := v_awarded + 10;
    perform private.queue_user_notification(p_user_id,'rewards','welcome_xp_earned',
      'You put a new idea to the test.',
      'Your sample lesson earned 10 XP. It has been added to your balance.',
      '/xp-store','Explore rewards',jsonb_build_object('xp',10,'topic',v_topic),
      'welcome-xp:' || p_user_id::text || ':' || v_topic);
  end loop;
  select coalesce(sum(amount),0)::integer,count(*)::integer into v_xp,v_count from public.xp_transactions
    where user_id=p_user_id and direction='earn' and award_scope in ('welcome:listen','welcome:think','welcome:act');
  return jsonb_build_object('savedXp',v_xp,'completedLessons',v_count,'awardedXp',v_awarded);
end; $$;
revoke all on function public.service_claim_welcome_progress(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.service_claim_welcome_progress(uuid,uuid,text[]) to service_role;

