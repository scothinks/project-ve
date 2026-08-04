begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(21);

set local role service_role;

insert into public.organizations (slug, name, status, created_by)
values
  ('lms-engagement-alpha', 'LMS Engagement Alpha', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('lms-engagement-beta', 'LMS Engagement Beta', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status;

select id as engagement_alpha_org_id
from public.organizations
where slug = 'lms-engagement-alpha'
\gset

select id as engagement_beta_org_id
from public.organizations
where slug = 'lms-engagement-beta'
\gset

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values
  (:'engagement_alpha_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'programme_manager', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'engagement_beta_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (organization_id, user_id, role) do update
  set status = excluded.status,
      invited_by = excluded.invited_by;

insert into public.programmes (
  organization_id,
  slug,
  title,
  objective,
  intended_audience,
  status
)
values
  (
    :'engagement_alpha_org_id'::uuid,
    'lms-engagement-alpha-primary',
    'LMS Engagement Alpha Primary',
    'Attach engagement rewards.',
    'Alpha learners',
    'draft'
  ),
  (
    :'engagement_alpha_org_id'::uuid,
    'lms-engagement-alpha-secondary',
    'LMS Engagement Alpha Secondary',
    'Different sponsor boundary.',
    'Alpha learners',
    'draft'
  ),
  (
    :'engagement_beta_org_id'::uuid,
    'lms-engagement-beta-primary',
    'LMS Engagement Beta Primary',
    'Beta tenant programme.',
    'Beta learners',
    'draft'
  )
on conflict (organization_id, slug) do update
  set title = excluded.title,
      objective = excluded.objective,
      intended_audience = excluded.intended_audience,
      status = excluded.status;

select id as engagement_alpha_programme_id
from public.programmes
where organization_id = :'engagement_alpha_org_id'::uuid
  and slug = 'lms-engagement-alpha-primary'
\gset

select id as engagement_alpha_second_programme_id
from public.programmes
where organization_id = :'engagement_alpha_org_id'::uuid
  and slug = 'lms-engagement-alpha-secondary'
\gset

select id as engagement_beta_programme_id
from public.programmes
where organization_id = :'engagement_beta_org_id'::uuid
  and slug = 'lms-engagement-beta-primary'
\gset

insert into public.rewards (
  id,
  title,
  description,
  cost_xp,
  status,
  is_enabled,
  distribution_mode,
  fulfillment_type,
  visibility_mode,
  total_available,
  total_uploaded,
  per_user_limit,
  limit_period,
  sort_order,
  owner_scope,
  organization_id,
  sponsored_programme_id,
  shared_with_programmes
)
values
  (
    'reward-lms-engagement-shared-platform',
    'LMS Engagement Shared Platform Reward',
    'Shared Project VE programme reward.',
    100,
    'published',
    true,
    'direct',
    'manual',
    'system_only',
    10,
    10,
    1,
    'lifetime',
    950,
    'platform_owned',
    null,
    null,
    true
  ),
  (
    'reward-lms-engagement-platform-private',
    'LMS Engagement Platform Private Reward',
    'Platform reward not shared with programmes.',
    100,
    'published',
    true,
    'direct',
    'manual',
    'system_only',
    10,
    10,
    1,
    'lifetime',
    951,
    'platform_owned',
    null,
    null,
    false
  ),
  (
    'reward-lms-engagement-alpha-org',
    'LMS Engagement Alpha Organisation Reward',
    'Alpha tenant owned reward.',
    100,
    'published',
    true,
    'direct',
    'manual',
    'system_only',
    10,
    10,
    1,
    'lifetime',
    952,
    'organization_owned',
    :'engagement_alpha_org_id'::uuid,
    null,
    false
  ),
  (
    'reward-lms-engagement-beta-org',
    'LMS Engagement Beta Organisation Reward',
    'Beta tenant owned reward.',
    100,
    'published',
    true,
    'direct',
    'manual',
    'system_only',
    10,
    10,
    1,
    'lifetime',
    953,
    'organization_owned',
    :'engagement_beta_org_id'::uuid,
    null,
    false
  ),
  (
    'reward-lms-engagement-alpha-sponsored',
    'LMS Engagement Alpha Sponsored Reward',
    'Reward sponsored by the primary alpha programme.',
    100,
    'published',
    true,
    'direct',
    'manual',
    'system_only',
    10,
    10,
    1,
    'lifetime',
    954,
    'programme_sponsored',
    :'engagement_alpha_org_id'::uuid,
    :'engagement_alpha_programme_id'::uuid,
    false
  ),
  (
    'reward-lms-engagement-alpha-sponsored-other',
    'LMS Engagement Other Alpha Sponsored Reward',
    'Reward sponsored by another alpha programme.',
    100,
    'published',
    true,
    'direct',
    'manual',
    'system_only',
    10,
    10,
    1,
    'lifetime',
    955,
    'programme_sponsored',
    :'engagement_alpha_org_id'::uuid,
    :'engagement_alpha_second_programme_id'::uuid,
    false
  )
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      is_enabled = excluded.is_enabled,
      owner_scope = excluded.owner_scope,
      organization_id = excluded.organization_id,
      sponsored_programme_id = excluded.sponsored_programme_id,
      shared_with_programmes = excluded.shared_with_programmes;

insert into public.missions (
  id,
  title,
  description,
  category,
  reward_type,
  reward_xp,
  reward_id,
  repeatability,
  validation_type,
  validation_config,
  status,
  sort_order
)
values
  (
    'mission-lms-engagement-alpha-reward',
    'LMS Engagement Alpha Reward Mission',
    'Alpha programme mission with an alpha reward.',
    'custom',
    'reward',
    null,
    'reward-lms-engagement-alpha-org',
    'once',
    'manual_review',
    '{}'::jsonb,
    'published',
    950
  ),
  (
    'mission-lms-engagement-beta-reward',
    'LMS Engagement Beta Reward Mission',
    'Mission with a beta-owned reward.',
    'custom',
    'reward',
    null,
    'reward-lms-engagement-beta-org',
    'once',
    'manual_review',
    '{}'::jsonb,
    'published',
    951
  )
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      reward_type = excluded.reward_type,
      reward_id = excluded.reward_id;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.admin_upsert_programme(
  :'engagement_alpha_programme_id'::uuid,
  :'engagement_alpha_org_id'::uuid,
  'LMS Engagement Alpha Primary',
  'lms-engagement-alpha-primary',
  'Attach engagement rewards.',
  'Alpha learners',
  'draft',
  null,
  null,
  '{}'::jsonb,
  '{}'::text[],
  array['mission-lms-engagement-alpha-reward']::text[],
  array[
    'reward-lms-engagement-shared-platform',
    'reward-lms-engagement-alpha-org',
    'reward-lms-engagement-alpha-sponsored'
  ]::text[],
  '{}'::uuid[]
) as valid_programme_result
\gset

select extensions.is(
  (
    select string_agg(reward_id, ',' order by sort_order)
    from public.programme_rewards
    where programme_id = :'engagement_alpha_programme_id'::uuid
  ),
  'reward-lms-engagement-shared-platform,reward-lms-engagement-alpha-org,reward-lms-engagement-alpha-sponsored',
  'programme can attach shared platform, same-organisation and own sponsored rewards'
);

select extensions.is(
  (
    select count(*)::integer
    from public.programme_missions
    where programme_id = :'engagement_alpha_programme_id'::uuid
      and mission_id = 'mission-lms-engagement-alpha-reward'
  ),
  1,
  'programme can attach reward-granting missions whose reward is available to the programme'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_upsert_programme(
        %L::uuid,
        %L::uuid,
        'LMS Engagement Alpha Primary',
        'lms-engagement-alpha-primary',
        'Attach engagement rewards.',
        'Alpha learners',
        'draft',
        null,
        null,
        '{}'::jsonb,
        '{}'::text[],
        '{}'::text[],
        array['reward-lms-engagement-platform-private']::text[],
        '{}'::uuid[]
      )
    $$,
    :'engagement_alpha_programme_id',
    :'engagement_alpha_org_id'
  ),
  'P0001',
  'Programme rewards must be shared platform rewards, organisation-owned rewards for the same organisation, or rewards sponsored by this programme.',
  'programme cannot attach unshared platform rewards'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_upsert_programme(
        %L::uuid,
        %L::uuid,
        'LMS Engagement Alpha Primary',
        'lms-engagement-alpha-primary',
        'Attach engagement rewards.',
        'Alpha learners',
        'draft',
        null,
        null,
        '{}'::jsonb,
        '{}'::text[],
        '{}'::text[],
        array['reward-lms-engagement-beta-org']::text[],
        '{}'::uuid[]
      )
    $$,
    :'engagement_alpha_programme_id',
    :'engagement_alpha_org_id'
  ),
  'P0001',
  'Programme rewards must be shared platform rewards, organisation-owned rewards for the same organisation, or rewards sponsored by this programme.',
  'programme cannot attach organisation-owned rewards from another organisation'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_upsert_programme(
        %L::uuid,
        %L::uuid,
        'LMS Engagement Alpha Primary',
        'lms-engagement-alpha-primary',
        'Attach engagement rewards.',
        'Alpha learners',
        'draft',
        null,
        null,
        '{}'::jsonb,
        '{}'::text[],
        '{}'::text[],
        array['reward-lms-engagement-alpha-sponsored-other']::text[],
        '{}'::uuid[]
      )
    $$,
    :'engagement_alpha_programme_id',
    :'engagement_alpha_org_id'
  ),
  'P0001',
  'Programme rewards must be shared platform rewards, organisation-owned rewards for the same organisation, or rewards sponsored by this programme.',
  'programme cannot attach rewards sponsored by a different programme'
);

select extensions.is(
  (
    select count(*)::integer
    from public.programme_rewards
    where programme_id = :'engagement_alpha_programme_id'::uuid
  ),
  3,
  'failed reward attachment leaves previous valid programme rewards intact'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select public.admin_set_reward_lms_ownership(
  'reward-lms-engagement-platform-private',
  'platform_owned',
  null,
  null,
  true
) as share_private_platform_result
\gset

select extensions.ok(
  (
    select shared_with_programmes
    from public.rewards
    where id = 'reward-lms-engagement-platform-private'
  ),
  'platform admin can explicitly share a platform reward with programmes'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.admin_upsert_programme(
  :'engagement_alpha_programme_id'::uuid,
  :'engagement_alpha_org_id'::uuid,
  'LMS Engagement Alpha Primary',
  'lms-engagement-alpha-primary',
  'Attach engagement rewards.',
  'Alpha learners',
  'draft',
  null,
  null,
  '{}'::jsonb,
  '{}'::text[],
  '{}'::text[],
  array['reward-lms-engagement-platform-private']::text[],
  '{}'::uuid[]
) as now_shared_programme_result
\gset

select extensions.is(
  (
    select count(*)::integer
    from public.programme_rewards
    where programme_id = :'engagement_alpha_programme_id'::uuid
      and reward_id = 'reward-lms-engagement-platform-private'
  ),
  1,
  'programme can attach a platform reward after it is explicitly shared'
);

reset role;
set local role service_role;

select extensions.throws_ok(
  format(
    $$ insert into public.programme_rewards (programme_id, reward_id, sort_order) values (%L::uuid, 'reward-lms-engagement-beta-org', 20) $$,
    :'engagement_alpha_programme_id'
  ),
  'P0001',
  'Programme rewards must be shared platform rewards, organisation-owned rewards for the same organisation, or rewards sponsored by this programme.',
  'programme reward trigger blocks cross-tenant rewards outside the RPC'
);

select extensions.throws_ok(
  format(
    $$ insert into public.programme_missions (programme_id, mission_id, sort_order) values (%L::uuid, 'mission-lms-engagement-beta-reward', 20) $$,
    :'engagement_alpha_programme_id'
  ),
  'P0001',
  'Programme missions with reward grants must use rewards available to the programme.',
  'programme mission trigger blocks missions whose reward is not available to the programme'
);

select extensions.throws_ok(
  format(
    $$
      update public.rewards
      set owner_scope = 'programme_sponsored',
          organization_id = %L::uuid,
          sponsored_programme_id = %L::uuid
      where id = 'reward-lms-engagement-beta-org'
    $$,
    :'engagement_beta_org_id',
    :'engagement_alpha_programme_id'
  ),
  'P0001',
  'Programme-sponsored reward organisation must match the programme organisation.',
  'reward ownership trigger rejects sponsored programme organisation drift'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  $$ select public.current_programme_can_use_reward('11111111-1111-4111-8111-111111111111'::uuid, 'reward-lms-engagement-shared-platform') $$,
  '42501',
  'permission denied for function current_programme_can_use_reward',
  'authenticated callers cannot execute programme reward helper directly'
);

select extensions.throws_ok(
  $$
    select public.admin_set_reward_lms_ownership(
      'reward-lms-engagement-alpha-org',
      'organization_owned',
      null,
      null,
      false
    )
  $$,
  'P0001',
  'Only an admin can manage reward ownership.',
  'non-admin cannot change reward ownership'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select extensions.throws_ok(
  $$
    select public.admin_set_reward_lms_ownership(
      'reward-lms-engagement-alpha-org',
      'organization_owned',
      null,
      null,
      false
    )
  $$,
  '42501',
  'permission denied for function admin_set_reward_lms_ownership',
  'anon cannot execute reward ownership RPC'
);

reset role;

select extensions.ok(
  has_function_privilege('authenticated', 'public.admin_set_reward_lms_ownership(text, public.lms_reward_owner_scope, uuid, uuid, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.admin_set_reward_lms_ownership(text, public.lms_reward_owner_scope, uuid, uuid, boolean)', 'execute'),
  'reward ownership RPC is authenticated only before in-function admin checks'
);

select extensions.ok(
  not has_function_privilege('authenticated', 'public.enforce_programme_reward_scope()', 'execute')
  and not has_function_privilege('service_role', 'public.enforce_programme_reward_scope()', 'execute'),
  'programme reward enforcement trigger is not directly executable by API roles'
);

select extensions.ok(
  not has_function_privilege('authenticated', 'public.enforce_programme_mission_reward_scope()', 'execute')
  and not has_function_privilege('service_role', 'public.enforce_programme_mission_reward_scope()', 'execute'),
  'programme mission reward enforcement trigger is not directly executable by API roles'
);

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'admin_set_reward_lms_ownership'
      and classification = 'ADMIN_AUTHENTICATED'
  ),
  'reward ownership RPC is explicitly classified'
);

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'current_programme_can_use_reward'
      and classification = 'INTERNAL_HELPER'
  )
  and exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'enforce_programme_reward_scope'
      and classification = 'TRIGGER_ONLY'
  ),
  'programme engagement helper and trigger are explicitly classified'
);

select extensions.ok(
  exists (
    select 1
    from public.rewards
    where id = 'reward-lms-engagement-alpha-sponsored'
      and owner_scope = 'programme_sponsored'
      and organization_id = :'engagement_alpha_org_id'::uuid
      and sponsored_programme_id = :'engagement_alpha_programme_id'::uuid
  ),
  'programme-sponsored reward records its organisation and programme sponsor'
);

select extensions.ok(
  exists (
    select 1
    from public.rewards
    where id = 'reward-lms-engagement-alpha-org'
      and owner_scope = 'organization_owned'
      and organization_id = :'engagement_alpha_org_id'::uuid
      and sponsored_programme_id is null
  ),
  'organisation-owned reward records its tenant without a sponsored programme'
);

select * from extensions.finish();

rollback;
