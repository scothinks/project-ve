begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, private;

select extensions.plan(23);

select extensions.ok(
  has_function_privilege('authenticated', 'public.get_dashboard_mission_state(jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.get_dashboard_mission_state(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.get_dashboard_mission_state(jsonb)', 'execute'),
  'only authenticated and service API roles can execute the mission-state read model'
);

select extensions.is(
  (select provolatile::text from pg_proc where oid = 'public.get_dashboard_mission_state(jsonb)'::regprocedure),
  's',
  'mission-state operation is declared stable/read-only'
);

select extensions.is(
  (
    select classification
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'get_dashboard_mission_state'
      and identity_arguments = 'p_deliveries jsonb'
  ),
  'PUBLIC_AUTHENTICATED_SELF',
  'mission-state RPC is classified as authenticated self-scoped'
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('41414141-4141-4141-8141-414141414141'::uuid, 'authenticated', 'authenticated', 'p11-referred@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('42424242-4242-4242-8242-424242424242'::uuid, 'authenticated', 'authenticated', 'p11-outsider@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

set local role service_role;

insert into public.profiles (id, display_name, xp, xp_balance_cached, role)
values
  ('41414141-4141-4141-8141-414141414141'::uuid, 'P11 Referred Learner', 0, 0, 'learner'),
  ('42424242-4242-4242-8242-424242424242'::uuid, 'P11 Outsider', 0, 0, 'learner')
on conflict (id) do update set display_name = excluded.display_name;

insert into public.missions (
  id, title, description, category, reward_type, reward_xp, repeatability,
  validation_type, validation_config, status, sort_order, mission_type_key
)
values (
  'mission-p11-proof', 'P11 proof', 'Set-wise proof state.', 'feedback', 'xp', 10, 'once',
  'proof_upload', '{"requiredFields":["text","image"],"requiresManualReview":true}'::jsonb,
  'published', 9911, 'proof_submission'
)
on conflict (id) do update set status = excluded.status, validation_config = excluded.validation_config;

insert into public.referral_attributions (
  referral_code, referrer_user_id, referred_user_id, status, created_at
)
values (
  'p11-public-referral', :'TEST_LEARNER_USER_ID'::uuid,
  '41414141-4141-4141-8141-414141414141'::uuid, 'signed_up', now() - interval '2 days'
)
on conflict (referred_user_id) where organization_id is null and programme_id is null and programme_mission_id is null
do update set referrer_user_id = excluded.referrer_user_id, created_at = excluded.created_at;

insert into public.lesson_page_completions (user_id, lesson_id, page_id)
select '41414141-4141-4141-8141-414141414141'::uuid, page.lesson_id, page.id
from public.lesson_pages page
where page.lesson_id in (
  select lesson.id
  from public.lessons lesson
  join public.courses course on course.id = lesson.course_id
  where lesson.status = 'published' and course.status = 'published'
  order by lesson.id
  limit 2
)
on conflict do nothing;

insert into public.mission_proofs (
  user_id, mission_id, award_scope, proof_type, value, status
)
values
  (:'TEST_LEARNER_USER_ID'::uuid, 'mission-p11-proof', 'lifetime', 'text', 'P11 evidence', 'submitted'),
  (:'TEST_LEARNER_USER_ID'::uuid, 'mission-p11-proof', 'lifetime', 'image', 'https://assets.example.test/p11.png', 'approved'),
  ('42424242-4242-4242-8242-424242424242'::uuid, 'mission-p11-proof', 'lifetime', 'text', 'private outsider evidence', 'rejected')
on conflict do nothing;

insert into public.organizations (
  id, slug, name, short_name, accent_token, status, lifecycle_status, created_by
)
values (
  '40404040-4040-4040-8040-404040404010'::uuid,
  'p11-mission-state', 'P11 Mission State Organisation', 'P11 Org', 'green',
  'published', 'active', :'TEST_ADMIN_USER_ID'::uuid
)
on conflict (id) do update set status = excluded.status, lifecycle_status = excluded.lifecycle_status;

insert into public.programmes (
  id, organization_id, slug, title, objective, intended_audience, status, created_by
)
values (
  '40404040-4040-4040-8040-404040404020'::uuid,
  '40404040-4040-4040-8040-404040404010'::uuid,
  'p11-programme', 'P11 Programme', 'Set-wise programme state.', 'P11 learners',
  'published', :'TEST_ADMIN_USER_ID'::uuid
)
on conflict (id) do update set status = excluded.status;

insert into public.programme_missions (programme_id, mission_id, sort_order)
values (
  '40404040-4040-4040-8040-404040404020'::uuid,
  'mission-referral-learner', 1
)
on conflict (programme_id, mission_id) do update set sort_order = excluded.sort_order;

insert into public.enrolments (
  organization_id, user_id, programme_id, assignment_source, status, metadata
)
values (
  '40404040-4040-4040-8040-404040404010'::uuid,
  :'TEST_LEARNER_USER_ID'::uuid,
  '40404040-4040-4040-8040-404040404020'::uuid,
  'programme', 'active', '{}'::jsonb
)
on conflict (organization_id, user_id, programme_id) where programme_id is not null
do update set status = excluded.status;

insert into public.contextual_referral_tokens (
  token, referrer_user_id, organization_id, programme_id, programme_mission_id,
  destination, eligibility_policy, presentation_config, status
)
values (
  'ctx_p11_existing_token_123', :'TEST_LEARNER_USER_ID'::uuid,
  '40404040-4040-4040-8040-404040404010'::uuid,
  '40404040-4040-4040-8040-404040404020'::uuid,
  'mission-referral-learner', '/o/p11-mission-state/missions', '{}'::jsonb, '{}'::jsonb, 'published'
)
on conflict (token) do nothing;

reset role;

set local role anon;
select extensions.throws_ok(
  $$ select public.get_dashboard_mission_state('[]'::jsonb) $$,
  '42501',
  'permission denied for function get_dashboard_mission_state',
  'anonymous callers cannot execute mission state'
);
reset role;

set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select extensions.throws_ok(
  $$ select public.get_dashboard_mission_state('[]'::jsonb) $$,
  'P0001',
  'Authentication is required.',
  'service role without an authenticated subject cannot read learner mission state'
);
reset role;

select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.is(
  jsonb_array_length(public.get_dashboard_mission_state(jsonb_build_array(
    jsonb_build_object('deliveryId', 'mission-complete-starter-budget', 'missionId', 'mission-complete-starter-budget'),
    jsonb_build_object('deliveryId', 'mission-referral-learner', 'missionId', 'mission-referral-learner'),
    jsonb_build_object('deliveryId', 'mission-p11-proof', 'missionId', 'mission-p11-proof')
  ))),
  3,
  'one operation returns every requested visible public mission'
);

select extensions.is(
  (public.get_dashboard_mission_state(jsonb_build_array(
    jsonb_build_object('deliveryId', 'mission-referral-learner', 'missionId', 'mission-referral-learner')
  )) -> 0 ->> 'referralInvitedCount')::integer,
  1,
  'public referral state includes the caller invited count'
);

select extensions.is(
  (public.get_dashboard_mission_state(jsonb_build_array(
    jsonb_build_object('deliveryId', 'mission-referral-learner', 'missionId', 'mission-referral-learner')
  )) -> 0 ->> 'referralQualifiedCount')::integer,
  1,
  'referral qualification is evaluated across referred learners inside the set-wise operation'
);

select extensions.is(
  public.get_dashboard_mission_state(jsonb_build_array(
    jsonb_build_object('deliveryId', 'mission-p11-proof', 'missionId', 'mission-p11-proof')
  )) -> 0 -> 'proofFieldStatuses' ->> 'text',
  'submitted',
  'proof field state is returned for the current caller'
);

select extensions.is(
  public.get_dashboard_mission_state(jsonb_build_array(
    jsonb_build_object('deliveryId', 'mission-p11-proof', 'missionId', 'mission-p11-proof')
  )) -> 0 -> 'proofFieldStatuses' ->> 'image',
  'approved',
  'approved proof field state is preserved'
);

select extensions.is(
  public.get_dashboard_mission_state(jsonb_build_array(
    jsonb_build_object('deliveryId', 'mission-p11-proof', 'missionId', 'mission-p11-proof')
  )) -> 0 ->> 'reviewStatus',
  'submitted',
  'manual proof review remains submitted until every required field is approved'
);

select extensions.is(
  (
    select count(*)::integer from public.contextual_referral_tokens
    where referrer_user_id = :'TEST_LEARNER_USER_ID'::uuid
  ),
  1,
  'fixture starts with one explicit contextual referral token'
);

select extensions.is(
  public.get_dashboard_mission_state(jsonb_build_array(jsonb_build_object(
    'deliveryId', '40404040-4040-4040-8040-404040404020:mission-referral-learner',
    'missionId', 'mission-referral-learner',
    'organizationId', '40404040-4040-4040-8040-404040404010',
    'programmeId', '40404040-4040-4040-8040-404040404020',
    'programmeMissionId', 'mission-referral-learner'
  ))) -> 0 ->> 'referralToken',
  'ctx_p11_existing_token_123',
  'programme mission state returns an existing contextual referral token'
);

select extensions.is(
  (
    select count(*)::integer from public.contextual_referral_tokens
    where referrer_user_id = :'TEST_LEARNER_USER_ID'::uuid
  ),
  1,
  'mission-state rendering does not create a contextual referral token'
);

select extensions.is(
  public.get_dashboard_mission_state(jsonb_build_array(jsonb_build_object(
    'deliveryId', 'spoofed',
    'missionId', 'mission-referral-learner',
    'organizationId', '40404040-4040-4040-8040-404040404099',
    'programmeId', '40404040-4040-4040-8040-404040404020',
    'programmeMissionId', 'mission-referral-learner'
  ))),
  '[]'::jsonb,
  'caller-selected cross-organization programme context is rejected'
);

select extensions.throws_ok(
  $$ select public.get_dashboard_mission_state(
    (select jsonb_agg(jsonb_build_object('deliveryId', value::text, 'missionId', 'mission-complete-starter-budget')) from generate_series(1, 101) value)
  ) $$,
  'P0001',
  'Mission delivery limit exceeded.',
  'mission-state input is bounded'
);

select extensions.throws_ok(
  $$ select public.get_dashboard_mission_state('{}'::jsonb) $$,
  'P0001',
  'Mission deliveries must be a JSON array.',
  'mission-state input must use the documented array contract'
);

reset role;
select set_config('request.jwt.claim.sub', '42424242-4242-4242-8242-424242424242', true);
set local role authenticated;

select extensions.is(
  public.get_dashboard_mission_state(jsonb_build_array(jsonb_build_object(
    'deliveryId', '40404040-4040-4040-8040-404040404020:mission-referral-learner',
    'missionId', 'mission-referral-learner',
    'organizationId', '40404040-4040-4040-8040-404040404010',
    'programmeId', '40404040-4040-4040-8040-404040404020',
    'programmeMissionId', 'mission-referral-learner'
  ))),
  '[]'::jsonb,
  'outsider cannot read programme mission state'
);

select extensions.is(
  public.get_dashboard_mission_state(jsonb_build_array(
    jsonb_build_object('deliveryId', 'mission-p11-proof', 'missionId', 'mission-p11-proof')
  )) -> 0 -> 'proofFieldStatuses' ->> 'text',
  'rejected',
  'proof state remains scoped to the authenticated caller'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role service_role;
update public.mission_proofs
set status = 'approved', reviewed_at = now(), reviewed_by = :'TEST_ADMIN_USER_ID'::uuid
where user_id = :'TEST_LEARNER_USER_ID'::uuid
  and mission_id = 'mission-p11-proof'
  and proof_type = 'text';
reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.lives_ok(
  $$ select public.award_valid_mission_xp('mission-p11-proof', 'lifetime') $$,
  'supported explicit mission award flow remains callable after the read-only state operation'
);

select extensions.is(
  public.get_dashboard_mission_state(jsonb_build_array(
    jsonb_build_object('deliveryId', 'mission-p11-proof', 'missionId', 'mission-p11-proof')
  )) -> 0 ->> 'hasCurrentAward',
  'true',
  'mission-state operation observes awards created by the explicit award flow'
);

select extensions.is(
  (public.get_dashboard_mission_state(jsonb_build_array(
    jsonb_build_object('deliveryId', 'mission-p11-proof', 'missionId', 'mission-p11-proof')
  )) -> 0 ->> 'awardedCount')::integer,
  1,
  'mission-state operation returns the current-context award count'
);

select extensions.is(
  public.get_dashboard_mission_state('[]'::jsonb),
  '[]'::jsonb,
  'empty mission screen resolves in the same single operation'
);

select * from extensions.finish();
rollback;
