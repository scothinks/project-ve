begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, private;

select extensions.plan(30);

select extensions.ok(
  private.organization_entitlements_are_valid(
    '{"daily_quiz_xp_limit":25,"admin_manual_grant_daily_limit":100}'::jsonb,
    false
  ),
  'XP entitlement keys accept non-negative integers'
);

select extensions.ok(
  not private.organization_entitlements_are_valid(
    '{"daily_quiz_xp_limit":1.5}'::jsonb,
    false
  ),
  'XP entitlement keys reject fractional values'
);

select extensions.ok(
  not private.organization_entitlements_are_valid(
    '{"unknown_xp_limit":10}'::jsonb,
    false
  ),
  'the central entitlement validator still rejects unknown keys'
);

set local session_replication_role = replica;

insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('30110000-0000-4000-8000-000000000001'::uuid, 'authenticated', 'authenticated', 'workspace-xp-owner-a@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('30110000-0000-4000-8000-000000000002'::uuid, 'authenticated', 'authenticated', 'workspace-xp-owner-b@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('30110000-0000-4000-8000-000000000003'::uuid, 'authenticated', 'authenticated', 'workspace-xp-viewer@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('30110000-0000-4000-8000-000000000004'::uuid, 'authenticated', 'authenticated', 'workspace-xp-learner@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('30110000-0000-4000-8000-000000000005'::uuid, 'authenticated', 'authenticated', 'workspace-xp-catalog-owner@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do update
set email = excluded.email,
    updated_at = now();

set local session_replication_role = origin;

set local role service_role;

insert into public.profiles (id, display_name, role)
values
  ('30110000-0000-4000-8000-000000000001'::uuid, 'Workspace XP Owner A', 'learner'),
  ('30110000-0000-4000-8000-000000000002'::uuid, 'Workspace XP Owner B', 'learner'),
  ('30110000-0000-4000-8000-000000000003'::uuid, 'Workspace XP Viewer', 'learner'),
  ('30110000-0000-4000-8000-000000000004'::uuid, 'Workspace XP Learner', 'learner'),
  ('30110000-0000-4000-8000-000000000005'::uuid, 'Workspace XP Catalog Owner', 'learner')
on conflict (id) do update
set display_name = excluded.display_name,
    role = excluded.role,
    updated_at = now();

insert into public.organizations (id, slug, name, status, created_by)
values
  ('30110000-0000-4000-8000-000000000101'::uuid, 'workspace-xp-org-a', 'Workspace XP Org A', 'published', '30110000-0000-4000-8000-000000000001'::uuid),
  ('30110000-0000-4000-8000-000000000102'::uuid, 'workspace-xp-org-b', 'Workspace XP Org B', 'published', '30110000-0000-4000-8000-000000000002'::uuid)
on conflict (id) do update
set name = excluded.name,
    status = excluded.status,
    updated_at = now();

insert into public.organization_memberships (
  organization_id, user_id, role, status, invited_by
)
values
  ('30110000-0000-4000-8000-000000000101'::uuid, '30110000-0000-4000-8000-000000000001'::uuid, 'organisation_owner', 'active', '30110000-0000-4000-8000-000000000001'::uuid),
  ('30110000-0000-4000-8000-000000000102'::uuid, '30110000-0000-4000-8000-000000000002'::uuid, 'organisation_owner', 'active', '30110000-0000-4000-8000-000000000002'::uuid),
  ('30110000-0000-4000-8000-000000000101'::uuid, '30110000-0000-4000-8000-000000000003'::uuid, 'reviewer', 'active', '30110000-0000-4000-8000-000000000001'::uuid),
  ('30110000-0000-4000-8000-000000000101'::uuid, '30110000-0000-4000-8000-000000000004'::uuid, 'instructor', 'active', '30110000-0000-4000-8000-000000000001'::uuid)
on conflict (organization_id, user_id, role) do update
set status = excluded.status,
    updated_at = now();

insert into public.platform_catalog_memberships (
  user_id, role, status, invited_by
)
values
  ('30110000-0000-4000-8000-000000000005'::uuid, 'organisation_owner', 'active', '30110000-0000-4000-8000-000000000005'::uuid),
  ('30110000-0000-4000-8000-000000000003'::uuid, 'content_editor', 'active', '30110000-0000-4000-8000-000000000005'::uuid)
on conflict (user_id, role) do update
set status = excluded.status,
    updated_at = now();

reset role;

insert into public.organization_entitlement_overrides (
  organization_id, entitlements, reason, created_by
)
values (
  '30110000-0000-4000-8000-000000000101'::uuid,
  '{"max_courses":2}'::jsonb,
  'Existing pilot override',
  '30110000-0000-4000-8000-000000000001'::uuid
)
on conflict (organization_id) where ended_at is null do update
set entitlements = excluded.entitlements,
    updated_at = now();

reset role;
select set_config('request.jwt.claim.sub', '30110000-0000-4000-8000-000000000001', true);
set local role authenticated;

select extensions.is(
  public.admin_get_workspace_xp_settings('30110000-0000-4000-8000-000000000101'::uuid) ->> 'dailyQuizSource',
  'platform_default',
  'an organisation without XP keys initially inherits the platform default'
);

select extensions.is(
  public.admin_get_workspace_xp_settings('30110000-0000-4000-8000-000000000101'::uuid) ->> 'canManage',
  'true',
  'an organisation owner can manage their workspace XP settings'
);

select extensions.is(
  public.admin_save_workspace_xp_settings(
    '30110000-0000-4000-8000-000000000101'::uuid,
    15,
    10
  ) ->> 'defaultDailyQuizXpLimit',
  '15',
  'an organisation owner can save a custom quiz cap'
);

select extensions.is(
  public.resolve_organization_entitlements('30110000-0000-4000-8000-000000000101'::uuid) ->> 'admin_manual_grant_daily_limit',
  '10',
  'the central entitlement resolver exposes the custom manual-grant limit'
);

select extensions.is(
  (
    select entitlements ->> 'max_courses'
    from public.organization_entitlement_overrides
    where organization_id = '30110000-0000-4000-8000-000000000101'::uuid
      and ended_at is null
  ),
  '2',
  'saving XP settings preserves unrelated entitlement overrides'
);

reset role;

select extensions.ok(
  exists (
    select 1
    from public.audit_events
    where event_type = 'workspace_xp_settings_updated'
      and entity_id = '30110000-0000-4000-8000-000000000101'
  ),
  'organisation XP settings changes are audited'
);

reset role;
select set_config('request.jwt.claim.sub', '30110000-0000-4000-8000-000000000002', true);
set local role authenticated;

select extensions.is(
  public.admin_get_workspace_xp_settings('30110000-0000-4000-8000-000000000102'::uuid) ->> 'dailyQuizSource',
  'platform_default',
  'a different organisation remains on the platform fallback'
);

select extensions.throws_like(
  $$ select public.admin_get_workspace_xp_settings('30110000-0000-4000-8000-000000000101'::uuid) $$,
  '%cannot read XP settings for this workspace%',
  'an owner cannot read another organisation through the scoped RPC'
);

select extensions.throws_like(
  $$ select public.admin_save_workspace_xp_settings('30110000-0000-4000-8000-000000000101'::uuid, 99, 99) $$,
  '%cannot manage XP settings for this organisation%',
  'an owner cannot update another organisation through the scoped RPC'
);

select extensions.is_empty(
  $$
    select 1
    from public.organization_entitlement_overrides
    where organization_id = '30110000-0000-4000-8000-000000000101'::uuid
  $$,
  'override table RLS hides another organisation from an owner'
);

reset role;
select set_config('request.jwt.claim.sub', '30110000-0000-4000-8000-000000000003', true);
set local role authenticated;

select extensions.is(
  public.admin_get_workspace_xp_settings('30110000-0000-4000-8000-000000000101'::uuid) ->> 'canManage',
  'false',
  'a non-manager organisation staff member receives read-only settings'
);

select extensions.throws_like(
  $$ select public.admin_save_workspace_xp_settings('30110000-0000-4000-8000-000000000101'::uuid, 20, 20) $$,
  '%cannot manage XP settings for this organisation%',
  'a non-manager organisation staff member cannot save settings'
);

select extensions.is(
  public.admin_get_workspace_xp_settings(null) ->> 'canManage',
  'false',
  'a non-manager Platform Catalog staff member receives read-only defaults'
);

select extensions.throws_like(
  $$ select public.admin_save_workspace_xp_settings(null, 20, 20) $$,
  '%cannot manage Platform Catalog XP settings%',
  'a non-manager Platform Catalog staff member cannot change defaults'
);

reset role;
select set_config('request.jwt.claim.sub', '30110000-0000-4000-8000-000000000005', true);
set local role authenticated;

select extensions.is(
  public.admin_save_workspace_xp_settings(null, 40, 400) ->> 'scope',
  'platform_catalog',
  'a Platform Catalog owner can update the platform defaults'
);

select extensions.is(
  (select default_daily_quiz_xp_limit::text || ':' || admin_manual_grant_daily_limit::text from public.xp_settings where id = 1),
  '40:400',
  'the Platform Catalog save updates the singleton fallback row'
);

reset role;
select set_config('request.jwt.claim.sub', '30110000-0000-4000-8000-000000000002', true);
set local role authenticated;

select extensions.is(
  public.admin_get_workspace_xp_settings('30110000-0000-4000-8000-000000000102'::uuid) ->> 'defaultDailyQuizXpLimit',
  '40',
  'an organisation without overrides inherits the updated Platform Catalog default'
);

reset role;
select set_config('request.jwt.claim.sub', '30110000-0000-4000-8000-000000000001', true);
set local role authenticated;

select extensions.is(
  public.admin_get_workspace_xp_settings('30110000-0000-4000-8000-000000000101'::uuid) ->> 'defaultDailyQuizXpLimit',
  '15',
  'an organisation custom value is isolated from later platform-default changes'
);

reset role;
set local role service_role;

insert into public.courses (
  id, slug, title, description, intended_audience, learning_outcomes,
  category, level, status, sort_order, estimated_minutes,
  catalog_scope, organization_id
)
values (
  'course-workspace-xp-settings',
  'course-workspace-xp-settings',
  'Workspace XP Settings Course',
  'Scoped quiz cap fixture.',
  'Organisation learners',
  array['Verify scoped XP caps'],
  'Values Education',
  'beginner',
  'published',
  30110,
  5,
  'organization_private',
  '30110000-0000-4000-8000-000000000101'::uuid
)
on conflict (id) do update
set status = excluded.status,
    organization_id = excluded.organization_id;

insert into public.lessons (
  id, course_id, slug, title, description, status, sort_order, estimated_minutes
)
values (
  'lesson-workspace-xp-settings',
  'course-workspace-xp-settings',
  'lesson-workspace-xp-settings',
  'Workspace XP Settings Lesson',
  'Scoped quiz cap fixture.',
  'published',
  1,
  5
)
on conflict (id) do update set status = excluded.status;

insert into public.quizzes (id, lesson_id, title, version, status)
values (
  'quiz-workspace-xp-settings',
  'lesson-workspace-xp-settings',
  'Workspace XP Settings Quiz',
  1,
  'published'
)
on conflict (id) do update set status = excluded.status;

insert into public.quiz_questions (
  id, quiz_id, question_order, question_type, prompt, explanation, xp
)
values (
  'question-workspace-xp-settings',
  'quiz-workspace-xp-settings',
  1,
  'single_choice',
  'Which cap should this quiz use?',
  'The organisation override.',
  10
)
on conflict (id) do update set xp = excluded.xp;

insert into public.quiz_options (id, question_id, option_order, label, is_correct)
values
  ('option-workspace-xp-settings-correct', 'question-workspace-xp-settings', 1, 'Organisation cap', true),
  ('option-workspace-xp-settings-wrong', 'question-workspace-xp-settings', 2, 'Another organisation cap', false)
on conflict (id) do update set is_correct = excluded.is_correct;

reset role;
select set_config('request.jwt.claim.sub', '30110000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.admin_save_workspace_xp_settings(
  '30110000-0000-4000-8000-000000000101'::uuid,
  5,
  10
);

reset role;
select set_config('request.jwt.claim.sub', '30110000-0000-4000-8000-000000000004', true);
set local role authenticated;

select extensions.is(
  public.start_quiz_attempt(
    'quiz-workspace-xp-settings',
    'lesson-workspace-xp-settings',
    null,
    '30110000-0000-4000-8000-000000000101'::uuid
  ) ->> 'reason',
  'daily_cap_reached',
  'quiz start respects the organisation custom cap'
);

reset role;
select set_config('request.jwt.claim.sub', '30110000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.admin_save_workspace_xp_settings(
  '30110000-0000-4000-8000-000000000101'::uuid,
  15,
  10
);

reset role;
select set_config('request.jwt.claim.sub', '30110000-0000-4000-8000-000000000004', true);
set local role authenticated;

select public.start_quiz_attempt(
  'quiz-workspace-xp-settings',
  'lesson-workspace-xp-settings',
  null,
  '30110000-0000-4000-8000-000000000101'::uuid
) as started_attempt
\gset

select extensions.is(
  :'started_attempt'::jsonb ->> 'dailyXpLimit',
  '15',
  'quiz start returns the resolved organisation cap'
);

reset role;
select set_config('request.jwt.claim.sub', '30110000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.admin_save_workspace_xp_settings(
  '30110000-0000-4000-8000-000000000101'::uuid,
  5,
  10
);

reset role;
select set_config('request.jwt.claim.sub', '30110000-0000-4000-8000-000000000004', true);
set local role authenticated;

select public.answer_quiz_question(
  (:'started_attempt'::jsonb ->> 'attemptId')::uuid,
  'question-workspace-xp-settings',
  array['option-workspace-xp-settings-correct']::text[]
) as answer_result
\gset

select extensions.is(
  :'answer_result'::jsonb ->> 'status',
  'daily_cap_deferred',
  'quiz answer issuance re-resolves and enforces the organisation cap'
);

select extensions.is_empty(
  $$
    select 1
    from public.xp_transactions
    where user_id = '30110000-0000-4000-8000-000000000004'::uuid
      and source_type = 'quiz_question'
      and source_id = 'question-workspace-xp-settings'
  $$,
  'a deferred answer does not issue XP'
);

reset role;
select set_config('request.jwt.claim.sub', '30110000-0000-4000-8000-000000000001', true);
set local role authenticated;

select extensions.is(
  public.admin_adjust_xp_account(
    (
      select id
      from public.xp_accounts
      where organization_id = '30110000-0000-4000-8000-000000000101'::uuid
        and is_default
    ),
    '30110000-0000-4000-8000-000000000004'::uuid,
    7,
    'earn',
    'Focused cap test'
  ) ->> 'remainingToday',
  '3',
  'the organisation manual-grant limit is enforced and reports remaining capacity'
);

select extensions.throws_like(
  format(
    $$
      select public.admin_adjust_xp_account(
        %L::uuid,
        '30110000-0000-4000-8000-000000000004'::uuid,
        4,
        'earn',
        'Over cap'
      )
    $$,
    (
      select id
      from public.xp_accounts
      where organization_id = '30110000-0000-4000-8000-000000000101'::uuid
        and is_default
    )
  ),
  '%Daily admin grant limit reached. 3 XP remaining today%',
  'a second grant cannot exceed the organisation daily manual-grant limit'
);

reset role;

select extensions.is(
  (
    select coalesce(sum(amount), 0)::text
    from public.xp_transactions
    where user_id = '30110000-0000-4000-8000-000000000004'::uuid
      and source_type = 'adjustment'
      and metadata ->> 'adjustedBy' = '30110000-0000-4000-8000-000000000001'
  ),
  '7',
  'the rejected over-cap grant does not create another ledger row'
);

select extensions.function_privs_are(
  'public',
  'admin_save_workspace_xp_settings',
  array['uuid', 'integer', 'integer'],
  'authenticated',
  array['EXECUTE'],
  'authenticated callers can reach the scoped save RPC for authorization checks'
);

select extensions.function_privs_are(
  'public',
  'admin_save_workspace_xp_settings',
  array['uuid', 'integer', 'integer'],
  'anon',
  array[]::text[],
  'anonymous callers cannot execute the scoped save RPC'
);

select * from extensions.finish();
rollback;
