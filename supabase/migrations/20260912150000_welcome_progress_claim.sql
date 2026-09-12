-- Verified guest receipts may be claimed by one confirmed account. The existing
-- XP ledger remains the balance authority, with lifetime per-user/topic awards.
create table private.welcome_receipt_claims (
  receipt_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  claimed_at timestamptz not null default now()
);
alter table private.welcome_receipt_claims enable row level security;
revoke all on private.welcome_receipt_claims from public, anon, authenticated, service_role;

create or replace function public.service_claim_welcome_progress(p_user_id uuid, p_receipt_id uuid, p_topics text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_topic text; v_xp integer; v_count integer;
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
  for v_topic in select distinct unnest(p_topics) loop
    perform private.post_xp_transaction(p_user_id,'earn'::public.xp_direction,10,'quiz_question'::public.xp_source_type,
      'welcome:' || v_topic,'welcome:' || v_topic,jsonb_build_object('kind','welcome_lesson','topic',v_topic));
  end loop;
  select coalesce(sum(amount),0)::integer,count(*)::integer into v_xp,v_count from public.xp_transactions
    where user_id=p_user_id and direction='earn' and award_scope in ('welcome:listen','welcome:think','welcome:act');
  return jsonb_build_object('savedXp',v_xp,'completedLessons',v_count);
end; $$;
revoke all on function public.service_claim_welcome_progress(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.service_claim_welcome_progress(uuid,uuid,text[]) to service_role;

insert into private.rpc_security_classifications(function_schema,function_name,identity_arguments,classification,intended_callers,authorization_rule,execute_roles)
values ('public','service_claim_welcome_progress','p_user_id uuid, p_receipt_id uuid, p_topics text[]','SERVICE_ROLE_ONLY','Welcome progress POST handler','Verified signed receipt and request-scoped confirmed user; one receipt owner; fixed, idempotent per-user sample awards through the existing XP ledger.',array['service_role']);
