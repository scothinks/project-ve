begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public,private;
select no_plan();
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
('91910000-0000-4000-8000-000000000001','authenticated','authenticated','welcome-one@example.test',now(),'{}','{}'),
('91920000-0000-4000-8000-000000000002','authenticated','authenticated','welcome-two@example.test',now(),'{}','{}'),
('91930000-0000-4000-8000-000000000003','authenticated','authenticated','welcome-unconfirmed@example.test',null,'{}','{}');
insert into profiles(id,display_name,role) values
('91910000-0000-4000-8000-000000000001','Welcome one','learner'),
('91920000-0000-4000-8000-000000000002','Welcome two','learner'),
('91930000-0000-4000-8000-000000000003','Welcome unconfirmed','learner') on conflict(id) do nothing;
select ok(not has_function_privilege('anon','public.service_claim_welcome_progress(uuid,uuid,text[])','execute'),'anonymous callers cannot claim');
select ok(not has_function_privilege('authenticated','public.service_claim_welcome_progress(uuid,uuid,text[])','execute'),'authenticated callers cannot mint receipts through RPC');
select ok(not has_table_privilege('authenticated','private.welcome_receipt_claims','INSERT'),'clients cannot write receipt ownership');
select ok(not has_table_privilege('service_role','private.welcome_receipt_claims','INSERT'),'service raw table writes are denied');
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select is(public.service_claim_welcome_progress('91910000-0000-4000-8000-000000000001','91910000-0000-4000-8000-000000000011',array['listen'])->>'savedXp','10','one completed sample saves 10 ledger XP');
select is(public.service_claim_welcome_progress('91910000-0000-4000-8000-000000000001','91910000-0000-4000-8000-000000000011',array['listen'])->>'savedXp','10','retry does not award twice');
select is(public.service_claim_welcome_progress('91910000-0000-4000-8000-000000000001','91910000-0000-4000-8000-000000000012',array['listen'])->>'savedXp','10','a new browser receipt cannot repeat a topic award');
select is(public.service_claim_welcome_progress('91910000-0000-4000-8000-000000000001','91910000-0000-4000-8000-000000000011',array['think','act','listen'])->>'savedXp','30','all three samples save only 30 XP');
select throws_ok($$select public.service_claim_welcome_progress('91920000-0000-4000-8000-000000000002','91910000-0000-4000-8000-000000000011',array['listen'])$$,'42501','Receipt already claimed.','receipt cannot be transferred to another account');
select throws_ok($$select public.service_claim_welcome_progress('91930000-0000-4000-8000-000000000003','91910000-0000-4000-8000-000000000013',array['listen'])$$,'42501','Confirmed account required.','unconfirmed accounts cannot claim');
select throws_ok($$select public.service_claim_welcome_progress('91910000-0000-4000-8000-000000000001','91910000-0000-4000-8000-000000000014',array['fake'])$$,'P0001','Invalid welcome receipt.','unknown topics rejected');
reset role;
select is((select xp_balance_cached from profiles where id='91910000-0000-4000-8000-000000000001'),30,'ledger trigger updates the real profile balance');
select is((select count(*)::integer from xp_transactions where user_id='91910000-0000-4000-8000-000000000001' and award_scope like 'welcome:%'),3,'exactly one transaction per sample');
select is((select count(*)::integer from user_notifications where user_id='91910000-0000-4000-8000-000000000001' and event_type='welcome_xp_earned'),3,'one notification per new topic, none for retries or another receipt');
select is((select count(*)::integer from user_notifications where user_id='91910000-0000-4000-8000-000000000001' and event_type='welcome_xp_earned' and category='rewards' and data->>'xp'='10' and cta_href='/xp-store'),3,'notifications record each real award and link to rewards');
insert into notification_preferences(user_id,rewards_enabled) values ('91920000-0000-4000-8000-000000000002',false) on conflict(user_id) do update set rewards_enabled=false;
set local role service_role;
select is(public.service_claim_welcome_progress('91910000-0000-4000-8000-000000000001','91910000-0000-4000-8000-000000000015',array['listen'])->>'awardedXp','0','already earned sample reports no new award');
select is(public.service_claim_welcome_progress('91920000-0000-4000-8000-000000000002','91920000-0000-4000-8000-000000000015',array['listen','listen'])->>'awardedXp','10','an existing confirmed account earns a sample once even with duplicate input');
reset role;
select is((select count(*)::integer from user_notifications where user_id='91920000-0000-4000-8000-000000000002' and event_type='welcome_xp_earned'),0,'rewards notification opt-out is respected without withholding XP');
select is((select xp_balance_cached from profiles where id='91920000-0000-4000-8000-000000000002'),10,'existing account receives XP with notifications disabled');
select * from finish();
rollback;
