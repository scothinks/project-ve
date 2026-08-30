begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, private;

select extensions.plan(31);

set local session_replication_role = replica;

insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('30120000-0000-4000-8000-000000000001'::uuid, 'authenticated', 'authenticated', 'catalog-boundary-manager@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('30120000-0000-4000-8000-000000000002'::uuid, 'authenticated', 'authenticated', 'catalog-boundary-editor@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('30120000-0000-4000-8000-000000000003'::uuid, 'authenticated', 'authenticated', 'catalog-boundary-org-owner@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('30120000-0000-4000-8000-000000000004'::uuid, 'authenticated', 'authenticated', 'catalog-boundary-outsider@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do update set email = excluded.email, updated_at = now();

set local session_replication_role = origin;
set local role service_role;

insert into public.profiles (id, display_name, role)
values
  ('30120000-0000-4000-8000-000000000001'::uuid, 'Catalog Boundary Manager', 'learner'),
  ('30120000-0000-4000-8000-000000000002'::uuid, 'Catalog Boundary Editor', 'learner'),
  ('30120000-0000-4000-8000-000000000003'::uuid, 'Catalog Boundary Org Owner', 'learner'),
  ('30120000-0000-4000-8000-000000000004'::uuid, 'Catalog Boundary Outsider', 'learner')
on conflict (id) do update
set display_name = excluded.display_name, role = excluded.role, updated_at = now();

insert into public.organizations (id, slug, name, status, created_by)
values (
  '30120000-0000-4000-8000-000000000101'::uuid,
  'catalog-boundary-org',
  'Catalog Boundary Org',
  'published',
  '30120000-0000-4000-8000-000000000003'::uuid
)
on conflict (id) do update set name = excluded.name, status = excluded.status, updated_at = now();

insert into public.organization_memberships (organization_id, user_id, role, status, invited_by)
values (
  '30120000-0000-4000-8000-000000000101'::uuid,
  '30120000-0000-4000-8000-000000000003'::uuid,
  'organisation_owner',
  'active',
  '30120000-0000-4000-8000-000000000003'::uuid
)
on conflict (organization_id, user_id, role) do update
set status = excluded.status, updated_at = now();

insert into public.platform_catalog_memberships (user_id, role, status, invited_by)
values
  ('30120000-0000-4000-8000-000000000001'::uuid, 'organisation_owner', 'active', '30120000-0000-4000-8000-000000000001'::uuid),
  ('30120000-0000-4000-8000-000000000002'::uuid, 'content_editor', 'active', '30120000-0000-4000-8000-000000000001'::uuid)
on conflict (user_id, role) do update set status = excluded.status, updated_at = now();

insert into public.campaigns (id, slug, name, description, status)
values ('catalog-boundary-campaign', 'catalog-boundary-campaign', 'Catalog Boundary Campaign', 'Boundary fixture.', 'draft')
on conflict (id) do update set status = excluded.status, updated_at = now();

insert into public.rewards (
  id, title, description, cost_xp, status, is_enabled, campaign_id,
  owner_scope, organization_id, xp_account_id
)
values
  (
    'reward-catalog-boundary-platform', 'Catalog Boundary Platform Reward', 'Platform fixture.',
    25, 'published', false, 'catalog-boundary-campaign', 'platform_owned', null,
    '00000000-0000-4000-8000-00000000e001'::uuid
  ),
  (
    'reward-catalog-boundary-org', 'Catalog Boundary Org Reward', 'Organisation fixture.',
    25, 'published', false, 'catalog-boundary-campaign', 'organization_owned',
    '30120000-0000-4000-8000-000000000101'::uuid,
    (select id from public.xp_accounts where organization_id = '30120000-0000-4000-8000-000000000101'::uuid and is_default limit 1)
  )
on conflict (id) do update
set is_enabled = excluded.is_enabled, campaign_id = excluded.campaign_id, updated_at = now();

insert into public.courses (
  id, slug, title, description, intended_audience, learning_outcomes,
  category, level, status, sort_order, estimated_minutes, catalog_scope, organization_id
)
values
  (
    'course-catalog-boundary-platform', 'course-catalog-boundary-platform', 'Catalog Boundary Platform Course',
    'Platform fixture.', 'Learners', array['Test catalog boundaries'], 'Values Education', 'beginner',
    'draft', 30120, 5, 'platform', null
  ),
  (
    'course-catalog-boundary-org', 'course-catalog-boundary-org', 'Catalog Boundary Org Course',
    'Organisation fixture.', 'Organisation learners', array['Test tenant boundaries'], 'Values Education', 'beginner',
    'draft', 30121, 5, 'organization_private', '30120000-0000-4000-8000-000000000101'::uuid
  )
on conflict (id) do update set title = excluded.title, status = excluded.status, organization_id = excluded.organization_id;

insert into public.missions (
  id, title, description, category, reward_xp, repeatability, validation_type,
  validation_config, status, sort_order, mission_type_key, catalog_scope,
  organization_id, reward_mode, delivery_scope
)
values (
  'mission-catalog-boundary-org', 'Catalog Boundary Org Mission', 'Organisation mission fixture.',
  'course', 10, 'once', 'course_completed', '{"courseId":"course-catalog-boundary-platform"}'::jsonb,
  'draft', 30120, 'course_completed', 'organization_private',
  '30120000-0000-4000-8000-000000000101'::uuid, 'organization_xp', 'organization'
)
on conflict (id) do update set status = excluded.status, organization_id = excluded.organization_id;

insert into public.assessment_versions (
  id, slug, title, description, xp_award, status, owner_scope,
  organization_id, version_number, introduction_copy, completion_copy, scoring_config
)
values (
  '30120000-0000-4000-8000-000000000201'::uuid,
  'catalog-boundary-platform-assessment', 'Catalog Boundary Assessment', 'Platform assessment fixture.',
  0, 'draft', 'platform', null, 1, 'Begin.', 'Done.', '{}'::jsonb
)
on conflict (id) do update set status = excluded.status, owner_scope = excluded.owner_scope, organization_id = excluded.organization_id;

insert into public.assessment_questions (id, assessment_version_id, prompt, question_type, sort_order)
values (
  '30120000-0000-4000-8000-000000000211'::uuid,
  '30120000-0000-4000-8000-000000000201'::uuid,
  'Which option best fits?', 'single_select', 1
)
on conflict (id) do update set prompt = excluded.prompt;

insert into public.assessment_question_options (id, question_id, label, sort_order)
values
  ('30120000-0000-4000-8000-000000000221'::uuid, '30120000-0000-4000-8000-000000000211'::uuid, 'First', 1),
  ('30120000-0000-4000-8000-000000000222'::uuid, '30120000-0000-4000-8000-000000000211'::uuid, 'Second', 2)
on conflict (id) do update set label = excluded.label;

update public.assessment_versions
set status = 'published', published_at = now()
where id = '30120000-0000-4000-8000-000000000201'::uuid;

reset role;
select set_config('request.jwt.claim.sub', '30120000-0000-4000-8000-000000000001', true);
set local role authenticated;

select extensions.ok(
  exists(select 1 from public.campaigns where id = 'catalog-boundary-campaign'),
  'a Catalog reward manager can read reward campaigns'
);

select extensions.is(
  public.admin_upsert_campaign(
    'catalog-boundary-campaign', 'Catalog Boundary Campaign Updated', 'Updated.', null, null, 'Boundary budget'
  ) ->> 'status',
  'updated',
  'a Catalog reward manager can update a campaign'
);

select extensions.is(
  public.admin_set_reward_campaign_enabled('catalog-boundary-campaign', true) ->> 'updatedRewards',
  '1',
  'the set-wise campaign operation updates only the platform reward for a Catalog caller'
);

select extensions.ok(
  (select is_enabled from public.rewards where id = 'reward-catalog-boundary-platform'),
  'the linked platform reward is enabled'
);

reset role;
set local role service_role;

select extensions.ok(
  not (select is_enabled from public.rewards where id = 'reward-catalog-boundary-org'),
  'the linked organisation reward is unchanged by the Catalog campaign operation'
);

reset role;
select set_config('request.jwt.claim.sub', '30120000-0000-4000-8000-000000000001', true);
set local role authenticated;

select extensions.throws_like(
  $$ select public.admin_set_campaign_enabled('catalog-boundary-campaign', false) $$,
  '%Only an admin can manage campaigns%',
  'the legacy cross-scope campaign RPC remains platform-admin-only'
);

select extensions.throws_like(
  $$ select public.admin_set_reward_enabled('reward-catalog-boundary-org', true) $$,
  '%Only an admin can update reward availability%',
  'a Catalog reward manager cannot mutate an organisation reward'
);

select extensions.is(
  (public.admin_update_platform_xp_account_presentation(
    '00000000-0000-4000-8000-00000000e001'::uuid,
    'Impact Point', 'Impact Points', 'IP', 'sparkles', 'amount_short_label', 'active'
  )).display_name,
  'Impact Point',
  'a Catalog manager can update platform Points presentation'
);

select extensions.is(
  (public.admin_update_platform_xp_account_controls(
    '00000000-0000-4000-8000-00000000e001'::uuid,
    'NGN', 0.25, 30, 100000, 1000, 50000, 25000, 50000
  )).accounting_currency,
  'NGN',
  'a Catalog manager can update platform issuance and exposure controls'
);

select extensions.is(
  public.admin_adjust_platform_xp_account(
    '00000000-0000-4000-8000-00000000e001'::uuid,
    '30120000-0000-4000-8000-000000000002'::uuid,
    7, 'earn', 'Catalog boundary test'
  ) ->> 'xpAccountId',
  '00000000-0000-4000-8000-00000000e001',
  'a Catalog manager can make an audited platform Points adjustment'
);

reset role;
set local role service_role;

select extensions.is(
  (
    select amount::text
    from public.xp_transactions
    where user_id = '30120000-0000-4000-8000-000000000002'::uuid
      and xp_account_id = '00000000-0000-4000-8000-00000000e001'::uuid
      and source_type = 'adjustment'
    order by created_at desc
    limit 1
  ),
  '7',
  'the platform adjustment posts to the platform ledger'
);

select extensions.ok(
  exists(
    select 1 from public.audit_events
    where event_type = 'platform_xp_account_adjusted'
      and actor_user_id = '30120000-0000-4000-8000-000000000001'::uuid
  ),
  'the platform Points adjustment records its actor in the audit log'
);

reset role;
select set_config('request.jwt.claim.sub', '30120000-0000-4000-8000-000000000002', true);
set local role authenticated;

select extensions.ok(
  public.current_user_can_edit_course('course-catalog-boundary-platform'),
  'a Catalog content editor can edit a platform course'
);

select extensions.ok(
  not public.current_user_can_edit_course('course-catalog-boundary-org'),
  'a Catalog content editor cannot edit an organisation course'
);

select extensions.results_eq(
  $$
    update public.courses
    set title = 'Catalog Boundary Platform Course Updated'
    where id = 'course-catalog-boundary-platform'
    returning title
  $$,
  $$ values ('Catalog Boundary Platform Course Updated'::text) $$,
  'platform-course RLS permits scoped editorial updates'
);

update public.courses
set title = 'Catalog Editor Must Not Write This'
where id = 'course-catalog-boundary-org';

reset role;
set local role service_role;

select extensions.is(
  (select title from public.courses where id = 'course-catalog-boundary-org'),
  'Catalog Boundary Org Course',
  'platform-course RLS prevents a Catalog editor from changing organisation content'
);

reset role;
select set_config('request.jwt.claim.sub', '30120000-0000-4000-8000-000000000002', true);
set local role authenticated;

select extensions.lives_ok(
  $$
    insert into public.content_value_tags (
      content_type, content_id, dimension_id, weight, recommended_level, outcome_type
    ) values (
      'course', 'course-catalog-boundary-platform', 'integrity', 0.5, 'beginner', 'awareness'
    )
  $$,
  'a Catalog content editor can tag platform content'
);

select extensions.throws_like(
  $$
    insert into public.content_value_tags (
      content_type, content_id, dimension_id, weight, recommended_level, outcome_type
    ) values (
      'course', 'course-catalog-boundary-org', 'integrity', 0.5, 'beginner', 'awareness'
    )
  $$,
  '%row-level security policy%',
  'a Catalog content editor cannot tag organisation content'
);

select extensions.lives_ok(
  $$
    select public.admin_create_mission(
      'mission-catalog-boundary-platform',
      'Catalog Boundary Platform Mission',
      'Platform mission fixture.',
      'custom',
      'xp',
      10,
      null,
      'once',
      'manual_review',
      '{"instructions":"Review completion."}'::jsonb,
      null,
      null,
      'draft',
      30120
    )
  $$,
  'a Catalog content editor can create a platform mission'
);

select extensions.is(
  public.admin_set_mission_status('mission-catalog-boundary-platform', 'published') ->> 'status',
  'published',
  'a Catalog content editor can publish a platform mission'
);

select extensions.throws_like(
  $$ select public.admin_set_mission_status('mission-catalog-boundary-org', 'published') $$,
  '%Organization mission manager access required%',
  'a Catalog content editor cannot publish an organisation mission'
);

select extensions.ok(
  exists(
    select 1 from public.assessment_versions
    where id = '30120000-0000-4000-8000-000000000201'::uuid
  ),
  'Catalog assessment RLS exposes the platform assessment source'
);

select public.admin_create_organization_assessment_revision(
  null,
  '30120000-0000-4000-8000-000000000201'::uuid,
  'Catalog Boundary Assessment Revision',
  'catalog-boundary-platform-assessment-revision',
  'Platform revision.',
  'Begin revision.',
  'Complete revision.'
) as catalog_revision_result
\gset

select extensions.ok(
  nullif(:'catalog_revision_result', '') is not null,
  'a Catalog content editor can create a platform assessment revision'
);

select extensions.is(
  (
    select owner_scope || ':' || coalesce(organization_id::text, 'null')
    from public.assessment_versions
    where id = (:'catalog_revision_result'::jsonb ->> 'assessmentVersionId')::uuid
  ),
  'platform:null',
  'the Catalog assessment revision remains platform-owned'
);

select extensions.throws_like(
  $$
    select public.admin_create_organization_assessment_revision(
      '30120000-0000-4000-8000-000000000101'::uuid,
      '30120000-0000-4000-8000-000000000201'::uuid,
      'Forbidden Organisation Revision',
      'forbidden-organisation-revision',
      '', '', ''
    )
  $$,
  '%Assessment manager access required%',
  'a Catalog content editor cannot create an organisation assessment revision'
);

select extensions.throws_like(
  $$
    select public.admin_update_platform_xp_account_presentation(
      '00000000-0000-4000-8000-00000000e001'::uuid,
      'Forbidden', 'Forbidden', 'NO', 'coins', 'amount_name', 'active'
    )
  $$,
  '%Platform Catalog manager access required%',
  'a non-manager Catalog editor cannot change platform Points controls'
);

reset role;
select set_config('request.jwt.claim.sub', '30120000-0000-4000-8000-000000000004', true);
set local role authenticated;

select extensions.is_empty(
  format(
    'select 1 from public.assessment_versions where id = %L::uuid',
    (:'catalog_revision_result'::jsonb ->> 'assessmentVersionId')
  ),
  'an outsider cannot read a draft platform assessment revision'
);

select extensions.is_empty(
  $$ select 1 from public.campaigns where id = 'catalog-boundary-campaign' $$,
  'an outsider cannot read Catalog reward campaigns'
);

select extensions.throws_like(
  $$ select public.admin_upsert_campaign('', 'Outsider Campaign', '', null, null, '') $$,
  '%Only an admin can manage campaigns%',
  'an outsider cannot create a Catalog reward campaign'
);

reset role;
select set_config('request.jwt.claim.sub', '30120000-0000-4000-8000-000000000003', true);
set local role authenticated;

select extensions.ok(
  not public.current_user_can_edit_course('course-catalog-boundary-platform'),
  'an organisation owner is not implicitly a Platform Catalog course editor'
);

select extensions.throws_like(
  $$ select public.admin_upsert_campaign('', 'Organisation Campaign', '', null, null, '') $$,
  '%Only an admin can manage campaigns%',
  'an organisation owner is not implicitly a Platform Catalog reward manager'
);

select * from extensions.finish();
rollback;
