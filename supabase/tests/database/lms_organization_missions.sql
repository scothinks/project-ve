begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(54);

insert into auth.users (
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    :'TEST_ADMIN_USER_ID'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-org-missions-admin@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    :'TEST_LEARNER_USER_ID'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-org-missions-manager@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-org-missions-referred@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8712'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-org-missions-outsider@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9713'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-org-missions-manual@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '7d7d7d7d-7d7d-4d7d-8d7d-7d7d7d7d7714'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-org-missions-ineligible@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update
  set email = excluded.email,
      aud = excluded.aud,
      role = excluded.role,
      email_confirmed_at = excluded.email_confirmed_at,
      updated_at = now();

set local role service_role;

insert into public.profiles (
  id,
  display_name,
  xp,
  xp_balance_cached,
  role
)
values
  (:'TEST_ADMIN_USER_ID'::uuid, 'Local pgTAP Org Missions Admin', 0, 0, 'admin'),
  (:'TEST_LEARNER_USER_ID'::uuid, 'Local pgTAP Org Missions Manager', 0, 0, 'learner'),
  ('6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'::uuid, 'Local pgTAP Org Missions Referred', 0, 0, 'learner'),
  ('8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8712'::uuid, 'Local pgTAP Org Missions Outsider', 0, 0, 'learner'),
  ('9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9713'::uuid, 'Local pgTAP Org Missions Manual Pending', 0, 0, 'learner'),
  ('7d7d7d7d-7d7d-4d7d-8d7d-7d7d7d7d7714'::uuid, 'Local pgTAP Org Missions Ineligible', 0, 0, 'learner')
on conflict (id) do update
  set display_name = excluded.display_name,
      xp = excluded.xp,
      xp_balance_cached = excluded.xp_balance_cached,
      role = excluded.role,
      updated_at = now();

insert into public.organizations (slug, name, status, created_by)
values
  ('p15b-missions-alpha', 'P15B Missions Alpha', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('p15b-missions-beta', 'P15B Missions Beta', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status,
      updated_at = now();

select id as p15b_alpha_org_id
from public.organizations
where slug = 'p15b-missions-alpha'
\gset

select id as p15b_beta_org_id
from public.organizations
where slug = 'p15b-missions-beta'
\gset

insert into public.organization_plan_assignments (
  organization_id,
  plan_key,
  billing_status,
  assigned_by
)
values
  (:'p15b_alpha_org_id'::uuid, 'starter', 'free', :'TEST_ADMIN_USER_ID'::uuid),
  (:'p15b_beta_org_id'::uuid, 'starter', 'free', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (organization_id) where ended_at is null do update
  set plan_key = excluded.plan_key,
      billing_status = excluded.billing_status,
      assigned_by = excluded.assigned_by,
      updated_at = now();

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values
  (:'p15b_alpha_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'programme_manager', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'p15b_beta_org_id'::uuid, '8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8712'::uuid, 'programme_manager', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'p15b_alpha_org_id'::uuid, '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'p15b_beta_org_id'::uuid, '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (organization_id, user_id, role) do update
  set status = excluded.status,
      invited_by = excluded.invited_by;

insert into public.courses (
  id,
  slug,
  title,
  description,
  intended_audience,
  learning_outcomes,
  category,
  level,
  status,
  sort_order,
  estimated_minutes
)
values (
  'course-p15b-missions-platform',
  'course-p15b-missions-platform',
  'P15B Missions Platform Course',
  'Reusable mission test course.',
  'Institutional learners',
  array['Complete a mission-linked course'],
  'Values Education',
  'beginner',
  'published',
  950,
  8
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

insert into public.lessons (
  id,
  course_id,
  slug,
  title,
  status,
  sort_order,
  estimated_minutes
)
values (
  'lesson-p15b-referral-qualification',
  'course-p15b-missions-platform',
  'lesson-p15b-referral-qualification',
  'P15B Referral Qualification Lesson',
  'published',
  1,
  4
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

insert into public.lesson_pages (
  id,
  lesson_id,
  page_number,
  title,
  page_type
)
values (
  'page-p15b-referral-qualification',
  'lesson-p15b-referral-qualification',
  1,
  'P15B Referral Qualification Page',
  'concept'
)
on conflict (id) do update
  set title = excluded.title;

insert into public.courses (
  id,
  slug,
  title,
  description,
  intended_audience,
  learning_outcomes,
  category,
  level,
  status,
  sort_order,
  estimated_minutes,
  catalog_scope,
  organization_id
)
values
  (
    'course-p15b-unattached-public',
    'course-p15b-unattached-public',
    'P15B Unattached Public Course',
    'Public lesson outside the programme.',
    'Public learners',
    array['Complete an unattached public lesson'],
    'Values Education',
    'beginner',
    'published',
    951,
    4,
    'platform',
    null
  ),
  (
    'course-p15b-beta-private',
    'course-p15b-beta-private',
    'P15B Beta Private Course',
    'Private Beta lesson for tenant isolation.',
    'Beta learners',
    array['Complete a private beta lesson'],
    'Values Education',
    'beginner',
    'published',
    952,
    4,
    'organization_private',
    :'p15b_beta_org_id'::uuid
  )
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      catalog_scope = excluded.catalog_scope,
      organization_id = excluded.organization_id;

insert into public.lessons (
  id,
  course_id,
  slug,
  title,
  status,
  sort_order,
  estimated_minutes
)
values
  (
    'lesson-p15b-unattached-public',
    'course-p15b-unattached-public',
    'lesson-p15b-unattached-public',
    'P15B Unattached Public Lesson',
    'published',
    1,
    4
  ),
  (
    'lesson-p15b-beta-private',
    'course-p15b-beta-private',
    'lesson-p15b-beta-private',
    'P15B Beta Private Lesson',
    'published',
    1,
    4
  )
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

insert into public.lesson_pages (
  id,
  lesson_id,
  page_number,
  title,
  page_type
)
values
  (
    'page-p15b-unattached-public',
    'lesson-p15b-unattached-public',
    1,
    'P15B Unattached Public Page',
    'concept'
  ),
  (
    'page-p15b-beta-private',
    'lesson-p15b-beta-private',
    1,
    'P15B Beta Private Page',
    'concept'
  )
on conflict (id) do update
  set title = excluded.title;

insert into public.missions (
  id,
  title,
  description,
  category,
  reward_type,
  reward_xp,
  repeatability,
  validation_type,
  validation_config,
  status,
  sort_order
)
values (
  'mission-p15b-platform-course',
  'P15B Platform Course Mission',
  'Complete the reusable platform course.',
  'course',
  'xp',
  25,
  'once',
  'course_completed',
  '{"courseId":"course-p15b-missions-platform"}'::jsonb,
  'published',
  950
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

insert into public.programmes (
  id,
  organization_id,
  slug,
  title,
  objective,
  intended_audience,
  status,
  completion_rules,
  reporting_config,
  created_by
)
values
  (
    '88888888-8888-4888-8888-888888888811'::uuid,
    :'p15b_alpha_org_id'::uuid,
    'p15b-alpha-programme',
    'P15B Alpha Programme',
    'Verify organisation mission delivery.',
    'Alpha learners',
    'published',
    '{}'::jsonb,
    '{}'::jsonb,
    :'TEST_ADMIN_USER_ID'::uuid
  ),
  (
    '88888888-8888-4888-8888-888888888812'::uuid,
    :'p15b_beta_org_id'::uuid,
    'p15b-beta-programme',
    'P15B Beta Programme',
    'Verify cross-organisation mission isolation.',
    'Beta learners',
    'published',
    '{}'::jsonb,
    '{}'::jsonb,
    :'TEST_ADMIN_USER_ID'::uuid
  )
on conflict (id) do update
  set title = excluded.title,
      organization_id = excluded.organization_id,
      status = excluded.status;

insert into public.programme_courses (
  programme_id,
  course_id,
  sort_order,
  requirement
)
values
  (
    '88888888-8888-4888-8888-888888888811'::uuid,
    'course-p15b-missions-platform',
    1,
    'required'
  ),
  (
    '88888888-8888-4888-8888-888888888812'::uuid,
    'course-p15b-missions-platform',
    1,
    'required'
  )
on conflict (programme_id, course_id) do update
  set sort_order = excluded.sort_order,
      requirement = excluded.requirement;

reset role;

select extensions.is(
  (select count(*)::integer from public.mission_types),
  6,
  'mission type registry seeds all existing executable mission capabilities'
);

select extensions.is(
  (
    select mission_type_key
    from public.missions
    where id = 'mission-p15b-platform-course'
  ),
  'course_completed',
  'existing validation type maps to a registered mission type key'
);

select extensions.ok(
  exists (
    select 1
    from public.mission_types
    where key = 'referral'
      and handler_version > 0
      and learner_interaction_type = 'referral'
  ),
  'mission type registry records traceable handler metadata'
);

select extensions.ok(
  not exists (
    select 1
    from public.organization_plans plan
    where plan.status = 'active'
      and (plan.entitlements -> 'allowed_mission_reward_modes') ?| array['manual_reward', 'direct_reward']
  ),
  'active organisation plans only advertise wired organisation XP mission reward mode'
);

select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.admin_create_organization_mission(
  :'p15b_alpha_org_id'::uuid,
  'mission-p15b-alpha-course',
  'P15B Alpha Course Mission',
  'Complete the configured course for Alpha.',
  'course',
  20,
  'once',
  'course_completed',
  'course_completed',
  '{"courseId":"course-p15b-missions-platform"}'::jsonb,
  '{"title":"Alpha wording"}'::jsonb,
  null,
  null,
  'published',
  1
) as alpha_course_result
\gset

select extensions.ok(
  exists (
    select 1
    from public.missions
    where id = 'mission-p15b-alpha-course'
      and catalog_scope = 'organization_private'
      and organization_id = :'p15b_alpha_org_id'::uuid
      and reward_mode = 'organization_xp'
      and presentation_config ->> 'title' = 'Alpha wording'
  ),
  'organisation mission managers can create entitled organisation-private missions'
);

select public.admin_set_mission_status('mission-p15b-alpha-course', 'draft') as alpha_draft_status_result
\gset

select extensions.is(
  (
    select status::text
    from public.missions
    where id = 'mission-p15b-alpha-course'
  ),
  'draft',
  'organisation mission managers can move their organisation mission back to draft'
);

select public.admin_set_mission_status('mission-p15b-alpha-course', 'published') as alpha_publish_status_result
\gset

select extensions.is(
  (
    select status::text
    from public.missions
    where id = 'mission-p15b-alpha-course'
  ),
  'published',
  'organisation mission managers can publish their organisation mission'
);

reset role;
set local role service_role;

insert into public.programme_missions (
  programme_id,
  mission_id,
  sort_order
)
values (
  '88888888-8888-4888-8888-888888888811'::uuid,
  'mission-p15b-alpha-course',
  1
)
on conflict (programme_id, mission_id) do update
  set sort_order = excluded.sort_order;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.admin_update_programme_mission_delivery(
  '88888888-8888-4888-8888-888888888811'::uuid,
  jsonb_build_object(
    'mission-p15b-alpha-course',
    jsonb_build_object(
      'startsAt', '2026-09-05T09:00:00Z',
      'dueAt', '2026-09-20T09:00:00Z',
      'isRequired', true,
      'rewardXpOverride', 15,
      'presentationOverrides', jsonb_build_object(
        'title', 'Alpha programme course mission',
        'ctaLabel', 'Start Alpha challenge'
      ),
      'deliveryConfig', jsonb_build_object('previewMode', 'programme')
    )
  )
) as alpha_delivery_result
\gset

select extensions.ok(
  exists (
    select 1
    from public.programme_missions
    where programme_id = '88888888-8888-4888-8888-888888888811'::uuid
      and mission_id = 'mission-p15b-alpha-course'
      and starts_at = '2026-09-05T09:00:00Z'::timestamptz
      and due_at = '2026-09-20T09:00:00Z'::timestamptz
      and is_required
      and reward_xp_override = 15
      and xp_account_id is null
      and presentation_overrides ->> 'title' = 'Alpha programme course mission'
      and delivery_config ->> 'previewMode' = 'programme'
  ),
  'programme managers can configure mission delivery without mutating the base mission'
);

select extensions.throws_ok(
  $$
    select public.admin_update_programme_mission_delivery(
      '88888888-8888-4888-8888-888888888811'::uuid,
      '{"mission-p15b-alpha-course":{"xpAccountId":"11111111-1111-4111-8111-111111111111"}}'::jsonb
    )
  $$,
  'P0001',
  'Programme mission XP account selection is not available until organization XP accounts are enabled.',
  'programme mission delivery RPC rejects browser-supplied XP account ids'
);

select extensions.throws_ok(
  $$
    select public.admin_update_programme_mission_delivery(
      '88888888-8888-4888-8888-888888888811'::uuid,
      '{"mission-p15b-platform-course":{"isRequired":true}}'::jsonb
    )
  $$,
  'P0001',
  'Programme mission delivery config must reference attached missions.',
  'programme mission delivery config cannot target unattached missions'
);

reset role;
set local role service_role;

insert into public.missions (
  id,
  title,
  description,
  category,
  reward_type,
  reward_xp,
  repeatability,
  validation_type,
  validation_config,
  status,
  sort_order,
  mission_type_key
)
values (
  'mission-p15b-alpha-proof',
  'P15B Alpha Proof Mission',
  'Submit programme proof for Alpha.',
  'feedback',
  'xp',
  40,
  'once',
  'proof_upload',
  '{"requiredFields":["text"],"requiresManualReview":false}'::jsonb,
  'published',
  951,
  'proof_submission'
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      reward_xp = excluded.reward_xp,
      validation_config = excluded.validation_config,
      mission_type_key = excluded.mission_type_key;

insert into public.programme_missions (
  programme_id,
  mission_id,
  sort_order,
  reward_xp_override
)
values (
  '88888888-8888-4888-8888-888888888811'::uuid,
  'mission-p15b-alpha-proof',
  2,
  15
)
on conflict (programme_id, mission_id) do update
  set sort_order = excluded.sort_order,
      starts_at = null,
      due_at = null,
      reward_xp_override = excluded.reward_xp_override;

insert into public.missions (
  id,
  title,
  description,
  category,
  reward_type,
  reward_xp,
  repeatability,
  validation_type,
  validation_config,
  status,
  sort_order,
  mission_type_key
)
values (
  'mission-p15b-programme-lesson-count',
  'P15B Programme Lesson Count Mission',
  'Complete one lesson inside the programme.',
  'course',
  'xp',
  12,
  'once',
  'lesson_count_completed',
  '{"count":1}'::jsonb,
  'published',
  953,
  'lesson_count_completed'
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      validation_config = excluded.validation_config,
      mission_type_key = excluded.mission_type_key;

insert into public.programme_missions (
  programme_id,
  mission_id,
  sort_order
)
values (
  '88888888-8888-4888-8888-888888888811'::uuid,
  'mission-p15b-programme-lesson-count',
  4
)
on conflict (programme_id, mission_id) do update
  set sort_order = excluded.sort_order;

insert into public.missions (
  id,
  title,
  description,
  category,
  reward_type,
  reward_xp,
  repeatability,
  validation_type,
  validation_config,
  status,
  sort_order,
  mission_type_key
)
values (
  'mission-p15b-manual-proof-review',
  'P15B Manual Proof Review Mission',
  'Submit proof for organization review.',
  'feedback',
  'xp',
  18,
  'once',
  'proof_upload',
  '{"requiredFields":["text"],"requiresManualReview":true}'::jsonb,
  'published',
  954,
  'proof_submission'
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      validation_config = excluded.validation_config,
      mission_type_key = excluded.mission_type_key;

insert into public.programme_missions (
  programme_id,
  mission_id,
  sort_order
)
values
  (
    '88888888-8888-4888-8888-888888888811'::uuid,
    'mission-p15b-platform-course',
    5
  ),
  (
    '88888888-8888-4888-8888-888888888812'::uuid,
    'mission-p15b-platform-course',
    2
  ),
  (
    '88888888-8888-4888-8888-888888888811'::uuid,
    'mission-p15b-manual-proof-review',
    6
  ),
  (
    '88888888-8888-4888-8888-888888888812'::uuid,
    'mission-p15b-manual-proof-review',
    3
  )
on conflict (programme_id, mission_id) do update
  set sort_order = excluded.sort_order;

insert into public.mission_proofs (
  user_id,
  mission_id,
  award_scope,
  proof_type,
  value,
  status,
  organization_id,
  programme_id,
  programme_mission_id
)
values
  (
    '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'::uuid,
    'mission-p15b-manual-proof-review',
    'programme:88888888-8888-4888-8888-888888888811:lifetime',
    'text',
    'Alpha manual proof',
    'submitted',
    :'p15b_alpha_org_id'::uuid,
    '88888888-8888-4888-8888-888888888811'::uuid,
    'mission-p15b-manual-proof-review'
  ),
  (
    '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'::uuid,
    'mission-p15b-manual-proof-review',
    'programme:88888888-8888-4888-8888-888888888812:lifetime',
    'text',
    'Beta manual proof',
    'submitted',
    :'p15b_beta_org_id'::uuid,
    '88888888-8888-4888-8888-888888888812'::uuid,
    'mission-p15b-manual-proof-review'
  );

insert into public.missions (
  id,
  title,
  description,
  category,
  reward_type,
  reward_xp,
  repeatability,
  validation_type,
  validation_config,
  status,
  sort_order,
  mission_type_key
)
values (
  'mission-p15b-platform-referral',
  'P15B Platform Contextual Referral Mission',
  'Invite a contextual learner who completes one lesson.',
  'referral',
  'xp',
  30,
  'per_referral',
  'referral_friend_completed_lessons',
  '{"requiredFriendLessonCount":1,"minimumAccountAgeHours":0}'::jsonb,
  'published',
  952,
  'referral'
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      reward_xp = excluded.reward_xp,
      validation_config = excluded.validation_config,
      mission_type_key = excluded.mission_type_key;

insert into public.programme_missions (
  programme_id,
  mission_id,
  sort_order,
  reward_xp_override
)
values (
  '88888888-8888-4888-8888-888888888811'::uuid,
  'mission-p15b-platform-referral',
  3,
  45
)
on conflict (programme_id, mission_id) do update
  set sort_order = excluded.sort_order,
      starts_at = null,
      due_at = null,
      reward_xp_override = excluded.reward_xp_override;

insert into public.mission_proofs (
  user_id,
  mission_id,
  award_scope,
  proof_type,
  value,
  status,
  organization_id,
  programme_id,
  programme_mission_id
)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  'mission-p15b-alpha-proof',
  'programme:88888888-8888-4888-8888-888888888811:lifetime',
  'text',
  'Completed programme proof',
  'submitted',
  :'p15b_alpha_org_id'::uuid,
  '88888888-8888-4888-8888-888888888811'::uuid,
  'mission-p15b-alpha-proof'
)
on conflict do nothing;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.award_valid_mission_xp(
  'mission-p15b-alpha-proof',
  'programme:88888888-8888-4888-8888-888888888811:lifetime'
) as alpha_proof_award_result
\gset

select extensions.ok(
  exists (
    select 1
    from public.mission_awards ma
    join public.xp_transactions xt on xt.id = ma.xp_transaction_id
    where ma.user_id = :'TEST_LEARNER_USER_ID'::uuid
      and ma.mission_id = 'mission-p15b-alpha-proof'
      and ma.award_scope = 'programme:88888888-8888-4888-8888-888888888811:lifetime'
      and ma.organization_id = :'p15b_alpha_org_id'::uuid
      and ma.programme_id = '88888888-8888-4888-8888-888888888811'::uuid
      and ma.programme_mission_id = 'mission-p15b-alpha-proof'
      and xt.amount = 15
      and xt.metadata ->> 'awardedXp' = '15'
  ),
  'programme mission proof awards store trusted context and XP override'
);

reset role;
set local role service_role;

update public.programme_missions
set due_at = now() - interval '1 minute'
where programme_id = '88888888-8888-4888-8888-888888888811'::uuid
  and mission_id = 'mission-p15b-alpha-proof';

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  $$
    select public.award_valid_mission_xp(
      'mission-p15b-alpha-proof',
      'programme:88888888-8888-4888-8888-888888888811:lifetime-past-due'
    )
  $$,
  'P0001',
  'Programme mission is past its due date.',
  'programme mission due dates are enforced before awards'
);

reset role;
set local role service_role;

update public.programme_missions
set due_at = null
where programme_id = '88888888-8888-4888-8888-888888888811'::uuid
  and mission_id = 'mission-p15b-alpha-proof';

reset role;
select set_config('request.jwt.claim.sub', '8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8712', true);
set local role authenticated;

select extensions.throws_ok(
  $$
    select public.award_valid_mission_xp(
      'mission-p15b-alpha-proof',
      'programme:88888888-8888-4888-8888-888888888811:lifetime-outsider'
    )
  $$,
  'P0001',
  'Programme mission context is not available.',
  'programme mission award scopes remain isolated by organisation access'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.complete_lesson_page(
  'lesson-p15b-unattached-public',
  'page-p15b-unattached-public'
) as p15b_unattached_public_completion_result
\gset

select extensions.throws_ok(
  $$
    select public.award_valid_mission_xp(
      'mission-p15b-programme-lesson-count',
      'programme:88888888-8888-4888-8888-888888888811:lifetime'
    )
  $$,
  'P0001',
  'Mission is not complete.',
  'programme lesson-count missions ignore completed public lessons outside the programme'
);

select public.complete_lesson_page(
  'lesson-p15b-referral-qualification',
  'page-p15b-referral-qualification'
) as p15b_programme_lesson_completion_result
\gset

select public.award_valid_mission_xp(
  'mission-p15b-programme-lesson-count',
  'programme:88888888-8888-4888-8888-888888888811:lifetime'
) as p15b_programme_lesson_count_award
\gset

select extensions.ok(
  exists (
    select 1
    from public.mission_awards
    where user_id = :'TEST_LEARNER_USER_ID'::uuid
      and mission_id = 'mission-p15b-programme-lesson-count'
      and award_scope = 'programme:88888888-8888-4888-8888-888888888811:lifetime'
      and organization_id = :'p15b_alpha_org_id'::uuid
      and programme_id = '88888888-8888-4888-8888-888888888811'::uuid
  ),
  'programme lesson-count missions qualify from completed lessons attached to the programme'
);

select extensions.throws_ok(
  $$ select public.admin_set_mission_status('mission-p15b-platform-course', 'draft') $$,
  'P0001',
  'Only a platform admin can update platform mission status.',
  'organisation mission managers cannot change platform mission status'
);

reset role;
select set_config('request.jwt.claim.sub', '8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8712', true);
set local role authenticated;

select extensions.throws_ok(
  $$ select public.admin_set_mission_status('mission-p15b-alpha-course', 'draft') $$,
  'P0001',
  'Organization mission manager access required.',
  'organisation mission status changes remain scoped to the manager organisation'
);

select extensions.throws_ok(
  $$
    select public.admin_update_programme_mission_delivery(
      '88888888-8888-4888-8888-888888888811'::uuid,
      '{"mission-p15b-alpha-course":{"isRequired":false}}'::jsonb
    )
  $$,
  'P0001',
  'Programme manager access required.',
  'programme mission delivery changes remain scoped to the manager organisation'
);

select extensions.throws_ok(
  $$
    select public.admin_update_organization_mission(
      'mission-p15b-alpha-course',
      'P15B Alpha Course Mission Outsider Edit',
      'This edit must be rejected.',
      'course',
      10,
      'once',
      'course_completed',
      '{"courseId":"course-p15b-missions-platform"}'::jsonb,
      '{}'::jsonb,
      null,
      null,
      'published',
      1
    )
  $$,
  'P0001',
  'Organization mission manager access required.',
  'organisation mission edit changes remain scoped to the manager organisation'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  format(
    $$
      select public.admin_create_organization_mission(
        %L::uuid,
        'mission-p15b-alpha-referral-denied',
        'Denied Referral',
        'Starter should not allow referral missions.',
        'referral',
        20,
        'per_referral',
        'referral',
        'referral_friend_completed_lessons',
        '{"requiredFriendLessonCount":1}'::jsonb,
        '{}'::jsonb,
        null,
        null,
        'draft',
        2
      )
    $$,
    :'p15b_alpha_org_id'
  ),
  'P0001',
  'Organization is not entitled to this mission type.',
  'Starter organisations cannot create referral missions'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_create_organization_mission(
        %L::uuid,
        'mission-p15b-alpha-cross-tenant-course',
        'Cross Tenant Course',
        'This mission should not reference Beta private content.',
        'course',
        20,
        'once',
        'course_completed',
        'course_completed',
        '{"courseId":"course-p15b-beta-private"}'::jsonb,
        '{}'::jsonb,
        null,
        null,
        'draft',
        9
      )
    $$,
    :'p15b_alpha_org_id'
  ),
  'P0001',
  'Organization missions cannot reference private content from another organization.',
  'organisation mission creation rejects another tenant private course reference'
);

select public.admin_adapt_platform_mission(
  :'p15b_alpha_org_id'::uuid,
  'mission-p15b-platform-course',
  'mission-p15b-alpha-adapted',
  'Alpha Adapted Course Mission',
  null,
  '{"ctaLabel":"Start Alpha mission"}'::jsonb,
  'published'
) as adapted_result
\gset

select extensions.ok(
  exists (
    select 1
    from public.missions
    where id = 'mission-p15b-alpha-adapted'
      and catalog_scope = 'adapted_platform'
      and source_mission_id = 'mission-p15b-platform-course'
      and source_catalog_version = 1
      and presentation_config ->> 'ctaLabel' = 'Start Alpha mission'
  ),
  'adapted platform missions retain source provenance and local presentation changes'
);

select public.admin_update_organization_mission(
  'mission-p15b-alpha-course',
  'P15B Alpha Course Mission Updated',
  'Complete the configured course for Alpha after the local edit.',
  'course',
  35,
  'once',
  'course_completed',
  '{"courseId":"course-p15b-missions-platform"}'::jsonb,
  '{"title":"Alpha updated wording","successMessage":"Alpha proof accepted"}'::jsonb,
  null,
  null,
  'published',
  4
) as alpha_update_result
\gset

select extensions.ok(
  exists (
    select 1
    from public.missions
    where id = 'mission-p15b-alpha-course'
      and title = 'P15B Alpha Course Mission Updated'
      and reward_xp = 35
      and reward_mode = 'organization_xp'
      and presentation_config ->> 'title' = 'Alpha updated wording'
      and presentation_config ->> 'successMessage' = 'Alpha proof accepted'
      and configuration_version > 1
  ),
  'organisation mission managers can edit private mission execution and presentation configuration'
);

select public.admin_update_organization_mission(
  'mission-p15b-alpha-adapted',
  'Alpha Adapted Course Mission Updated',
  'Local copy changed without changing the source handler.',
  'feedback',
  999,
  'daily',
  'proof_upload',
  '{"requiredFields":["text"],"requiresManualReview":false}'::jsonb,
  '{"ctaLabel":"Continue Alpha mission"}'::jsonb,
  null,
  null,
  'published',
  5
) as adapted_update_result
\gset

select extensions.ok(
  exists (
    select 1
    from public.missions
    where id = 'mission-p15b-alpha-adapted'
      and title = 'Alpha Adapted Course Mission Updated'
      and source_mission_id = 'mission-p15b-platform-course'
      and catalog_scope = 'adapted_platform'
      and validation_type = 'course_completed'
      and validation_config = '{"courseId":"course-p15b-missions-platform"}'::jsonb
      and reward_xp = 25
      and presentation_config ->> 'ctaLabel' = 'Continue Alpha mission'
  ),
  'adapted mission edits preserve source execution while allowing local presentation changes'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_create_organization_mission(
        %L::uuid,
        'mission-p15b-alpha-over-limit',
        'Over Limit',
        'Starter should allow only two active missions.',
        'course',
        20,
        'once',
        'course_completed',
        'course_completed',
        '{"courseId":"course-p15b-missions-platform"}'::jsonb,
        '{}'::jsonb,
        null,
        null,
        'published',
        3
      )
    $$,
    :'p15b_alpha_org_id'
  ),
  'P0001',
  'Organization active mission limit reached.',
  'Starter active mission limit is enforced server-side'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select public.admin_update_mission(
  'mission-p15b-platform-course',
  'P15B Platform Course Mission Updated',
  'Complete the updated reusable platform course.',
  'course',
  'xp',
  25,
  null,
  'once',
  'course_completed',
  '{"courseId":"course-p15b-missions-platform"}'::jsonb,
  null,
  null,
  'published',
  950
) as updated_source_result
\gset

select extensions.ok(
  (
    select upstream_update_available
    from public.missions
    where id = 'mission-p15b-alpha-adapted'
  ),
  'platform mission updates mark local adaptations without overwriting them'
);

reset role;
set local role service_role;

select extensions.throws_ok(
  $$
    insert into public.missions (
      id,
      title,
      description,
      category,
      reward_type,
      reward_xp,
      repeatability,
      validation_type,
      validation_config,
      status,
      mission_type_key
    )
    values (
      'mission-p15b-unknown-type',
      'Unknown Type',
      'This mission should fail.',
      'course',
      'xp',
      10,
      'once',
      'course_completed',
      '{"courseId":"course-p15b-missions-platform"}'::jsonb,
      'draft',
      'unregistered_type'
    )
  $$,
  'P0001',
  'Mission type does not match validation capability.',
  'unknown or mismatched mission types cannot be created'
);

select extensions.throws_ok(
  $$
    insert into public.programme_missions (
      programme_id,
      mission_id,
      sort_order
    )
    values (
      '88888888-8888-4888-8888-888888888812'::uuid,
      'mission-p15b-alpha-course',
      1
    )
  $$,
  'P0001',
  'Organisation-owned missions can only be used by programmes in the same organisation.',
  'programme mission trigger blocks cross-organisation mission delivery'
);

insert into public.contextual_referral_tokens (
  token,
  referrer_user_id,
  organization_id,
  programme_id,
  programme_mission_id,
  destination,
  eligibility_policy,
  presentation_config,
  expires_at
)
values
  (
    'p15bAlphaReferralToken01',
    :'TEST_LEARNER_USER_ID'::uuid,
    :'p15b_alpha_org_id'::uuid,
    '88888888-8888-4888-8888-888888888811'::uuid,
    'mission-p15b-alpha-course',
    '/o/p15b-missions-alpha/learn',
    '{"requiredLessons":1}'::jsonb,
    '{"title":"Join Alpha"}'::jsonb,
    null
  ),
  (
    'p15bBetaReferralToken01',
    '8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8712'::uuid,
    :'p15b_beta_org_id'::uuid,
    '88888888-8888-4888-8888-888888888812'::uuid,
    'mission-p15b-beta-course',
    '/o/p15b-missions-beta/learn',
    '{"requiredLessons":2}'::jsonb,
    '{"title":"Join Beta"}'::jsonb,
    null
  ),
  (
    'p15bExpiredReferral01',
    :'TEST_LEARNER_USER_ID'::uuid,
    :'p15b_alpha_org_id'::uuid,
    '88888888-8888-4888-8888-888888888811'::uuid,
    'mission-p15b-alpha-course',
    '/o/p15b-missions-alpha/learn',
    '{}'::jsonb,
    '{}'::jsonb,
    now() - interval '1 day'
  ),
  (
    'p15bAlphaExternalAuto01',
    :'TEST_LEARNER_USER_ID'::uuid,
    :'p15b_alpha_org_id'::uuid,
    '88888888-8888-4888-8888-888888888811'::uuid,
    'mission-p15b-alpha-course',
    '/o/p15b-missions-alpha/learn',
    '{"enrolmentPolicy":"automatic"}'::jsonb,
    '{"title":"Join Alpha automatically"}'::jsonb,
    null
  ),
  (
    'p15bAlphaManualAccess01',
    :'TEST_LEARNER_USER_ID'::uuid,
    :'p15b_alpha_org_id'::uuid,
    '88888888-8888-4888-8888-888888888811'::uuid,
    'mission-p15b-alpha-course',
    '/o/p15b-missions-alpha/learn',
    '{"enrolmentPolicy":"manual_approval"}'::jsonb,
    '{"title":"Request Alpha access"}'::jsonb,
    null
  ),
  (
    'p15bAlphaExistingOnly01',
    :'TEST_LEARNER_USER_ID'::uuid,
    :'p15b_alpha_org_id'::uuid,
    '88888888-8888-4888-8888-888888888811'::uuid,
    'mission-p15b-alpha-course',
    '/o/p15b-missions-alpha/learn',
    '{"enrolmentPolicy":"existing_members_only"}'::jsonb,
    '{"title":"Members only"}'::jsonb,
    null
  )
on conflict (token) do update
  set referrer_user_id = excluded.referrer_user_id,
      organization_id = excluded.organization_id,
      programme_id = excluded.programme_id,
      programme_mission_id = excluded.programme_mission_id,
      destination = excluded.destination,
      eligibility_policy = excluded.eligibility_policy,
      presentation_config = excluded.presentation_config,
      expires_at = excluded.expires_at,
      status = excluded.status;

reset role;
set local role anon;

select extensions.is(
  (
    select public.resolve_referral_invite('p15bAlphaReferralToken01') ->> 'kind'
  ),
  'contextual',
  'anonymous invite resolution identifies available contextual referral links'
);

select extensions.is(
  (
    select public.resolve_referral_invite('p15bAlphaReferralToken01') #>> '{presentationConfig,title}'
  ),
  'Join Alpha',
  'contextual invite resolution returns organisation-specific presentation copy'
);

select extensions.is(
  (
    select public.resolve_referral_invite('p15bExpiredReferral01') ->> 'status'
  ),
  'invalid',
  'expired contextual referral links do not resolve for invite landing pages'
);

reset role;
select set_config('request.jwt.claim.sub', '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711', true);
set local role authenticated;

select public.accept_contextual_referral('p15bAlphaReferralToken01') as alpha_referral_result
\gset

select extensions.ok(
  exists (
    select 1
    from public.referral_attributions
    where referred_user_id = '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'::uuid
      and organization_id = :'p15b_alpha_org_id'::uuid
      and programme_id = '88888888-8888-4888-8888-888888888811'::uuid
      and programme_mission_id = 'mission-p15b-alpha-course'
      and eligibility_policy ->> 'requiredLessons' = '1'
  ),
  'contextual referral acceptance stores trusted organisation and programme mission context'
);

select public.accept_contextual_referral('p15bBetaReferralToken01') as beta_referral_result
\gset

select extensions.is(
  (
    select count(*)::integer
    from public.referral_attributions
    where referred_user_id = '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'::uuid
      and contextual_referral_token_id is not null
  ),
  2,
  'same learner can hold multiple contextual referral links in separate contexts'
);

select extensions.throws_ok(
  $$ select public.accept_contextual_referral('p15bAlphaReferralToken01') $$,
  'P0001',
  'A referral has already been applied for this context.',
  'duplicate contextual referral acceptance is rejected for the same context'
);

select extensions.throws_ok(
  $$ select public.accept_contextual_referral('p15bExpiredReferral01') $$,
  'P0001',
  'Referral link is not available.',
  'expired contextual referral links do not qualify'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  $$ select public.accept_contextual_referral('p15bAlphaReferralToken01') $$,
  'P0001',
  'You cannot use your own referral link.',
  'contextual referral acceptance keeps self-referral controls active'
);

reset role;
select set_config('request.jwt.claim.sub', '8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8712', true);
set local role authenticated;

select public.accept_contextual_referral('p15bAlphaExternalAuto01') as p15b_external_auto_referral_result
\gset

select extensions.ok(
  exists (
    select 1
    from public.enrolments
    where organization_id = :'p15b_alpha_org_id'::uuid
      and programme_id = '88888888-8888-4888-8888-888888888811'::uuid
      and user_id = '8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8712'::uuid
      and status = 'active'
      and metadata ->> 'source' = 'contextual_referral'
  )
  and not exists (
    select 1
    from public.organization_memberships
    where organization_id = :'p15b_alpha_org_id'::uuid
      and user_id = '8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8712'::uuid
  ),
  'automatic contextual referral creates programme enrolment without broad organization membership'
);

select extensions.is(
  (
    select count(*)::integer
    from public.missions
    where id = 'mission-p15b-alpha-course'
  ),
  1,
  'programme-only learners can read attached organization missions'
);

select extensions.is(
  (
    select count(*)::integer
    from public.missions
    where id = 'mission-p15b-alpha-adapted'
  ),
  0,
  'programme-only learners cannot read unrelated organization missions'
);

reset role;
select set_config('request.jwt.claim.sub', '9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9713', true);
set local role authenticated;

select public.accept_contextual_referral('p15bAlphaManualAccess01') ->> 'accessStatus' as p15b_manual_access_status
\gset

select extensions.is(
  :'p15b_manual_access_status'::text,
  'pending'::text,
  'manual-approval contextual referral returns pending access'
);

select extensions.ok(
  not exists (
    select 1
    from public.enrolments
    where organization_id = :'p15b_alpha_org_id'::uuid
      and programme_id = '88888888-8888-4888-8888-888888888811'::uuid
      and user_id = '9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9713'::uuid
  ),
  'manual-approval contextual referral does not claim programme access before approval'
);

reset role;
select set_config('request.jwt.claim.sub', '7d7d7d7d-7d7d-4d7d-8d7d-7d7d7d7d7714', true);
set local role authenticated;

select extensions.throws_ok(
  $$ select public.accept_contextual_referral('p15bAlphaExistingOnly01') $$,
  'P0001',
  'Referral requires an existing organization relationship.',
  'existing-members-only contextual referral rejects learners without an organization relationship'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.ensure_contextual_referral_token(
  '88888888-8888-4888-8888-888888888811'::uuid,
  'mission-p15b-platform-referral'
) ->> 'token' as p15b_contextual_referral_award_token
\gset

select extensions.ok(
  exists (
    select 1
    from public.contextual_referral_tokens
    where token = :'p15b_contextual_referral_award_token'
      and referrer_user_id = :'TEST_LEARNER_USER_ID'::uuid
      and organization_id = :'p15b_alpha_org_id'::uuid
      and programme_id = '88888888-8888-4888-8888-888888888811'::uuid
      and programme_mission_id = 'mission-p15b-platform-referral'
      and eligibility_policy ->> 'requiredFriendLessonCount' = '1'
  ),
  'contextual referral mission summaries can obtain trusted programme invite tokens'
);

reset role;
select set_config('request.jwt.claim.sub', '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711', true);
set local role authenticated;

select public.accept_contextual_referral(:'p15b_contextual_referral_award_token') as contextual_award_referral_result
\gset

select public.complete_lesson_page(
  'lesson-p15b-referral-qualification',
  'page-p15b-referral-qualification'
) as contextual_referral_completion_result
\gset

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  $$
    select public.award_valid_mission_xp(
      'mission-p15b-platform-referral',
      'referral:6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'
    )
  $$,
  'P0001',
  'Referral is not eligible yet.',
  'contextual referral attribution does not qualify public referral award scope'
);

select public.award_valid_mission_xp(
  'mission-p15b-platform-referral',
  'programme:88888888-8888-4888-8888-888888888811:referral:6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'
) as contextual_referral_award_result
\gset

select extensions.ok(
  exists (
    select 1
    from public.mission_awards ma
    join public.xp_transactions xt on xt.id = ma.xp_transaction_id
    where ma.user_id = :'TEST_LEARNER_USER_ID'::uuid
      and ma.mission_id = 'mission-p15b-platform-referral'
      and ma.award_scope = 'programme:88888888-8888-4888-8888-888888888811:referral:6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'
      and ma.organization_id = :'p15b_alpha_org_id'::uuid
      and ma.programme_id = '88888888-8888-4888-8888-888888888811'::uuid
      and ma.programme_mission_id = 'mission-p15b-platform-referral'
      and xt.amount = 45
  ),
  'contextual referral awards use programme mission scope, context and point overrides'
);

reset role;
select set_config('request.jwt.claim.sub', '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711', true);
set local role authenticated;

select public.award_valid_mission_xp(
  'mission-p15b-platform-course',
  'programme:88888888-8888-4888-8888-888888888811:lifetime'
) as p15b_alpha_shared_mission_award
\gset

select public.award_valid_mission_xp(
  'mission-p15b-platform-course',
  'programme:88888888-8888-4888-8888-888888888812:lifetime'
) as p15b_beta_shared_mission_award
\gset

select extensions.is(
  (
    select count(*)::integer
    from public.mission_awards
    where user_id = '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'::uuid
      and mission_id = 'mission-p15b-platform-course'
      and award_scope in (
        'programme:88888888-8888-4888-8888-888888888811:lifetime',
        'programme:88888888-8888-4888-8888-888888888812:lifetime'
      )
  ),
  2,
  'same base mission attached to two programmes produces independent delivery awards'
);

reset role;
select set_config('request.jwt.claim.sub', '8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8712', true);
set local role authenticated;

select extensions.throws_ok(
  $$
    select public.admin_review_mission_proof_submission(
      '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'::uuid,
      'mission-p15b-manual-proof-review',
      'programme:88888888-8888-4888-8888-888888888811:lifetime',
      'approved',
      null
    )
  $$,
  'P0001',
  'Only organization proof reviewers can review this mission proof.',
  'organization proof reviewers cannot review another organization proof'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.admin_review_mission_proof_submission(
  '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'::uuid,
  'mission-p15b-manual-proof-review',
  'programme:88888888-8888-4888-8888-888888888811:lifetime',
  'approved',
  null
) as p15b_alpha_manual_proof_review
\gset

select extensions.ok(
  exists (
    select 1
    from public.mission_proofs
    where user_id = '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'::uuid
      and mission_id = 'mission-p15b-manual-proof-review'
      and award_scope = 'programme:88888888-8888-4888-8888-888888888811:lifetime'
      and organization_id = :'p15b_alpha_org_id'::uuid
      and status = 'approved'
  ),
  'organization proof reviewer can approve proof in their organization context'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select public.admin_review_mission_proof_submission(
  '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'::uuid,
  'mission-p15b-manual-proof-review',
  'programme:88888888-8888-4888-8888-888888888812:lifetime',
  'approved',
  null
) as p15b_beta_manual_proof_review
\gset

select extensions.ok(
  exists (
    select 1
    from public.mission_proofs
    where user_id = '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'::uuid
      and mission_id = 'mission-p15b-manual-proof-review'
      and award_scope = 'programme:88888888-8888-4888-8888-888888888812:lifetime'
      and organization_id = :'p15b_beta_org_id'::uuid
      and status = 'approved'
  ),
  'platform admin can approve proof across organization contexts'
);

select extensions.ok(
  exists (
    select 1
    from public.audit_events
    where event_type = 'mission_proof_approved'
      and metadata ->> 'missionId' = 'mission-p15b-manual-proof-review'
      and metadata ->> 'organizationId' = :'p15b_alpha_org_id'
      and metadata ->> 'programmeId' = '88888888-8888-4888-8888-888888888811'
  ),
  'proof review audit events retain organization and programme context'
);

reset role;
set local role service_role;

insert into public.mission_proofs (
  user_id,
  mission_id,
  award_scope,
  proof_type,
  value,
  status,
  organization_id,
  programme_id,
  programme_mission_id
)
values (
  '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6711'::uuid,
  'mission-p15b-alpha-course',
  'programme:88888888-8888-4888-8888-888888888811',
  'text',
  'Completed in context',
  'submitted',
  :'p15b_alpha_org_id'::uuid,
  '88888888-8888-4888-8888-888888888811'::uuid,
  'mission-p15b-alpha-course'
);

reset role;
select set_config('request.jwt.claim.sub', '8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8712', true);
set local role authenticated;

select extensions.is(
  (
    select count(*)::integer
    from public.mission_proofs
    where organization_id = :'p15b_alpha_org_id'::uuid
  ),
  0,
  'organisation proof context does not leak to staff from another organisation'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.is(
  (
    select count(*)::integer
    from public.mission_proofs
    where organization_id = :'p15b_alpha_org_id'::uuid
      and mission_id = 'mission-p15b-alpha-course'
  ),
  1,
  'authorised organisation mission staff can view contextual proof submissions'
);

reset role;
set local role anon;

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.admin_create_organization_mission(uuid, text, text, text, public.mission_category, integer, public.mission_repeatability, text, public.mission_validation_type, jsonb, jsonb, timestamp with time zone, timestamp with time zone, public.content_status, integer)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.admin_create_organization_mission(uuid, text, text, text, public.mission_category, integer, public.mission_repeatability, text, public.mission_validation_type, jsonb, jsonb, timestamp with time zone, timestamp with time zone, public.content_status, integer)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.admin_update_organization_mission(text, text, text, public.mission_category, integer, public.mission_repeatability, public.mission_validation_type, jsonb, jsonb, timestamp with time zone, timestamp with time zone, public.content_status, integer)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.admin_update_organization_mission(text, text, text, public.mission_category, integer, public.mission_repeatability, public.mission_validation_type, jsonb, jsonb, timestamp with time zone, timestamp with time zone, public.content_status, integer)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.accept_contextual_referral(text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.accept_contextual_referral(text)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.ensure_contextual_referral_token(uuid, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.ensure_contextual_referral_token(uuid, text)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.admin_update_programme_mission_delivery(uuid, jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.admin_update_programme_mission_delivery(uuid, jsonb)',
    'execute'
  )
  and has_function_privilege(
    'anon',
    'public.resolve_referral_invite(text)',
    'execute'
  ),
  'organization mission, programme mission delivery and contextual referral RPC grants stay explicit'
);

reset role;

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'admin_create_organization_mission'
      and classification = 'ADMIN_AUTHENTICATED'
  )
  and exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'accept_contextual_referral'
      and classification = 'PUBLIC_AUTHENTICATED_SELF'
  )
  and exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'ensure_contextual_referral_token'
      and classification = 'PUBLIC_AUTHENTICATED_SELF'
  )
  and exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'admin_update_programme_mission_delivery'
      and classification = 'ADMIN_AUTHENTICATED'
  )
  and exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'admin_update_organization_mission'
      and classification = 'ADMIN_AUTHENTICATED'
  )
  and exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'resolve_referral_invite'
      and classification = 'PUBLIC_ANON'
  )
  and exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'enforce_organization_mission_content_scope'
      and classification = 'TRIGGER_ONLY'
  ),
  'new P1.5B RPCs are classified'
);

select * from extensions.finish();

rollback;
