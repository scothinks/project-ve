# Project Ve CMS/LMS Remediation Addendum

# Phase 1.5: Org Mode and Institutional Pilot Readiness

## Document status

This document is an addendum to the existing **Project Ve CMS and LMS Product Remediation Plan**.

It is based on the current repository snapshot:

```text
project-ve-main (14).zip
```

The following phases remain closed:

```text
CMS P0: CLOSED
Hybrid LMS P1: CLOSED
Phase 1.5: IMPLEMENTED AND LOCALLY VALIDATED
```

Closure record, 2026-08-30: P1.5A through P1.5F are implemented and the final
aggregate local release gate passes. P0/P1 architecture is closed. P2 remains
blocked until hosted query statistics and plans provide the evidence required by
the performance plan; local Docker timings are not a substitute for that hosted
evidence.

This addendum inserts a new phase:

```text
P1
→ P1.5 Org Mode and Institutional Pilot Readiness
→ P2 Enterprise and Institutional Expansion
```

The Phase 2 items in the original remediation document remain valid, but Codex must not begin Phase 2 until the required Phase 1.5 tickets in this addendum have been implemented, tested and accepted.

Where this addendum conflicts with earlier P1.5 notes or assumptions, this document takes precedence.

---

# 0. Codex execution instructions

## 0.1 Do not implement the whole addendum in one pass

Phase 1.5 is divided into ordered delivery batches:

```text
P1.5A  Org Mode, plans and self-service organisations
P1.5B  Organisation-configurable missions
P1.5C  Scoped and white-labelled XP
P1.5D  Contextual assessments and recommendations
P1.5E  Institutional supervision and operations
P1.5F  Final Phase 1 UI cleanup
```

Codex must implement one authorised batch at a time.

For the first implementation pass:

```text
Implement P1.5A only.
```

After completing P1.5A:

1. run all required tests;
2. provide a completion report;
3. identify migrations and affected routes;
4. provide screenshots or recordings of the new workflows;
5. stop for review;
6. do not begin P1.5B.

The same stop-and-review rule applies after every subsequent batch.

## 0.2 Preserve completed architecture

Do not reopen or replace accepted P0/P1 architecture unless a Phase 1.5 ticket explicitly requires an extension.

In particular:

* retain the current modular monolith;
* retain Supabase and the existing RLS model;
* retain contextual organisation roles;
* retain the current course catalogue model;
* retain programmes, cohorts, assignments and enrolments;
* retain the current mission engine;
* retain the current XP ledger and hardened XP transaction primitives;
* retain the current reward and fulfilment model;
* retain the existing learner routes and components;
* retain the current CMS component stack.

## 0.3 Governing implementation principle

Phase 1.5 must generalise and contextualise existing systems.

It must not create parallel systems for capabilities Project Ve already has.

```text
Current missions
→ platform-supported, organisation-configurable missions

Current XP ledger
→ account-scoped and white-labelled XP

Current learner application
→ Public Mode and Org Mode workspaces

Current organisation administration
→ self-service and institution-operable workflows

Current assessment engine
→ public and organisation-specific assessment contexts

Current rewards
→ account-aware and plan-governed organisation rewards
```

## 0.4 Mandatory component foundation

Continue using:

```text
shadcn/ui-style Project Ve components
Radix primitives
dnd-kit
Tiptap
TanStack Table
Tailwind
```

Do not introduce a competing component framework, editor, table system or drag-and-drop library without explicit approval.

---

# 1. Current repository baseline

## 1.1 Administration context

The current repository already supports:

```text
features/admin/application/context.ts
components/admin/AdminShell.tsx
app/admin/layout.tsx
```

Current capabilities include:

* platform-admin workspaces;
* organisation workspaces;
* server-readable workspace selection;
* contextual organisation roles;
* role-sensitive administration navigation;
* organisation-scoped course, programme, cohort, reward and reporting operations.

The current organisation roles are:

```text
organisation_owner
organisation_admin
programme_manager
content_editor
reviewer
instructor
report_viewer
learner
```

The current administration context uses:

```text
project-ve-admin-workspace
```

as its selected workspace cookie.

Phase 1.5 should reuse this pattern when introducing learner workspace context.

---

## 1.2 Organisations

The current organisation model is primarily defined through:

```text
supabase/migrations/20260802120000_lms_organizations_memberships.sql
supabase/migrations/20260804100000_lms_p1_closure.sql
supabase/migrations/20260804103000_lms_organization_profile_visibility.sql
```

Current tables include:

```text
organizations
organization_roles
organization_memberships
```

The current `organizations` model contains:

```text
id
slug
name
status
created_by
created_at
updated_at
```

The current administration UI is mainly:

```text
app/admin/organizations/page.tsx
app/admin/organizations/actions.ts
features/organizations/admin/data.ts
```

It allows platform administrators to:

* create an organisation;
* update its name, slug and status;
* assign an existing user;
* assign a contextual role;
* change membership status.

Current limitations include:

* organisation creation is platform-admin-only;
* there is no self-service creation policy;
* there is no plan or entitlement model;
* there is no organisation lifecycle distinct from content status;
* there is no organisation verification state;
* there is no complete invitation lifecycle;
* there is no CSV learner onboarding;
* there is no organisation branding profile;
* there is no learner-facing Org Mode.

---

## 1.3 Learner navigation

The current primary learner navigation is implemented in:

```text
components/navigation/BottomNav.tsx
```

It currently contains:

```text
Home
Lesson
Missions
Store
```

The existing learner surfaces include:

```text
/dashboard
/courses
/courses/[id]
/lessons/[id]
/missions
/xp-store
/profile
/profile/transcript
/notifications
```

Phase 1.5 must extend these surfaces rather than create a second learner frontend.

---

## 1.4 Missions

The current mission system includes:

```text
missions
mission_awards
mission_proofs
programme_missions
referral_attributions
referral_link_visits
```

Relevant application files include:

```text
app/admin/missions/
components/admin/MissionEditorForm.tsx
lib/missions.ts
lib/supabase-missions.ts
features/app/repositories/missions.ts
app/api/missions/
```

The current mission validation types include:

```text
course_completed
lesson_completed
lesson_count_completed
referral_friend_completed_lessons
proof_upload
manual_review
```

The current engine supports:

* one-time missions;
* daily missions;
* weekly missions;
* campaign missions;
* per-referral missions;
* automated completion;
* proof submission;
* manual review;
* XP awards;
* direct reward awards;
* programme attachment;
* referral attribution;
* learner progress;
* audit events.

Current limitations include:

* mission definitions are platform-global;
* mission capability and learner-facing communication are combined;
* mission types are hardcoded in the editor and validation switch;
* mission types cannot be enabled per organisation or plan;
* organisations cannot maintain private or adapted mission catalogues;
* programme-level mission configuration is limited;
* referral context is not first-class by organisation and programme;
* mission proofs and awards do not retain complete delivery context.

---

## 1.5 XP and rewards

The current XP architecture includes:

```text
profiles.xp_balance_cached
xp_transactions
xp_settings
private.post_xp_transaction(...)
```

Current XP sources include:

```text
quiz_question
mission
reward_redemption
adjustment
assessment
```

The current reward architecture includes:

```text
rewards
reward_redemptions
reward_inventory_items
manual claim details
voucher codes
QR codes
external links
native rewards
perk bundles
```

P1 added reward ownership scopes:

```text
platform_owned
organization_owned
programme_sponsored
```

Reward visibility and tenant eligibility are already enforced.

The current economic limitation is that every learner still has one global balance:

```text
profiles.xp_balance_cached
```

Therefore tenant reward access is isolated, but spending power is not yet isolated.

---

## 1.6 Assessments and recommendations

The current public assessment and recommendation foundation includes:

```text
value_dimensions
assessment_versions
assessment_questions
assessment_question_options
assessment_option_dimension_weights
user_assessment_attempts
user_assessment_answers
user_value_profiles
user_value_dimension_scores
content_value_tags
```

The current public assessment is:

```text
values-starter-check-v1
```

Relevant files include:

```text
app/onboarding/assessment/page.tsx
app/onboarding/assessment/actions.ts
lib/values-assessment.ts
lib/personalized-recommendations.ts
features/recommendations/domain/scoring.ts
```

The current dashboard checks whether the learner has completed the public assessment:

```text
app/dashboard/page.tsx
```

and redirects incomplete learners to:

```text
/onboarding/assessment
```

The current learner value profile is effectively global because:

```text
user_value_profiles
primary identity = user_id
```

Programmes may attach existing assessment versions through:

```text
programme_assessments
```

but organisation users cannot currently author, adapt or configure assessment questions and weights through a dedicated organisation assessment workspace.

---

## 1.7 Course media and lesson blocks

The current lesson content block types are:

```text
text
image
video
audio
table
callout
```

Video and audio support already exists in the lesson model and learner rendering.

Phase 1.5 must not create new video/audio block types.

Plan restrictions should control which existing block types an organisation may create.

---

# 2. Locked Phase 1.5 product decisions

## 2.1 One identity, multiple workspaces

Project Ve must retain one learner identity.

A user may operate in:

```text
Project Ve Public
Nigeria Police
Church A
Corporate Organisation B
```

without creating separate accounts.

Org Mode is a contextual state of the current Project Ve learner experience.

It is not a separate authentication product.

---

## 2.2 Org Mode navigation

Add:

```text
Org Mode
```

to the current primary learner navigation.

The menu becomes:

```text
Home
Lesson
Missions
Store
Org Mode
```

Org Mode must be visible even when:

* the visitor has not joined an organisation;
* the visitor is signed out;
* the visitor has no pending invitations;
* the visitor has not completed the public values assessment.

---

## 2.3 Org Mode landing page

The primary Org Mode route should be:

```text
/org
```

This page is an **About Project Ve for Organisations** and conversion page.

It should explain:

* what Project Ve offers organisations;
* learning and programme delivery;
* missions;
* organisation points;
* rewards;
* progress and reporting;
* the Starter plan;
* what paid plans unlock.

Primary calls to action:

```text
Create an Organisation
Enter Org Mode
```

`Enter Org Mode` leads to:

```text
/org/my
```

It does not request an organisation ID.

---

## 2.4 No public organisation directory

Phase 1.5 must not introduce a public organisation directory.

Learners should not be expected to know an organisation ID or search for an organisation.

Initial organisation access is invitation-first.

```text
Organisation sends invitation
→ learner receives notification and email
→ learner accepts invitation
→ organisation appears in My Orgs
```

Subsequent access uses:

```text
Org Mode
→ My Orgs
→ select organisation
```

There should be no public list of organisations or publicly browsable organisation catalogue in Phase 1.5.

---

## 2.5 Public learning remains available

Joining an organisation must not remove access to Project Ve public learning.

An organisation learner must always be able to return to:

```text
Project Ve Public
```

through:

* the learner workspace switcher;
* a visible `Return to Project Ve` or `Explore Project Ve` action;
* the normal public routes.

An organisation must not ordinarily disable public Project Ve access.

Restricted dedicated deployments remain a later Phase 2 capability.

---

## 2.6 Organisation content is invitation or enrolment based

A public learner may access organisation learning after:

* accepting an organisation invitation;
* accepting a programme invitation;
* receiving an explicit course or programme enrolment.

A programme-only invite does not have to create broad organisation membership.

An externally invited learner may receive access only to:

* the invited programme;
* its courses;
* its missions;
* its rewards;
* its points account.

RLS remains the security boundary.

Workspace-aware application queries must determine what belongs in the active learner experience.

---

## 2.7 Organisation points are white-labelled XP

Project Ve must use one XP engine.

Organisation points are account-scoped XP balances with custom presentation.

Example:

```text
Project Ve Public
2,400 XP

Nigeria Police
350 Police Points

Church A
85 Leadership Points
```

Required isolation:

```text
Project Ve XP cannot purchase Police rewards.
Police Points cannot purchase public rewards.
Police Points cannot purchase Church rewards.
Church Points cannot purchase Police rewards.
```

There is no points transfer or points exchange in Phase 1.5.

---

## 2.8 Organisation missions use platform-supported mission types

Project Ve owns executable mission capabilities.

Organisations configure:

* the supported rules;
* the audience;
* the programme context;
* the award;
* the learner-facing title;
* the instructions;
* the CTA;
* the success and pending messages.

Example:

```text
Canonical capability:
referral

Police presentation:
Bring a Fellow Officer Onboard

Church presentation:
Invite Someone to Grow With You
```

The underlying referral engine is built once.

---

## 2.9 Starter is the self-service entry plan

The lowest organisation plan is:

```text
Starter
```

“Self-service” describes how the organisation is created.

It is not the permanent name of the plan.

The initial plan structure is:

```text
Starter
Team
Professional
Enterprise
```

Plans must be represented as entitlements, not scattered plan-name conditionals.

Billing status, verification status and plan assignment must remain separate concepts.

---

## 2.10 Starter entitlement package

The initial Starter plan must include:

```text
1 course
5 lessons total
Text and image-oriented lesson creation
No video or audio blocks
No AI authoring
1 organisation points account
2 supported automatic mission types
Maximum 2 active missions
1 active manual claim-form reward
Basic reporting
Invitation-only organisation access
Private organisation visibility
```

Starter-supported content block types:

```text
text
image
table
callout
```

Starter-disabled block types:

```text
video
audio
```

Starter image storage should have a configurable plan quota.

Initial default:

```text
100 MB per Starter organisation
```

This value must come from the plan entitlement configuration.

---

## 2.11 Starter mission entitlement

Starter receives the following mission types:

```text
course_completed
lesson_count_completed
```

Starter missions may award only:

```text
organisation XP
```

They may not:

* award a reward directly;
* use referrals;
* use proof uploads;
* require manual mission review;
* invoke external validation;
* award another organisation’s XP.

The interface may describe the award as a points bonus or XP boost, but Phase 1.5 does not need a separate multiplier engine.

---

## 2.12 Starter reward entitlement

Starter receives:

```text
1 active reward item
```

Allowed fulfilment:

```text
manual claim form
```

The organisation is responsible for fulfilment.

Project Ve tracks:

```text
Submitted
Processing
Fulfilled
Rejected
Cancelled
```

Starter claim-form fields should initially support:

```text
short text
long text
email
phone
single select
```

Starter should not support file uploads inside reward claim forms.

Initial quota defaults:

```text
Maximum open claims: 25
Maximum fulfilled claims per calendar month: 25
```

Rejected and cancelled claims do not count against the fulfilled-claim quota.

Open-claim capacity is released when a claim is:

* fulfilled;
* rejected;
* cancelled.

These values must come from plan entitlements and must not be hardcoded throughout the application.

---

## 2.13 Public and organisation assessments are contextual

The current Project Ve Values Starter Check remains the public recommendation assessment.

It must not block an invited organisation learner from entering assigned organisation learning.

Public-first flow:

```text
Create Project Ve account
→ complete public Values Starter Check
→ receive public recommendations
→ enter Public Mode
```

Organisation-invited flow:

```text
Accept organisation invitation
→ authenticate
→ enter organisation workspace
→ begin assigned learning
```

When the learner later enters Public Mode, Project Ve may require or prompt completion of the public assessment.

Organisation assessments are required only when:

* a programme selects one;
* the organisation plan permits it;
* the programme marks it as required.

---

# 3. Organisation plan and entitlement model

## 3.1 Required model

Introduce an organisation plan system.

Recommended structures:

```text
organization_plans
organization_plan_assignments
organization_entitlement_overrides
```

`organization_plans` should contain:

```text
key
name
description
status
entitlements
created_at
updated_at
```

`entitlements` may use validated JSONB if all access goes through a central typed resolver.

Do not read arbitrary entitlement keys throughout the UI.

Create one typed application service such as:

```text
resolveOrganizationEntitlements(organizationId)
```

The resolver should return a stable typed contract.

---

## 3.2 Required organisation commercial and governance fields

Extend the organisation model with separate fields or linked records for:

```text
plan_key
billing_status
verification_status
creation_source
lifecycle_status
```

Suggested values:

### Creation source

```text
platform_admin
self_service
sales_assisted
imported
```

### Billing status

```text
free
trial
active
past_due
cancelled
sponsored
```

### Verification status

```text
unverified
verification_pending
verified
rejected
```

### Lifecycle status

```text
trial
active
suspended
archived
```

Do not reuse `content_status` to represent all these concerns.

---

## 3.3 Initial plan capabilities

### Starter

Exact limits are defined in this document.

### Team

Expected positioning:

* additional courses and lessons;
* larger learner and storage limits;
* Project Ve assessment templates;
* more mission types;
* additional manual rewards;
* more reporting;
* no unrestricted custom assessment dimensions.

### Professional

Expected positioning:

* advanced mission types;
* adapted assessment templates;
* AI access with usage limits;
* organisation units;
* instructor operations;
* expanded reporting;
* larger reward and points limits.

### Enterprise

Expected positioning:

* custom governance;
* custom assessment dimensions;
* advanced integrations;
* SSO and provisioning later;
* dedicated support;
* custom deployment options later.

Exact commercial prices are outside this addendum.

Team, Professional and Enterprise may initially be assigned manually by platform administrators.

A billing checkout system is not required for Phase 1.5.

---

# 4. P1.5A: Org Mode, plans and self-service organisations

## Ticket P15-ENT-001: Organisation plans and entitlement enforcement

### Objective

Create the central entitlement model that governs self-service and paid organisation capability.

### Current repository references

```text
organizations
organization_memberships
features/admin/application/context.ts
app/admin/organizations/
```

### Required implementation

1. Add plan and plan-assignment persistence.
2. Seed:

   * Starter;
   * Team;
   * Professional;
   * Enterprise.
3. Implement a typed entitlement resolver.
4. Add platform-admin plan assignment.
5. Add entitlement overrides for pilots or sponsored organisations.
6. Separate plan from billing and verification status.
7. Ensure entitlements can be checked from:

   * server components;
   * server actions;
   * RPCs;
   * storage/upload endpoints.

### Starter entitlement keys

At minimum:

```text
max_courses
max_total_lessons
allowed_lesson_block_types
max_storage_bytes
ai_authoring_enabled
max_active_missions
allowed_mission_types
allowed_mission_reward_modes
max_xp_accounts
max_active_rewards
allowed_reward_fulfillment_types
max_open_reward_claims
max_fulfilled_reward_claims_per_month
assessment_capability
reporting_level
```

### Acceptance criteria

* Starter limits are data-driven.
* No feature checks depend only on `plan_key === "starter"`.
* Platform admins can assign a different plan without changing code.
* A sponsored pilot may receive Professional entitlements with `billing_status = sponsored`.
* Entitlements are enforced server-side.
* Direct RPC or API calls cannot bypass plan limits.

### Implementation status

**Status:** Implemented on 2026-08-04 for review.

Implemented:

* forward migration for organisation plans, plan assignments and entitlement overrides;
* Starter, Team, Professional and Enterprise plan seeds;
* Starter default assignment for existing and newly platform-created organisations;
* separate organisation creation, verification and lifecycle status fields;
* central database entitlement resolver and integer limit helper for RPC/API enforcement;
* typed application entitlement parser and server resolver;
* platform-admin plan assignment UI with billing status and limited pilot overrides;
* pgTAP coverage for plan seeds, default assignment, sponsored Professional assignment, override merging, member/outsider access, direct table-write denial and RPC grants;
* unit coverage for entitlement parsing and integer limit checks.

Deferred to later P1.5A tickets:

* Org Mode routes and navigation in `P15-ORG-003`;
* invitations and My Orgs in `P15-ORG-004`;
* learner workspace context in `P15-ORG-005`;
* Starter course, lesson, media, storage and AI enforcement across authoring flows in `P15-ORG-006`.

---

## Ticket P15-ENT-002: Temporary capability grants and entitlement overrides

### Status

Implemented for P1.5E review on 2026-08-13 and accepted as part of P1.5E closure on 2026-08-15. This remains a newly approved P1.5E extension of the entitlement foundation established by `P15-ENT-001`, not retroactive P1.5A scope.

### Objective

Formalise temporary entitlement grants so pilots, sponsored organisations, trials and controlled capability evaluations can receive time-bound access without changing the organisation's base plan or billing status.

This ticket preserves the `P15-ENT-001` organisation-specific override concept. The existing granular override path remains valid, but effective entitlement resolution must distinguish:

```text
base plan entitlements
active temporary plan grants
active granular entitlement overrides
platform safety restrictions
```

Effective entitlements are resolved as:

```text
base plan
+ active temporary plan grants
+ active granular overrides
- platform safety restrictions
= effective entitlement set
```

Platform safety restrictions always take precedence. A temporary grant or granular override must never weaken global safety, security, abuse-prevention, storage, media, AI, economic, RLS, RPC or tenant-isolation limits.

### Required capability

Support:

* dated plan trials, such as temporary Team or Professional access;
* temporary higher-plan access without mutating the base plan assignment;
* granular temporary privileges, such as one AI capability, one media capability, expanded storage or a reporting feature;
* additive allocations where the entitlement is naturally additive, such as extra AI budget, extra storage or extra learner capacity;
* explicit start and expiry timestamps;
* immediate revocation before expiry;
* audit history for grant creation, activation, update, revocation and expiry processing;
* non-destructive expiry that stops future access without deleting historical records, generated content, activity logs or learner history.

### Entitlement coherence

Capability dependencies must remain coherent.

At minimum:

* AI authoring access requires an active AI allocation and the server-side AI metering controls in `P15-AI-001`;
* temporary AI access must be granted through the generic entitlement/grant mechanism in this ticket, not an AI-only privilege path;
* media grants must include compatible content, storage, upload and lesson-block entitlements;
* storage or media expansion must not bypass file validation, scanning, accounting or per-organisation isolation;
* assessment, mission, reward or reporting grants must continue to respect existing plan, role and tenant boundaries;
* expiry must not invalidate already-earned learner progress, assessment attempts, point transactions, reward history or audit history.

### Data model guidance

Extend the existing plan and override foundation instead of introducing a parallel privilege system.

Expected concepts may include:

```text
organization_temporary_entitlement_grants
grant_type
source_plan_key
entitlement_delta
starts_at
expires_at
revoked_at
revoked_by
reason
created_by
created_at
updated_at
```

`entitlement_delta` must be validated against the central typed entitlement schema. Unknown keys, incompatible types and incoherent capability combinations must be rejected.

### Acceptance criteria

* Base plan assignment remains separate from temporary grants.
* Billing status is not changed merely to grant temporary capability.
* Effective entitlement resolution is centralised and deterministic.
* Temporary grants and granular overrides are visible to platform admins.
* Organisation owners/admins can see the effective capability state where appropriate, but cannot self-grant privileged capabilities.
* Expired or revoked grants stop future privileged action immediately.
* Historical data remains readable according to normal organisation permissions after expiry.
* All grant lifecycle changes are audited.
* Direct RPC/API access cannot bypass expiry, revocation or dependency checks.
* `P15-AI-001` consumes this mechanism for organisation AI enablement.

### Implementation evidence

Delivered in:

```text
supabase/migrations/20260813140000_p15_ent_002_temporary_entitlement_grants.sql
features/organizations/entitlements.ts
features/organizations/admin/data.ts
app/admin/organizations/actions.ts
app/admin/organizations/page.tsx
supabase/tests/database/lms_organization_entitlements.sql
tests/unit/organization-entitlements.test.mjs
```

Implemented behavior:

* `organization_temporary_entitlement_grants` stores dated, revocable, non-destructive grants with `grant_type`, optional `source_plan_key`, validated `entitlement_delta`, lifecycle timestamps, creator/revoker attribution and expiry-audit tracking.
* Effective entitlement resolution is now centralised through the private resolver used by public entitlement reads and enforcement helpers: active base plan, active temporary grants, active granular overrides and platform safety restrictions resolve deterministically in one path.
* Temporary higher-plan access can be granted without changing `organization_plan_assignments.plan_key` or `billing_status`.
* Additive allocations are supported for naturally additive numeric entitlement keys, including storage, learner/course-style limits and generic AI allocation keys for later `P15-AI-001` consumption.
* Incoherent grant combinations are rejected server-side: AI authoring grants require an allocation, and granular media block grants must include compatible storage entitlement.
* Platform admins manage grants through audited RPCs; organisation owners/admins can read relevant grant state but cannot self-grant.
* Expired/revoked grants stop contributing to future entitlement resolution while history remains readable under normal organisation permissions.

Validation:

```text
node scripts/supabase-cli.mjs migration up
node scripts/supabase-cli.mjs test db supabase/tests/database/lms_organization_entitlements.sql
npm run db:types:local
npm run db:types:local:check
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

Focused entitlement pgTAP passed 32/32. The full `npm run test:db` directory command was attempted twice after focused validation but failed at local Postgres connection setup before running tests; it did not report a test assertion failure.

---

## Ticket P15-ORG-001: Extend organisation profile and lifecycle

### Objective

Turn the current organisation record into a usable institutional workspace identity.

### Required organisation fields

Add or otherwise model:

```text
short_name
description
logo_url
accent_token
support_email
support_phone
creation_source
billing_status
verification_status
lifecycle_status
```

Organisation branding must remain restrained.

Do not allow arbitrary CSS or arbitrary theme values.

### Acceptance criteria

* Current organisations are migrated safely.
* Existing P1 workspace selection remains functional.
* Organisation identity is available to learner and admin context resolvers.
* Unverified organisations are visibly labelled.
* Starter organisations remain private.
* Archived or suspended organisations cannot be entered by learners.

### Implementation status

**Status:** Implemented on 2026-08-05 for review.

Implemented:

* forward migration for organisation profile identity fields, restrained `accent_token` enum values and support contact validation;
* lifecycle entry helper and user entry RPC that require active/trial lifecycle plus membership, enrolment or platform admin rights;
* learner-read protections for organisation-private courses, programmes and organisation-owned/programme-sponsored rewards when the organisation is suspended or archived;
* platform-admin-only organisation profile RPC with audit events and explicit RPC security classification;
* admin organisation data resolver and admin workspace context identity fields;
* admin shell workspace verification label and organisation admin table identity/support/governance visibility;
* platform admin form for editing short name, description, logo URL, accent token, support contacts, verification status and lifecycle status;
* generated Supabase database types for the new enum, columns and RPCs;
* pgTAP coverage for safe defaults, profile RPC authorization, invalid branding/support values, Starter privacy and suspended/archived learner entry denial;
* unit coverage for app-side accent token normalization and lifecycle entry checks.

Modeling note:

* `billing_status` remains modeled on `organization_plan_assignments`, not duplicated on `organizations`, to preserve the P15-ENT-001 separation of plan, billing, verification and lifecycle state.

Validation completed:

```text
npm run db:reset
npm run db:types:local
npm run typecheck
npm run test:unit
npm run test:db
npm run lint
npm run db:types:local:check
npm run build
git diff --check
```

---

## Ticket P15-ORG-002: Self-service organisation creation

### Objective

Allow an authenticated learner to create a Starter organisation without platform-admin intervention.

### Routes

Recommended:

```text
/org/create
```

### Flow

```text
Sign in
→ enter organisation details
→ accept organisation terms
→ create organisation
→ assign Starter plan
→ set creation source to self_service
→ set verification to unverified
→ create organisation_owner membership
→ enter guided organisation setup
```

### Required safeguards

* user cannot choose plan;
* user cannot mark the organisation verified;
* user cannot assign themselves platform-admin status;
* organisation slug uniqueness is enforced;
* rate-limit organisation creation;
* record audit event;
* support abuse suspension by platform admin.

### Reuse

The self-service path should share domain logic with the existing platform-admin organisation creation path.

Do not duplicate organisation persistence in unrelated server actions.

### Acceptance criteria

* creator automatically becomes organisation owner;
* created organisation appears in My Orgs;
* owner may open:

  * learner workspace;
  * management workspace;
* Starter entitlements apply immediately;
* the organisation is not publicly listed;
* no public organisation directory is created.

### Implementation status

**Status:** Implemented on 2026-08-05 for review.

Implemented:

* forward migration for authenticated self-service Starter organisation creation;
* shared database slug normalization used by both platform-admin and self-service organisation creation paths;
* `create_self_service_organization` RPC that derives creator identity from `auth.uid()`, requires accepted terms, enforces slug uniqueness and applies a per-user creation limit;
* automatic `self_service`, `unverified`, `active`, `published` organisation state with safe identity fields;
* automatic `organisation_owner` membership for the creator without changing the creator's platform profile role;
* automatic Starter/free plan assignment with no plan, billing, verification, lifecycle or role fields exposed to the requester;
* `organization_creation_attempts` audit-support table with owner/admin read policies;
* `/org/create` route and server action that call the self-service RPC and continue setup in the existing organisation management workspace;
* pgTAP coverage for owner membership, Starter assignment, entitlement availability, duplicate slug denial, terms requirement, support email validation, rate limit, outsider privacy, anon denial, grants and RPC classification;
* generated Supabase database types for the new table and RPC.

Scope note:

* `/org/my`, invitations and learner organisation access remain in `P15-ORG-004`.

Validation completed:

```text
npm run db:reset
npm run db:types:local
npm run typecheck
npm run test:unit
npm run test:db
npm run lint
npm run db:types:local:check
npm run build
git diff --check
```

---

## Ticket P15-ORG-003: Org Mode entry and marketing surface

### Objective

Add Org Mode to the existing learner product and provide an institutional conversion surface.

### Required changes

Update:

```text
components/navigation/BottomNav.tsx
```

to include:

```text
Org Mode
```

Add:

```text
/org
```

with:

* institutional value proposition;
* learning;
* missions;
* organisation points;
* manual rewards;
* progress and reporting;
* Starter summary;
* paid-plan positioning;
* trust and privacy summary.

Calls to action:

```text
Create an Organisation
Enter Org Mode
```

### Route behaviour

* Create leads to `/org/create`.
* Enter leads to `/org/my`.
* Signed-out users authenticate and return to the intended route.
* No organisation code field is shown.
* No organisation directory is shown.

### Acceptance criteria

* Org Mode is visible before organisation validation.
* Mobile navigation remains usable with five items.
* Desktop navigation remains usable.
* `/org` works for signed-in and signed-out visitors.
* current public routes continue working.

### Implementation status

**Status:** Implemented on 2026-08-05 for review.

Implemented:

* learner `BottomNav` now includes a fifth `Org Mode` item linking to `/org`;
* mobile and desktop navigation sizing was adjusted for the five-item learner menu;
* `/org` provides the institutional conversion surface covering learning, missions, organisation points, manual rewards, progress and reporting, Starter, paid-plan positioning, and trust/privacy;
* primary `/org` calls to action route `Create an Organisation` to `/org/create` and `Enter Org Mode` to `/org/my`;
* signed-out `/org` calls to action use `/login?next=...` so authenticated users return to the intended Org route;
* login, OAuth callback, signup confirmation and confirmation resend flows now share a safe internal next-path helper;
* `/org/create` is marked active under Org Mode and its signed-out prompt uses the same encoded login return path;
* focused unit coverage verifies internal auth destinations are accepted and external destinations are rejected.

Scope note:

* `/org/my`, invitation acceptance and learner organisation centre behavior remain in `P15-ORG-004`.
* No public organisation directory or organisation code entry was introduced.

Validation completed:

```text
npm run test:unit
npm run typecheck
npm run lint
npm run build
```

---

## Ticket P15-ORG-004: Organisation invitations and My Orgs

### Objective

Create an invitation-first entry model and a learner organisation centre.

### Required data model

Introduce an invitation model capable of representing:

```text
organisation membership invitation
programme invitation
cohort invitation
```

Suggested fields:

```text
id
organization_id
target_type
target_id
email
invited_user_id
role
token_hash
status
expires_at
invited_by
accepted_at
created_at
```

Suggested statuses:

```text
pending
accepted
expired
revoked
declined
```

Do not store reusable invitation secrets in plaintext.

### Required notifications

Use the existing notification infrastructure.

Invitations should appear in:

```text
/notifications
/org/my
```

Email may also be sent when delivery is configured.

### My Orgs route

```text
/org/my
```

Required states:

#### Empty

```text
You do not belong to an organisation yet.

Ask your organisation administrator to send you an invitation.
```

Also show:

```text
Create an Organisation
```

#### Pending invitations

Show:

* organisation;
* programme where applicable;
* invited role;
* expiry;
* accept;
* decline.

#### Active organisations

Show:

* organisation identity;
* active programmes;
* active organisation points balance where available;
* open workspace.

#### Owner or staff

Show:

```text
Open learning workspace
Manage organisation
```

### Programme-only access

A programme invitation may create an external enrolment without broad learner membership.

That learner should still see the organisation in My Orgs, but only the invited programme and related resources.

### Acceptance criteria

* no organisation ID is required;
* an invitation may be accepted after authentication;
* expired and revoked invitations cannot be accepted;
* organisation invitations create the correct membership;
* programme invitations create only the required access;
* invitation acceptance is idempotent;
* Organisation A cannot accept or modify Organisation B’s invitations;
* all invitation changes are audited.

### Implementation status

**Status:** Implemented on 2026-08-05 for review.

Implemented:

* forward migration for `organization_invitations`, invitation target/status enums, RLS policies, management/read predicates and RPC security classifications;
* invitation targets for whole-organisation, programme and cohort access;
* `admin_create_organization_invitation` RPC with organisation-scoped authorization, target ownership validation, future expiry checks, normalized email targeting and hashed invitation token storage;
* `respond_organization_invitation` RPC for authenticated accept/decline by invited user id or authenticated email;
* organisation invitation acceptance creates the requested contextual membership;
* programme invitation acceptance creates programme-only enrolment and related programme-course enrolments without creating broad organisation membership;
* cohort invitation acceptance creates cohort membership and applies existing cohort course/programme assignments where present;
* `admin_revoke_organization_invitation` RPC for pending invitation revocation by authorised organisation audience managers;
* invitation-created, accepted, declined, revoked and expired-attempt audit events;
* in-app invitation notifications for existing invited users with `/org/my` CTA;
* `/org/my` learner centre with empty state, pending invitations, active organisations, programme/cohort access, owner/staff management CTA and no organisation code or directory;
* organisation admin page invitation list and creation form for platform operators;
* generated Supabase database types for invitation tables/enums/RPCs.

Scope note:

* `/org/my` now exposes the learner centre and invitation responses. Full learner workspace context switching remains in `P15-ORG-005`.
* Email delivery remains conditional on later delivery configuration; in-app notifications are implemented for existing users.

Follow-up fix on 2026-08-26:

* pending invitation listing now uses a self-scoped `get_my_pending_organization_invitations` RPC so invited non-members can see their own pending `/org/my` invitation with safe organisation identity metadata, without broadening general `organizations` table visibility;
* `lms_organization_invitations.sql` now covers the invited non-member visibility regression, unrelated-user denial and the fact that a pending invitation alone does not grant direct `organizations` table reads.

Validation completed:

```text
npm run db:reset
node scripts/supabase-cli.mjs test db supabase/tests/database/lms_organization_invitations.sql
npm run db:types:local
npm run db:types:local:check
npm run test:db
npm run test:unit
npm run typecheck
npm run lint
npm run build
git diff --check
```

---

## Ticket P15-ORG-005: Learner workspace context

### Objective

Add a server-resolved learner context analogous to the accepted admin workspace model.

### Required context

Conceptually:

```text
LearnerWorkspaceContext
  type: public | organization
  organizationId
  organizationSlug
  programmeIds
  membershipRoles
  xpAccount
  branding
  accessSource
```

Possible access sources:

```text
membership
programme_enrolment
course_enrolment
owner
```

### Recommended routes

Public routes remain:

```text
/dashboard
/courses
/missions
/xp-store
```

Organisation routes:

```text
/o/[organizationSlug]
/o/[organizationSlug]/learn
/o/[organizationSlug]/missions
/o/[organizationSlug]/rewards
/o/[organizationSlug]/profile
/o/[organizationSlug]/transcript
```

These routes should reuse existing learner components and repositories.

### Required behaviour

In Public Mode:

* public catalogue;
* public missions;
* public reward store;
* Project Ve XP;
* public recommendation profile.

In Org Mode:

* assigned programmes;
* organisation-accessible courses;
* organisation missions;
* organisation reward store;
* organisation points account;
* organisation branding;
* organisation notifications;
* organisation transcript context.

### Public return path

Every organisation learner view must provide a clear:

```text
Return to Project Ve
```

or workspace switcher.

### Query rule

Do not rely on RLS alone to compose catalogues.

RLS answers:

```text
May this learner read this record?
```

Workspace-aware application queries must answer:

```text
Does this record belong in the active learner workspace?
```

### Acceptance criteria

* public and organisation catalogues are not unintentionally blended;
* an organisation learner may return to Public Mode;
* an externally enrolled learner sees only the invited programme;
* an organisation member sees content permitted by membership and assignment;
* context is resolved server-side;
* client requests cannot impersonate another organisation context;
* active workspace controls points, missions, rewards and recommendations.

### Implementation status

**Status:** Implemented on 2026-08-05 for review.

Implemented:

* server-resolved learner workspace context for public and organisation modes;
* `/o/[organizationSlug]` organisation learner home with server-side slug access validation;
* `/o/[organizationSlug]/learn`, `/missions`, `/rewards`, `/profile` and `/transcript` routes;
* org-prefixed course detail route at `/o/[organizationSlug]/learn/[courseId]` so organisation-private courses do not fall back to public course detail;
* `/org/my` now opens the resolved organisation workspace route;
* public course catalogue and public reward store queries explicitly request platform-scope/platform-owned records instead of relying on RLS visibility;
* organisation course queries derive allowed course ids from active membership, enrolled programmes and direct course enrolments;
* programme-only learners see only courses, missions and rewards connected to their active programme ids;
* organisation rewards use organisation-owned and programme-sponsored reward filters, with account-aware redemption handled by the later focused XP/reward workflows;
* organisation transcript view filters the canonical transcript response to the active organisation workspace;
* shared learner components accept scoped initial snapshots so org views do not hydrate back into public data.

2026-08-29 P0.3 performance and boundary hardening:

* organisation learner route context now resolves through one focused
  `get_organization_learner_workspace_context` database operation rather than
  reconstructing the same context through up to eleven reads and five waves;
* the RPC derives the learner only from `auth.uid()`, requires the existing
  organisation-entry policy, has explicit authenticated/service-role grants and
  classification, denies anonymous execution, and returns no context to a
  service role without a user subject;
* the context remains limited to branding, roles, programme/course delivery
  identifiers and the active organisation points account. Course, mission,
  assessment and reward screen data remain in focused repositories;
* pgTAP now covers member, externally enrolled learner, outsider, platform
  admin and no-subject service-role boundaries, while the application validates
  the returned delivery identifiers before establishing route state.

2026-08-29 P1.1 mission-state performance and boundary hardening:

* learner mission lists now evaluate public, organisation-wide and programme
  delivery state through the read-only, self-scoped
  `get_dashboard_mission_state` RPC instead of issuing per-mission award,
  progress, proof and referral reads;
* the operation revalidates trusted organisation/programme attachment and
  current caller access, preserves programme mission attribution, and returns
  only the authenticated caller's award/proof/referral state;
* referral qualification is evaluated relationally in the same database
  operation, including all attributed learners, while existing contextual
  tokens may be read without exposing or invoking token mutation helpers;
* contextual token creation moved to an explicit authenticated POST action, so
  mission rendering is read-only and mission awards remain in explicit
  proof/claim/domain action flows;
* boundary validation includes a dedicated 23-assertion pgTAP suite, the full
  35-file/755-test database gate, live repository operation-shape coverage, and
  the Org Mode mission browser journey.

Scope notes:

* The original P15-ORG-005 delivery preceded isolated organisation balances. The
  later P1.5C XP/reward tickets now own account-aware earning and redemption;
  route context reads the active account identity/balance but does not absorb
  those mutation workflows.
* Organisation-specific notification filtering needs notification metadata exposed through the notification helper before it can be implemented without brittle CTA string matching.
* Organisation recommendation rendering is not shown in org routes yet; org assessment/recommendation authoring remains in the later assessment tickets, and org routes do not display public recommendations.

Validation completed:

```text
npm run typecheck
npm run lint
npm run test:unit
npm run test:db
npm run build
git diff --check
```

---

## Ticket P15-ORG-006: Starter course, lesson, media and storage limits

### Objective

Enforce the Starter content limits using the current course and lesson systems.

### Required limits

```text
Maximum courses: 1
Maximum lessons: 5 total
Allowed blocks:
  text
  image
  table
  callout
Disabled blocks:
  video
  audio
AI authoring: disabled
Image storage: 100 MB default
```

### Required enforcement

Apply limits to:

* course creation;
* course duplication;
* course adaptation;
* lesson creation;
* lesson duplication;
* AI creation entry points;
* lesson-block creation;
* media upload;
* template use.

Do not enforce only by hiding buttons.

Server actions and RPCs must reject invalid operations.

### UX requirements

Before a blocked operation, explain the limit.

Examples:

```text
You have used your Starter course allowance.

Upgrade to create another course.
```

```text
Starter organisations can create up to five lessons.
```

```text
Video and audio lessons are available on paid organisation plans.
```

### Acceptance criteria

* direct API/RPC calls cannot exceed limits;
* copying a platform course cannot exceed the one-course/five-lesson allowance;
* Starter cannot create video or audio blocks;
* existing public and paid organisation media support remains intact;
* storage usage is calculated per organisation;
* deleting a stored image releases quota after safe deletion;
* Starter cannot access AI authoring routes or actions.

**Status:** Implemented on 2026-08-05 for review.

Implemented in:

* `supabase/migrations/20260805130000_starter_organization_content_limits.sql`
* `supabase/tests/database/lms_organization_content_limits.sql`
* `features/organizations/admin/entitlement-guards.ts`
* `app/admin/courses/ai/planner/page.tsx`
* `app/admin/courses/planner-actions.ts`
* `app/admin/courses/ai-actions.ts`
* `app/api/admin/learning/media/upload/route.ts`
* `types/database.ts`

Review notes:

* Course, lesson, lesson-block and learning-media limits are enforced by database triggers against resolved organisation entitlements, so direct table writes, RPCs, adaptation flows and duplication flows cannot bypass Starter limits.
* Storage usage is calculated from current stored image media rows per organisation; deleting a stored image row releases quota after the application has safely removed storage content.
* AI authoring entry points and the planner route redirect Starter organisation workspaces with a plan notice before creating plans, jobs or generated content.
* Existing catalog and P1 release fixtures that need multiple organisation courses now explicitly use Team plan assignments in their pgTAP setup.

Validation:

```text
npm run db:reset
npm run test:db -- lms_organization_content_limits
npm run db:types:local:check
npm run typecheck
npm run lint
git diff --check
```

---

## P1.5A focused closure pass

**Status:** Formally closed on 2026-08-09.

The P1.5A acceptance review accepted `P15-ENT-001`, `P15-ORG-001` and `P15-ORG-003`, and required a focused closure pass before P1.5A can be considered closed. This pass resolves the remaining self-service organisation workflow gaps without starting P1.5B.

Implemented:

* self-service organisation owners and admins may manage their own organisation profile identity, members and invitations from the existing management workspace, while plan assignment, verification and lifecycle controls remain platform-admin-only;
* organisation owners and admins may create and edit organisation-private courses, lessons, lesson pages, lesson blocks and quizzes through the existing CMS authoring routes;
* Starter organisation authoring now hides unavailable AI, video and audio controls in the CMS and still relies on RPC/database entitlement enforcement for direct-call denial;
* Starter image upload and delete now work for authorised organisation content editors through trusted course/lesson ownership resolution, storage quota checks and safe storage-object cleanup before database row deletion;
* Org Mode learner course navigation now preserves organisation context through lesson, quiz and result routes instead of falling back to public-mode paths;
* organisation notification views now filter user notifications by organisation metadata instead of brittle CTA matching;
* focused Playwright coverage exercises the self-service owner setup, invitation, private course creation, five-lesson Starter cap, image upload/delete quota release path, AI UI denial and direct video-block rejection.
* final Playwright closure coverage drives the existing institutional learner journey through the organisation course UI, contextual lesson route, contextual quiz route, contextual result route, organisation course return, organisation notifications and explicit return to public Project Ve.

Validation completed:

```text
npm run db:verify:local
npm run typecheck
npm run lint
npm run test:e2e
npm run test:remediation:local
```

Final closure amendment validation:

```text
npm run typecheck
npm run lint
npm run test:e2e
```

---

# 5. P1.5B: Organisation-configurable missions

## Ticket P15-MSN-001: Platform mission-type registry

### Objective

Separate executable mission capability from mission instances and learner-facing communication.

### Required model

Introduce a platform-controlled registry such as:

```text
mission_types
```

Recommended fields:

```text
key
name
description
status
configuration_schema
supported_repeatability
supported_reward_modes
learner_interaction_type
handler_version
created_at
updated_at
```

### Seed from the existing engine

Map current capabilities:

| Current validation type             | Mission-type key         |
| ----------------------------------- | ------------------------ |
| `course_completed`                  | `course_completed`       |
| `lesson_completed`                  | `lesson_completed`       |
| `lesson_count_completed`            | `lesson_count_completed` |
| `referral_friend_completed_lessons` | `referral`               |
| `proof_upload`                      | `proof_submission`       |
| `manual_review`                     | `manual_approval`        |

Do not rewrite validated mission behaviour from scratch.

Move the current switch logic progressively behind mission-type adapters.

### Acceptance criteria

* every existing mission maps to a registered type;
* existing public missions continue working;
* unknown mission types cannot be created;
* mission-type configuration is validated server-side;
* organisations cannot submit executable code;
* handler versions are traceable.

---

## Ticket P15-MSN-002: Organisation mission entitlements and hybrid catalogue

### Objective

Allow organisations to use enabled mission types and maintain private or adapted mission definitions.

### Required model

Introduce:

```text
organization_mission_type_entitlements
```

Extend `missions` with a catalogue model compatible with the current course catalogue approach.

Required concepts:

```text
platform
organization_private
adapted_platform
```

Recommended mission fields:

```text
catalog_scope
organization_id
source_mission_id
source_catalog_version
local_changes
upstream_update_available
mission_type_key
presentation_config
configuration_version
```

### Organisation capability

Authorised organisation users may:

* use a platform mission;
* adapt a platform mission;
* create an organisation-private mission using an entitled mission type.

They may not alter the canonical platform mission.

### Presentation configuration

Support organisation-specific:

```text
title
short description
full instructions
CTA label
eligibility explanation
reward explanation
pending message
success message
rejection message
terms
icon or image
```

### Starter entitlement

Starter receives:

```text
course_completed
lesson_count_completed
```

Maximum active missions:

```text
2
```

Allowed award mode:

```text
organization_xp
```

### Acceptance criteria

* organisation mission ownership is enforced through RLS and RPC guards;
* Starter cannot create referral or proof missions;
* adapted missions retain source provenance;
* platform mission updates do not overwrite local adaptations;
* organisation communication does not alter mission execution logic;
* platform analytics retain the canonical mission type.

---

## Ticket P15-MSN-003: Programme mission delivery configuration

### Objective

Allow the same mission definition to behave appropriately in different programmes.

### Extend

```text
programme_missions
```

with delivery-specific configuration.

Recommended fields:

```text
starts_at
due_at
is_required
xp_account_id
reward_xp_override
presentation_overrides
delivery_config
```

### Programme mission UX

Inside the programme workspace, provide:

```text
Use Project Ve mission
Use organisation mission
Adapt Project Ve mission
Create organisation mission
```

The programme manager should be able to:

* configure dates;
* set required/optional status;
* select the valid organisation XP account;
* set a points award;
* set programme-specific wording;
* preview the learner experience.

### Acceptance criteria

* programme overrides do not alter the reusable base mission;
* programme delivery context determines the award account;
* the browser cannot choose an arbitrary XP account;
* programme-specific dates are enforced;
* completion reporting identifies the programme mission.

---

## Ticket P15-MSN-004: Contextual organisation referral missions

### Objective

Extend the current referral infrastructure so the same learner can hold different referral links for different delivery contexts.

### Current foundation

```text
profiles.referral_code
referral_attributions
referral_link_visits
/invite/[code]
app/api/referrals/
```

### Required contextual model

A contextual referral token must resolve:

```text
referrer
organization
programme
programme mission
destination
eligibility policy
expiry
```

Examples:

```text
Public Project Ve referral link
Police Ethics Programme referral link
Church Leadership Programme referral link
```

### Required behaviour

A Police referral link may require:

* valid service identity;
* a particular programme destination;
* completion of registration;
* completion of specified lessons;
* Police Points award.

A church referral link may use different eligibility, copy and destination while using the same referral mission capability.

### Acceptance criteria

* public referrals continue working;
* contextual referral attribution cannot leak across organisations;
* the same learner may hold multiple active contextual referral links;
* qualification belongs to the correct programme mission;
* reward account is resolved from trusted context;
* duplicate and self-referral controls remain active;
* expired links do not qualify;
* organisation-specific copy is shown at the destination.

---

## Ticket P15-MSN-005: Mission outcomes, proof context and reporting

### Objective

Make institutional mission activity first-class and reportable.

### Extend

```text
mission_awards
mission_proofs
```

with trusted context:

```text
organization_id
programme_id
programme_mission_id
xp_account_id
```

### Requirements

* context is resolved server-side;
* proof-review queues can be filtered by organisation and programme;
* mission completion reports do not infer programme attribution solely from learner identity;
* mission awards reference the account that received XP;
* existing public mission rows remain valid.

### Acceptance criteria

* Organisation A cannot view Organisation B’s proofs;
* programme reports include only programme mission outcomes;
* public mission reporting remains separate;
* refunds or reversals target the original XP account;
* all proof-review actions are audited.

---

# 6. P1.5C: Scoped and white-labelled XP

## Ticket P15-XP-001: XP account model and historical migration

### Objective

Generalise the current global XP balance into isolated XP accounts without replacing the XP engine.

### Required model

Introduce:

```text
xp_accounts
```

Recommended fields:

```text
id
scope
organization_id
name
plural_name
short_label
icon_url
status
is_default
accounting_currency
accounting_value_per_unit
created_at
updated_at
```

Initial scopes:

```text
platform
organization
```

Seed:

```text
Project Ve XP
scope = platform
```

Each pilot organisation may have one active default account.

### Migration

1. Add `xp_account_id` to `xp_transactions`.
2. Backfill all existing transactions to Project Ve XP.
3. Preserve transaction IDs and audit history.
4. Update duplicate-award identity to include `xp_account_id`.
5. Retain `profiles.xp_balance_cached` temporarily as the Project Ve-account compatibility cache.

### Acceptance criteria

* all historical XP belongs to Project Ve XP;
* migration is reversible or safely forward-correctable;
* no balance is duplicated;
* current public XP totals remain unchanged;
* organisation account ownership is enforced;
* Starter automatically receives one organisation account.

---

## Ticket P15-XP-002: Per-account balances and transaction primitives

### Objective

Make the existing hardened XP transaction infrastructure account-aware.

### Required model

Introduce:

```text
user_xp_balances
```

Fields:

```text
user_id
xp_account_id
balance_cached
updated_at
```

The ledger remains canonical.

### Extend

```text
private.post_xp_transaction(...)
```

to operate against one trusted account.

### Required paths

Update all XP-producing and XP-reversing paths:

```text
mission XP
quiz XP
assessment XP
admin grants
native XP rewards
perk-bundle XP effects
refunds
reversals
expiration when later enabled
```

### Account resolution

The account should come from trusted context such as:

```text
public delivery
programme
enrolment
programme mission
reward
assessment context
```

Do not trust an arbitrary browser-supplied `xp_account_id`.

### Acceptance criteria

* each transaction affects one account only;
* account totals reconcile with ledger entries;
* duplicate-award protection is account-aware;
* Project Ve XP and organisation points remain isolated;
* account balance updates remain concurrency safe;
* old public paths remain compatible during migration.

---

## Ticket P15-XP-003: Account-aware course, mission and assessment earning

### Objective

Ensure the delivery context determines which XP account receives an award.

### Recommended model extensions

```text
programmes.default_xp_account_id
enrolments.xp_account_id
programme_missions.xp_account_id
programme_assessments.xp_account_id where required
```

### Rules

Public learning:

```text
Public mission
Public quiz
Public assessment
→ Project Ve XP
```

Organisation learning:

```text
Organisation programme mission
Organisation-delivered quiz
Organisation programme assessment
→ organisation points account
```

Shared Project Ve course:

```text
Taken publicly
→ Project Ve XP

Delivered through Police programme
→ Police Points
```

The course definition does not permanently own the points account.

### Prior completion policy

Extend `programme_courses` with:

```text
prior_completion_policy
```

Supported values:

```text
recognize_prior_completion
require_completion_in_context
```

If prior completion is recognised:

* it may satisfy programme completion;
* it must not automatically mint organisation points again.

If completion in context is required:

* programme-specific progress and completion must be recorded;
* organisation awards use the programme account.

### Acceptance criteria

* the same course may be delivered in multiple contexts;
* public completion cannot automatically mint Police Points;
* organisation completion cannot overwrite public history incorrectly;
* mandatory retraining may require contextual completion;
* prior-completion rules are explicit and tested.

---

## Ticket P15-XP-004: Account-aware rewards, redemption and refunds

### Objective

Tie every reward to the points account that may pay for it.

### Extend

```text
rewards.xp_account_id
```

The current `cost_xp` field may remain.

Its meaning becomes:

```text
Cost in the reward’s configured XP account
```

### Required checks

Redemption must verify:

1. learner is eligible for the reward;
2. reward belongs in the active workspace;
3. learner has sufficient balance in the reward’s XP account;
4. inventory or claim capacity is available;
5. plan entitlements allow the reward;
6. the account and reward organisation are compatible.

Refunds must return value to the original account.

### Mandatory denial cases

```text
Project Ve XP cannot pay for Police reward.
Police Points cannot pay for public reward.
Police Points cannot pay for Church reward.
Outsider cannot access Police account or reward.
Client cannot override reward account.
```

### Acceptance criteria

* redemption remains atomic;
* reward inventory remains consistent;
* refunds use the original account;
* native reward effects use the correct account;
* existing platform rewards continue charging Project Ve XP;
* organisation stores display only their own account balance.

---

## Ticket P15-XP-005: Organisation points configuration and learner presentation

### Objective

Allow organisations to white-label their one Phase 1.5 XP account.

### Organisation configuration

Allow:

```text
name
plural name
short label
icon
display format
status
```

Examples:

```text
Police Point
Police Points
PP
```

Changing labels must not rewrite historical transaction values.

### Learner UX

Public Mode:

```text
2,400 XP
```

Police Org Mode:

```text
350 Police Points
```

Combined My Orgs or wallet summary may show:

```text
Project Ve XP                  2,400
Nigeria Police Points            350
Church Leadership Points           85
```

There must be no transfer or exchange controls.

### Administration UX

Provide:

```text
Account identity
Current circulation
Issuance
Redemptions
Adjustments
Rewards using this account
Transaction history
```

### Acceptance criteria

* active workspace controls the prominently displayed balance;
* labels and icons are organisation-specific;
* users cannot merge accounts;
* organisation admins cannot change account ownership;
* account ledger is scoped to permitted organisation roles.

---

## Ticket P15-RWD-001: Starter manual reward and claim quotas

### Objective

Allow Starter organisations to experience the points-to-reward loop without enabling complex fulfilment or uncontrolled claim volume.

### Starter reward rules

```text
Maximum active reward items: 1
Allowed fulfilment: manual
Claim-file uploads: disabled
External provider integrations: disabled
Voucher inventory: disabled
QR inventory: disabled
Perk bundles: disabled
```

### Claim limits

Initial defaults:

```text
Maximum open claims: 25
Maximum fulfilled claims per calendar month: 25
```

### Required behaviour

* reward becomes unavailable when the open-claim cap is reached;
* fulfilment beyond the monthly fulfilled quota is blocked;
* rejected and cancelled claims do not consume fulfilled quota;
* Project Ve does not represent itself as the reward provider;
* organisation responsibility is displayed clearly;
* claim status notifications use the current notification system.

### Acceptance criteria

* Starter cannot publish a second active reward;
* Starter cannot switch fulfilment to a disallowed type;
* direct RPC calls cannot bypass quotas;
* reward charges only the organisation XP account;
* claims are visible only to authorised organisation staff;
* fulfilment changes are audited.

---

## Ticket P15-XP-006: Basic issuance and exposure controls

### Objective

Provide minimum operational control before organisations issue spendable points at scale.

### Required core controls

For all organisation accounts:

```text
total issued
total redeemed
current circulation
admin adjustments
per-programme issuance
per-user issuance
```

Starter should have configurable:

```text
period issuance cap
per-user issuance cap
```

### Funded-reward extension

Before enabling inventory-backed or externally funded organisation rewards, add:

```text
funded reward budget
estimated unredeemed liability
warning threshold
hard issuance threshold
```

Estimated exposure may use:

```text
outstanding balance × configured accounting value
```

It must be labelled as an estimate.

### Expiration

Points expiration is not required for the initial Starter implementation.

When later enabled, expiration must create ledger transactions and use versioned policy.

It must never silently edit cached balances.

---

# 7. P1.5D: Contextual assessments and recommendations

## Ticket P15-ASMT-001: Context-aware learner onboarding

### Objective

Prevent the public Values Starter Check from blocking invited organisation learners.

### Current behaviour

`app/dashboard/page.tsx` currently redirects a non-admin learner without a global value profile to:

```text
/onboarding/assessment
```

### Required behaviour

Public dashboard:

* may continue requiring the public Values Starter Check.

Organisation invitation destination:

* must not require public assessment first.

Organisation workspace:

* requires only assessments configured by the active programme.

### Required return handling

Authentication and invitation acceptance must preserve the intended destination.

Example:

```text
Accept Police invitation
→ sign in
→ return to Police Org Mode
```

not:

```text
Accept Police invitation
→ sign in
→ public assessment
→ public dashboard
→ learner wonders where the police went
```

### Acceptance criteria

* invited organisation learner enters the invited workspace;
* public dashboard still uses the public assessment rule;
* completing an organisation assessment does not falsely satisfy the public Values Starter Check;
* admins remain unaffected;
* redirects are covered by browser tests.

**Status:** Implemented on 2026-08-12 for review.

Implemented:

* auth callback assessment gating now applies only to public destinations. `/org/*` and `/o/*` return paths, including confirmed-login paths that wrap an organisation destination, preserve the invited organisation workspace instead of redirecting to the public Values Starter Check;
* the public dashboard still uses the public Values Starter Check rule for non-admin learners without a public value profile;
* contextual programme assessment completion keeps the attempt, programme and organisation XP-account attribution, but restores or removes the temporary public value profile/dimension rows created by the legacy public assessment implementation so organisation assessments do not satisfy the public starter gate;
* the local E2E wrapper now passes through Playwright file arguments so focused browser gates can run without the full suite.

Validation completed on 2026-08-12:

```bash
npm run test:unit -- --test-name-pattern=auth
npm run typecheck
npm run lint
node scripts/supabase-cli.mjs db reset
node scripts/supabase-cli.mjs test db supabase/tests/database/p15_xp_learning_earning.sql
npm run build
npm run test:e2e -- tests/e2e/organization-missions.spec.ts
```

Result: unit coverage passed 140/140; typecheck and lint passed; local migration replay applied `20260812231000_p15d_contextual_assessment_onboarding.sql`; focused contextual learning pgTAP passed 18/18; production build passed; focused browser coverage passed 1/1 and proves contextual Org Mode entry plus the public dashboard assessment gate.

---

## Ticket P15-ASMT-002: Contextual recommendation profiles

### Objective

Prevent organisation assessments from overwriting the public Project Ve recommendation profile.

### Required model evolution

A learner may have:

```text
Project Ve recommendation profile
Police recommendation profile
Church recommendation profile
```

Evolve the current profile model to include:

```text
context_scope
organization_id
assessment_version_id
```

Required scopes:

```text
platform
organization
```

Public profile:

```text
context_scope = platform
organization_id = null
```

Organisation profile:

```text
context_scope = organization
organization_id = target organisation
```

Assessment attempts and answers should retain organisation/programme context where applicable.

### Recommendation service

Extend:

```text
lib/personalized-recommendations.ts
```

and related repository code to accept a learner workspace context.

Public recommendations use the platform profile.

Organisation recommendations use the organisation profile where one exists.

### Acceptance criteria

* Police assessment does not overwrite public values profile;
* Church assessment does not overwrite Police profile;
* public recommendations remain stable;
* organisation recommendations use the correct context;
* profile access is tenant-scoped;
* context is resolved server-side.

**Status:** Implemented on 2026-08-12 for review.

Implemented:

* `user_value_profiles` and `user_value_dimension_scores` now carry explicit `context_scope` and `organization_id` columns, with platform profiles constrained to a null organisation and organisation profiles constrained to their tenant organisation;
* `user_assessment_attempts` now records organisation context for programme-backed assessments, and `complete_values_assessment` resolves programme organisation/account context server-side before writing profile data;
* platform onboarding, public ads and public recommendation reads continue to use only the platform profile, so organisation assessments do not satisfy or overwrite the public Values Starter Check state;
* `lib/personalized-recommendations.ts` accepts a learner recommendation profile context and the Org Mode learn page requests organisation-scoped recommendations while keeping public recommendation URLs unchanged;
* contextual pgTAP coverage now proves Police and Church programme assessments write separate organisation profiles and leave the public profile untouched.

Validation completed on 2026-08-12:

```bash
npm run typecheck
npm run lint
node scripts/supabase-cli.mjs db reset
npm run db:types:local
node scripts/supabase-cli.mjs test db supabase/tests/database/p15_xp_learning_earning.sql
npm run test:db
npm run test:unit
npm run build
npm run db:types:local:check
npm run test:e2e -- tests/e2e/organization-missions.spec.ts tests/e2e/remediation-flows.spec.ts
```

Result: typecheck passed; lint passed; local migration replay applied `20260812232000_p15d_contextual_recommendation_profiles.sql`; generated database types are current; focused contextual learning pgTAP passed 22/22; full database pgTAP passed 599/599; unit coverage passed 140/140; production build passed; focused browser coverage passed 9/9 and covers the organisation mission acceptance path plus the remediation signup, learner, CMS and institutional LMS flows.

---

## Ticket P15-ASMT-003: Plan-based assessment capability

### Objective

Control assessment use and authoring according to organisation plan.

### Starter

```text
Assessment builder: disabled
Custom questions: disabled
Custom weights: disabled
```

Starter uses:

* direct assignment;
* course quizzes;
* programme completion rules.

### Team

May:

* select published Project Ve assessment templates;
* attach a template to a programme;
* mark it required or optional;
* configure introduction and completion copy.

May not:

* edit questions;
* edit weights;
* add custom value dimensions.

### Professional

May:

* adapt a Project Ve template;
* edit questions and options;
* configure weights against approved Project Ve dimensions;
* version and publish an organisation assessment;
* preview scoring.

### Enterprise

May receive:

* managed custom dimensions;
* custom scoring policies;
* governance controls;
* advanced organisation assessment reporting.

Custom Enterprise dimensions may require platform review or platform-assisted setup.

### Acceptance criteria

* plan entitlements are enforced server-side;
* published assessment versions are immutable;
* editing creates a new version;
* historical attempts retain their original version;
* an organisation cannot alter another organisation’s assessment;
* Starter cannot access assessment-authoring actions.

**Status:** Implemented on 2026-08-12 for review.

Implemented:

* assessment versions now carry owner scope, organisation owner, source version, version number, intro/completion copy and scoring config metadata;
* programme assessment attachments now carry required/optional state plus programme-specific introduction and completion copy;
* programme assessment attachment is enforced server-side by `assessment_capability`: Starter cannot attach assessments, Team can attach published Project Ve templates, and Professional/Enterprise can attach published same-organisation assessment versions;
* published assessment versions, questions, options and weights are immutable at the table-trigger boundary, so editing a published organisation assessment is handled by creating a new draft version;
* Professional/Enterprise organisation assessment revision and publish RPCs enforce organisation ownership, plan capability, draft readiness and tenant isolation;
* the programme editor resolves organisation entitlements server-side, hides assessment attachment for Starter workspaces, filters assessment options to published versions available to the programme organisation, and saves required/intro/completion copy through an authenticated RPC.

Validation completed on 2026-08-12:

```bash
node scripts/supabase-cli.mjs db reset
npm run db:types:local
node scripts/supabase-cli.mjs test db supabase/tests/database/lms_assessment_plan_capabilities.sql
node scripts/supabase-cli.mjs test db supabase/tests/database/lms_programme_builder.sql supabase/tests/database/lms_completion_transcripts.sql supabase/tests/database/p15_xp_learning_earning.sql
npm run typecheck
npm run lint
npm run test:db
npm run test:unit
npm run build
npm run db:types:local:check
npm run test:e2e -- tests/e2e/organization-missions.spec.ts tests/e2e/remediation-flows.spec.ts
```

Result: local migration replay passed including `20260812233000_p15d_plan_based_assessment_capability.sql`; generated database types are current; focused assessment capability pgTAP passed 14/14; affected programme/completion/contextual assessment pgTAP passed 67/67; full database pgTAP passed 613/613; typecheck passed; lint passed; unit coverage passed 140/140; production build passed; focused browser coverage passed 9/9 across Org Mode mission, self-service Starter, CMS and institutional LMS flows.

---

## Ticket P15-ASMT-004: Organisation assessment authoring workspace

### Objective

Provide a professional CMS surface for paid-plan assessment capabilities.

### Reuse existing model

Build on:

```text
assessment_versions
assessment_questions
assessment_question_options
assessment_option_dimension_weights
programme_assessments
```

Do not create a second quiz engine and call it an assessment engine.

### Workspace sections

```text
Overview
Questions
Scoring
Preview
Version history
Review and Publish
```

### Requirements

* draft and published states;
* immutable published versions;
* copy/adapt Project Ve template;
* organisation ownership;
* weighting validation;
* scoring preview;
* question ordering;
* accessible option editing;
* programme usage visibility.

### Acceptance criteria

* Team can select but not edit;
* Professional can adapt approved templates;
* Enterprise capabilities remain governed by entitlement;
* scoring weights are validated;
* published version history is retained;
* learner rendering works inside Org Mode.

### Implementation status

Closed on 2026-08-12.

Delivered:
* added the paid-plan assessment authoring workspace at `/admin/assessments` with Overview, Questions, Scoring, Preview, Version history, and Review and Publish sections;
* added draft-only organisation assessment RPCs for overview editing, question/option/weight upserts, question deletion, and non-persistent scoring preview;
* kept published assessment versions immutable and preserved revision history through organisation-owned draft revisions;
* enforced Professional-or-higher editing through existing assessment capability entitlements while leaving Team usage limited to published Project Ve template selection;
* surfaced programme usage in the assessment workspace and assessment checkpoints in Org Mode learner `/learn`;
* added `/o/[organizationSlug]/assessments/[assessmentVersionId]` learner rendering that submits through the existing programme-scoped `complete_values_assessment` RPC.

Validation completed on 2026-08-12:

```bash
node scripts/supabase-cli.mjs db reset
node scripts/supabase-cli.mjs test db supabase/tests/database/lms_assessment_plan_capabilities.sql
npm run db:types:local
npm run typecheck
npm run lint
npm run test:db
npm run test:unit
npm run db:types:local:check
npm run build
npm run test:e2e -- tests/e2e/organization-missions.spec.ts tests/e2e/remediation-flows.spec.ts
git diff --check
```

Result: local migration replay passed including `20260812234000_p15d_assessment_authoring_workspace.sql`; generated database types are current; focused assessment capability pgTAP passed 20/20; full database pgTAP passed 619/619; typecheck passed; lint passed; unit coverage passed 140/140; generated database type check passed; production build passed; focused browser coverage passed 9/9 including Org Mode assessment checkpoint rendering and route entry.

---

# 8. P1.5E: Institutional supervision and operations

## Ticket P15-OPS-001: Shallow organisation units

### Objective

Support practical institutional structures without building an unlimited organisation-chart engine.

### Required model

```text
organization_units
organization_unit_members
cohort_units
```

Suggested unit fields:

```text
organization_id
parent_unit_id
name
unit_type
status
```

Examples:

```text
Command
Division
Unit
Region
Branch
Parish
Department
School
Class
```

Limit supported depth during Phase 1.5.

Recommended:

```text
Maximum 3 levels
```

### Acceptance criteria

* units cannot cross organisations;
* learners and staff may be assigned to units;
* cohorts may be associated with units;
* reporting may filter by unit;
* unit-scoped supervisors see only permitted learners;
* no table is created separately for each institution’s terminology.

### Implementation status

Implemented on 2026-08-13 for review.

Delivered:
* added `organization_units`, `organization_unit_members`, and `cohort_units` in forward migration `20260813110000_p15_ops_001_organization_units.sql`;
* enforced same-organisation parent, member, and cohort-unit boundaries with trigger-backed checks;
* capped Phase 1.5 unit hierarchy depth at three levels;
* added organisation unit management and per-unit learner/staff assignment in `/admin/organizations`;
* added cohort-unit association in the cohort create/detail workflow and surfaced unit labels in the cohort list;
* extended LMS reporting and CSV export with a unit filter;
* updated the reporting RPC so unit-scoped supervisors can read only learners attached to their permitted unit.

Validation completed on 2026-08-13:

```bash
node scripts/supabase-cli.mjs db reset
node scripts/supabase-cli.mjs test db supabase/tests/database/lms_reporting.sql
npm run db:types:local
npm run db:types:local:check
npm run typecheck
npm run lint
npm run build
git diff --check
```

Result: local migration replay passed including `20260813110000_p15_ops_001_organization_units.sql`; focused LMS reporting pgTAP passed 21/21, including unit depth, cross-organisation boundaries, cohort-unit association, unit reporting filters and unit-scoped supervisor denial paths; generated database types are current; typecheck, lint, production build and whitespace checks passed.

Focused closure on 2026-08-15 added forward migration `20260815100000_p15e_focused_boundary_closure.sql` so unit-derived supervision now requires both an active unit assignment and a matching active organisation membership at access time. Invited/preassigned instructors remain storable, but they receive no reporting, instructor workspace, reminder or intervention authority until the organisation membership becomes active; suspended or removed organisation memberships immediately revoke that operational unit scope.

---

## Ticket P15-OPS-002: Instructor and supervisor workspace

### Objective

Compose the existing reporting, proof, intervention and notification systems into a usable instructor experience.

### Current foundations

```text
cohorts
reporting
mission_proofs
interventions
notifications
instructor role
```

### Required workspace

```text
My cohorts
Learner progress
Inactive learners
Overdue learners
Mission evidence
Open interventions
Announcements and reminders
```

### Required permissions

An instructor may:

* view assigned cohorts;
* view relevant learner progress;
* review permitted mission evidence;
* create or update interventions;
* send scoped reminders.

An instructor may not automatically:

* manage organisation billing;
* change points policy;
* manage organisation memberships;
* publish content;
* view unrelated cohorts.

### Acceptance criteria

* instructor access is assignment-scoped;
* report viewers remain read-only;
* programme managers retain programme operations;
* intervention and proof actions are audited;
* learner notifications use current infrastructure.

### Implementation status

Implemented on 2026-08-13 for review.

Delivered:
* added forward migration `20260813120000_p15_ops_002_instructor_workspace.sql`;
* added `/admin/instructor` as the composed instructor and supervisor workspace for assigned cohorts, learner progress, inactive learners, overdue learners, mission evidence, open interventions, announcements and reminders;
* added `admin_get_instructor_workspace` to compose existing cohorts, reporting/progress, mission proof, intervention and notification data behind one assignment-scoped RPC;
* added scoped instructor actions for creating interventions, updating interventions and sending learner reminders through the existing private notification primitive;
* tightened instructor authorization so active instructor membership alone no longer grants broad organisation audience management or reporting access;
* kept report viewers read-only in the instructor workspace while preserving programme-manager operations;
* routed proof and intervention action checks through learner/unit scope and kept existing audit events for those actions.

Validation completed on 2026-08-13:

```bash
node scripts/supabase-cli.mjs db reset
node scripts/supabase-cli.mjs test db supabase/tests/database/lms_reporting.sql
npm run db:types:local
npm run db:types:local:check
npm run typecheck
npm run lint
npm run build
git diff --check
```

Result: local migration replay passed including `20260813120000_p15_ops_002_instructor_workspace.sql`; focused LMS reporting pgTAP passed 29/29 including unit-scoped instructor workspace data, read-only report viewer behavior, instructor reminder notification delivery and audit, scoped intervention updates and broad-instructor denial paths; generated database types are current; typecheck, lint, production build and whitespace checks passed.

Focused closure on 2026-08-15 aligned the instructor workspace RPC with the UI/server role contract. Broad instructor workspace reads now use a dedicated role helper that includes owner, admin, programme manager, reviewer and report viewer, while deliberately excluding `content_editor`; assignment-scoped instructor/report-viewer access still requires active organisation membership plus active unit assignment. The focused LMS reporting pgTAP now covers invited, active, suspended and removed membership transitions and direct `content_editor` RPC denial.

---

## Ticket P15-OPS-003: Organisation activity history

### Objective

Expose and complete the current `audit_events` foundation.

### Required activity coverage

At minimum:

```text
organisation creation and plan change
membership and invitation changes
course and mission changes
programme assignments
publishing
points adjustments
reward configuration
claim fulfilment
proof review
assessment publishing
```

### UX

Organisation activity page should support:

* date filtering;
* actor filtering;
* action filtering;
* object type;
* object link where safe;
* readable event summary.

Do not expose raw JSON as the primary interface.

### Acceptance criteria

* platform admins can inspect all organisations;
* organisation owners/admins see their organisation only;
* audit events cannot be edited;
* sensitive values are redacted;
* high-risk economic actions retain before/after context.

### Status: completed in this pass

Implemented P15-OPS-003:

* added forward migration `20260813130000_p15_ops_003_organization_activity_history.sql`;
* made `audit_events` immutable through update/delete prevention triggers;
* added activity normalization helpers for organisation resolution, safe object links, readable summaries, redacted details and redacted before/after changes;
* added `admin_get_organization_activity(...)` so platform admins can inspect all organisation activity while organisation owners/admins are constrained to their organisation;
* added coverage triggers for organisation reward configuration, reward claim state changes and organisation assessment version publishing so gaps outside explicit admin RPC emitters still enter the organisation activity history;
* preserved high-risk before/after context for reward configuration, reward claim state changes, XP account control changes and manual organisation points adjustments;
* added the `/admin/activity` page with organisation, actor, action, object-type and date filters plus safe admin object links and human-readable summaries;
* added focused pgTAP coverage in `supabase/tests/database/organization_activity_history.sql` for scoped visibility, redaction, immutability, before/after context and RPC grants.

Result: local migration replay passed including `20260813130000_p15_ops_003_organization_activity_history.sql`; focused organisation activity and LMS reporting pgTAP passed 39/39; generated database types are current; typecheck, lint, production build and whitespace checks passed.

---

## Required ticket P15-AI-001: Organisation AI metering, budgets and abuse controls

### Status

Implemented for P1.5E review on 2026-08-14 and accepted as part of P1.5E closure on 2026-08-15.

### Priority

Required before AI is enabled for any organisation.

This replaces the earlier pilot-dependent wording. Organisation AI access for free, trial, sponsored, paid, temporary, pilot or manually granted organisations must pass through the accepted P1.5E entitlement, allocation, cap, rate-limit, concurrency, worker-validation and reconciliation boundaries.

### Objective

Add organisation AI metering, budget enforcement and abuse controls while preserving the existing durable and idempotent AI job architecture.

Build on:

```text
ai_generation_jobs
current durable worker lease system
existing AI activity panel
central entitlement resolver
P15-ENT-002 temporary grant and entitlement override mechanism
```

Do not create a separate AI-only privilege system. AI availability, allocations, trials and top-ups must be represented through the generic entitlement and temporary grant mechanism from `P15-ENT-002`.

### Required attribution

AI jobs and AI activity must attribute usage to:

```text
organization_id
programme_id where applicable
course_id / lesson_id / assessment_id / mission_id where applicable
operation type
actor_user_id
source entitlement or temporary grant
```

The model must preserve the durable/idempotent job lifecycle already used for AI generation. Idempotency keys, worker leases, retries, stale-lease recovery and existing job status transitions remain part of the architecture.

### Budget and allocation model

Introduce configurable organisation AI allocations through entitlement resolution:

```text
monthly allocation
temporary allocation
top-up allocation
warning threshold
hard limit
allowed operation types
allowed roles
per-user rate limits
organisation concurrency limit
```

Allocations are not wallets, balances or transferable credits. They are enforcement limits for internal cost and usage control.

Top-ups must:

* be organisation-scoped;
* be non-transferable;
* be auditable;
* have optional expiry;
* be included in effective entitlement calculation;
* remain subject to platform safety restrictions and hard caps.

### Cost estimation and reservation

Before queuing a job, the server must:

* resolve effective organisation AI entitlement;
* verify AI access is active;
* verify the requested operation is allowed;
* estimate expected provider usage and internal cost;
* reserve budget or capacity for the job;
* reject requests that would exceed hard caps, rate limits or concurrency limits.

Reservation must be idempotent with job creation so retries do not double-reserve allocation.

### Server-side enforcement

Enforcement must occur on trusted server/database paths, not only in UI code.

At minimum:

* browser actions and API routes must call server-side entitlement and budget checks;
* public RPCs must not be able to bypass organisation AI caps;
* worker claim and execution paths must revalidate organisation AI entitlement, reservation state, rate limits and concurrency before doing provider work;
* stale, cancelled, failed and retried jobs must not leak reserved budget or concurrency slots;
* user-level rate limits must prevent one staff user from exhausting the organisation allocation too quickly;
* organisation concurrency limits must prevent parallel job spikes.

### Actual usage, cost recording and reconciliation

When a provider call completes, record:

```text
actual provider model
actual provider usage
actual provider cost where available
actual internal cost
reserved estimate
final charged amount
reconciliation status
```

Reconciliation must compare reservation, estimate and actual usage. Differences must be auditable and visible in the AI activity/admin view.

### Failed-job charging and refund policy

Define and enforce a clear policy:

* validation failures before provider work must not consume organisation allocation;
* jobs rejected by server-side caps must not consume allocation;
* provider calls that start but fail may charge estimated or actual internal cost only according to an explicit policy;
* system failures after reservation but before provider work must release the reservation;
* cancelled jobs must release or charge according to whether provider work began;
* retries must not double-charge for the same idempotent operation;
* refunds or releases must be auditable.

### Abuse controls

Include:

* hard server-side organisation caps;
* per-user request rate limits;
* organisation concurrency limits;
* operation allowlists by plan/grant;
* worker-side validation immediately before provider calls;
* suspicious usage audit events;
* admin-visible warning and blocked states.

### Non-goals

Do not create:

```text
AI wallets
transferable AI credits
AI credit exchanges
AI credit marketplaces
cross-organisation AI credit transfers
learner-owned AI balances
```

Do not replace the existing durable/idempotent AI job architecture.

### Acceptance criteria

* No organisation can use AI without an effective entitlement from base plan, temporary grant or granular override.
* AI access via temporary trial or top-up uses `P15-ENT-002`.
* AI access always has an allocation.
* Job creation estimates and reserves budget idempotently.
* Worker execution revalidates entitlement, reservation, rate limit and concurrency state.
* Hard caps are enforced server-side.
* User rate limits and organisation concurrency limits are enforced.
* Actual provider usage and internal cost are recorded.
* Estimate-versus-actual reconciliation is visible and audited.
* Failed-job charging and refund/release policy is implemented and tested.
* Existing AI job durability, idempotency, lease and retry behaviour is preserved.
* No AI wallet, transferable credit, exchange or marketplace is introduced.

### Implementation evidence

Delivered in:

```text
supabase/migrations/20260814100000_p15_ai_001_organization_ai_metering.sql
supabase/migrations/20260814101000_p15_ai_001_course_text_usage_reconciliation.sql
supabase/migrations/20260814102000_p15_ai_001_nullable_new_course_attribution.sql
supabase/migrations/20260814103000_p15_ai_001_service_role_detection.sql
supabase/migrations/20260814104000_p15_ai_001_service_role_session_detection.sql
supabase/migrations/20260814105000_p15_ai_001_service_role_setting_detection.sql
supabase/migrations/20260814110000_p15_ai_001_service_role_reconciliation.sql
supabase/migrations/20260815100000_p15e_focused_boundary_closure.sql
features/ai-generation/application/organization-ai-metering.ts
features/ai-generation/application/job-orchestration.ts
features/ai-generation/application/job-requests.ts
features/ai-generation/application/media-asset-commands.ts
features/ai-generation/data/jobs.ts
features/ai-generation/data/workflow.ts
features/learning/admin/planner-commands.ts
features/learning/admin/ai-activity.ts
features/learning/admin/ai-activity-panel.tsx
app/admin/courses/ai-actions.ts
supabase/tests/database/organization_ai_metering.sql
scripts/test-organization-ai-concurrency-local.mjs
```

Implemented behavior:

* `organization_ai_usage_records` is an enforcement ledger for organisation attribution, reservations, actual provider usage/cost, internal charged units, reconciliation status and failed-job policy. It is not a wallet, transferable credit system, exchange or marketplace.
* Organisation AI availability consumes the generic entitlement/grant mechanism from `P15-ENT-002`: AI authoring requires effective `ai_authoring_enabled` plus active allocation keys, hard caps, allowed operation types, allowed roles, per-user daily limits and organisation concurrency limits.
* AI job creation estimates and reserves usage idempotently through trusted RPCs before queuing durable jobs; reservation validation and insertion are serialized at the organisation row so concurrent requests cannot overspend the effective cap.
* Worker claim paths revalidate organisation entitlement, reservation state, actor role authorization, operation allow-lists, effective hard caps, rate limits and concurrency limits before provider work; course-text materialization, replacement, generic completion and failure RPCs reconcile reserved usage without replacing the durable worker lease/idempotency architecture.
* Usage reconciliation is service-role-only. Authenticated organisation users may reserve and queue within entitlement limits, but they cannot release, undercharge or otherwise reconcile visible usage records from browser-accessible RPCs.
* New-course draft jobs may exist before a course row exists; `course_id` attribution is populated only when the course exists, while organisation, actor, operation and source attribution remain required.
* Admin AI activity now surfaces recent usage records and reserved/charged/released unit totals alongside durable job status.
* Failed provider/job outcomes use explicit release or charge policies and write auditable reconciliation events.

Validation:

```text
node scripts/supabase-cli.mjs migration up
npm run db:types:local
npm run db:types:local:check
node scripts/supabase-cli.mjs test db supabase/tests/database/organization_ai_metering.sql
npm run test:organization-ai-concurrency:local
npm run typecheck
```

Focused organisation AI metering pgTAP passed 18/18 after adding role-revocation worker revalidation coverage. The local two-session AI reservation concurrency regression passed and proves that two overlapping requests with insufficient combined budget produce exactly one reservation and one hard-limit rejection. Focused closure validation also passed full local pgTAP, generated type drift, typecheck, lint, production build and whitespace checks:

```text
npm run db:reset
node scripts/supabase-cli.mjs test db supabase/tests/database/organization_ai_metering.sql
node scripts/supabase-cli.mjs test db supabase/tests/database/lms_reporting.sql
npm run test:organization-ai-concurrency:local
npm run test:db
npm run db:types:local:check
npm run typecheck
npm run lint
npm run build
git diff --check
```

Result: focused pgTAP passed 18/18 and 34/34; full pgTAP passed 33 files / 695 tests; the AI concurrency script, generated type drift check, typecheck, lint, production build and whitespace checks passed.

---

## Conditional ticket P15-MEDIA-001: Organisation video/audio hardening

This ticket is required before a pilot depends on organisation-hosted video or audio.

The current lesson model already supports video and audio.

Required extensions may include:

* organisation-aware upload;
* file limits;
* storage accounting;
* poster images;
* captions;
* transcripts;
* duration metadata;
* low-bandwidth error handling.

Starter remains unable to create video or audio blocks.

Full adaptive streaming and transcoding remain Phase 2 or partner-driven work.

---

# 9. P1.5F: Final Phase 1 UI cleanup

This is the final Phase 1 implementation batch.

Do not begin it until the functional Phase 1.5 models and routes have been accepted.

The purpose is to improve the completed product, not redesign unstable functionality repeatedly.

---

## Ticket P15-UI-001: CMS and organisation administration cleanup

### Retain

```text
AdminShell
AdminPrimitives
Radix primitives
shadcn-style wrappers
dnd-kit
Tiptap
TanStack Table
```

### Organisation workspace

Replace the current combined organisation table and sidebar forms with a proper organisation detail workspace.

Recommended sections:

```text
Overview
People
Programmes
Cohorts
Courses
Missions
Points
Rewards
Assessments
Reporting
Activity
Settings
```

Role and plan should determine visible sections.

### Organisation overview

Show:

* organisation identity;
* plan;
* billing status;
* verification state;
* setup checklist;
* learner count;
* active programmes;
* course usage;
* lesson usage;
* storage usage;
* points circulation;
* open claims;
* pending invitations;
* operational alerts.

### People

Improve with:

* search;
* filters;
* invitation status;
* role editing;
* batch actions;
* CSV import;
* unit assignment;
* clear empty states.

Do not require administrators to select from an unfiltered list of every Project Ve profile.

### Programme builder

Refine the current programme form into:

```text
Overview
Learning
Missions
Rewards
Audience
Schedule
Assessments
Completion
Review and Launch
```

Reuse the current programme domain and save functions.

### Mission builder

Refine the current mission form into:

```text
Mission type
Configuration
Communication
Award
Availability
Preview
```

Make clear which settings come from:

* platform capability;
* organisation configuration;
* programme delivery override.

### Points workspace

Provide:

```text
Identity
Balances and circulation
Issuance
Redemptions
Adjustments
Rewards
Ledger
Limits
```

### Reward and claims workspace

Provide:

* reward setup;
* claim-form configuration;
* claim queue;
* processing state;
* fulfilled quota;
* clear organisation responsibility.

### Assessment workspace

Apply plan restrictions clearly.

Do not show unavailable controls as mysteriously broken controls.

### General administration quality

Standardise:

* page headers;
* tabs;
* filters;
* tables;
* status badges;
* onboarding checklists;
* empty states;
* loading states;
* validation summaries;
* save state;
* success and failure feedback;
* destructive confirmation;
* keyboard navigation;
* tablet responsiveness.

Reduce:

* raw UUID display;
* giant selects;
* long undifferentiated forms;
* duplicated helper text;
* actions without task context.

---

## Ticket P15-UI-002: Learner Public Mode and Org Mode cleanup

### Retain

Reuse and improve:

```text
AppHeader
BottomNav
ExperienceHeader
Card
CourseCard
MissionPanel
XPStore
current learner repositories
```

### Primary navigation

Use:

```text
Home
Lesson
Missions
Store
Org Mode
```

Ensure five-item mobile navigation remains legible and accessible.

### Org Mode landing

`/org` must feel like part of the learner product while clearly explaining the organisation offering.

### My Orgs

`/org/my` must clearly handle:

* no organisations;
* pending invitations;
* active organisations;
* programme-only access;
* organisation owner/staff access;
* suspended or expired access.

### Workspace identity

Every organisation learner page must show:

* organisation name;
* logo;
* active workspace;
* organisation points label;
* return-to-public action.

### Organisation home

Prioritise:

```text
Continue assigned learning
Active programme
Upcoming deadlines
Required missions
Organisation points
Available reward
Announcements
Supervisor actions
```

Do not lead an assigned organisation learner with a public catalogue-first experience.

### Public home

Retain:

```text
Project Ve recommendations
Public courses
Public missions
Public rewards
Project Ve XP
```

Add a useful My Orgs entry for learners who have organisation access.

### Courses and programmes

Clarify:

* why a course is assigned;
* which programme it belongs to;
* whether prior completion counts;
* what remains;
* which points account applies.

### Missions

Display organisation-configured:

* title;
* instructions;
* CTA;
* eligibility;
* programme dates;
* points label;
* pending state;
* success state.

### Rewards

Display:

* active points account;
* current balance;
* eligible organisation reward;
* claim status;
* fulfilment responsibility.

Never display Police reward cost beside Project Ve XP as though they are interchangeable.

### Assessment experience

Clearly indicate:

* public assessment;
* organisation programme assessment;
* why it is required;
* which workspace profile it informs.

### Responsive quality

Improve:

* tablet layouts;
* desktop layouts;
* navigation;
* card density;
* reading width;
* programme progress views;
* My Orgs layout;
* claims and proof forms.

### Network and state quality

Standardise:

* skeleton loading;
* empty states;
* retry actions;
* weak-network messages;
* upload progress;
* redemption feedback;
* invitation acceptance feedback;
* mission completion feedback.

---

## Ticket P15-UI-003: Accessibility and visual acceptance

### Requirements

* keyboard navigation;
* visible focus;
* accessible dialogs and menus;
* logical heading structure;
* accessible form labels;
* colour contrast;
* reduced-motion support;
* meaningful loading announcements;
* no information conveyed only through colour.

Organisation accent branding must not override semantic:

* success;
* warning;
* error;
* informational states.

### Visual acceptance evidence

Capture approved screenshots for:

```text
/org
/org/my empty state
/org/my invitations
organisation learner home
organisation missions
organisation rewards
organisation admin overview
organisation people
programme builder
mission builder
points workspace
claim queue
assessment workspace
```

---

# 10. Testing and release gates

## Ticket P15-TEST-001: Database and RLS release gate

Extend the existing P1 database release gate.

Create focused pgTAP coverage for:

### Plans and limits

* Starter cannot create second course;
* Starter cannot exceed five lessons;
* Starter cannot create video/audio blocks;
* Starter cannot use AI;
* entitlement override works;
* direct RPC bypass fails.

### Invitations

* invitation acceptance is idempotent;
* expired invitation fails;
* revoked invitation fails;
* programme invitation does not create broad membership;
* Organisation A cannot inspect Organisation B’s invitations.

### Missions

* organisation can use only entitled mission types;
* Starter cannot use referral;
* Starter mission can award only its organisation account;
* programme override does not mutate base mission;
* contextual referral is correctly attributed.

### XP accounts

* historical XP belongs to platform account;
* account balances reconcile;
* cross-account redemption fails;
* refund returns to original account;
* duplicate award identity includes account;
* arbitrary client account selection fails.

### Rewards

* Starter has one active manual reward;
* disallowed fulfilment fails;
* open-claim limit is enforced;
* monthly fulfilled limit is enforced;
* rejected claims do not consume fulfilled quota.

### Assessments

* public and organisation profiles are separate;
* Starter cannot author assessments;
* Team cannot edit template weights;
* Professional adaptation creates a new version;
* published versions remain immutable.

### Organisation operations

* unit boundaries;
* instructor scope;
* audit-event visibility;
* suspended organisation access denial.

---

## Ticket P15-TEST-002: Browser journeys

Create focused Playwright specifications rather than adding everything to one large file.

Recommended:

```text
tests/e2e/org-mode.spec.ts
tests/e2e/self-service-organization.spec.ts
tests/e2e/organization-missions.spec.ts
tests/e2e/scoped-xp.spec.ts
tests/e2e/organization-assessments.spec.ts
tests/e2e/institutional-operations.spec.ts
tests/e2e/phase-one-ui.spec.ts
```

### Journey 1: Self-service organisation

```text
Public learner opens Org Mode
→ reads organisation proposition
→ creates Starter organisation
→ becomes organisation owner
→ organisation appears in My Orgs
→ configures organisation identity
→ creates one course
→ creates five lessons
→ sixth lesson is blocked
→ video/audio creation is blocked
→ AI creation is blocked
```

### Journey 2: Invitation-first learner access

```text
Organisation owner invites learner
→ learner receives notification
→ learner accepts invitation
→ public assessment does not block entry
→ organisation appears in My Orgs
→ learner enters Org Mode
→ learner returns to Project Ve Public
```

### Journey 3: Starter mission

```text
Owner creates course-completion mission
→ customises organisation wording
→ attaches organisation points award
→ learner completes course
→ organisation points are awarded
→ Project Ve XP is unchanged
```

### Journey 4: Starter reward

```text
Owner creates one manual claim reward
→ learner spends organisation points
→ claim enters organisation queue
→ owner processes and fulfils claim
→ monthly quota updates
→ second active reward is blocked
```

### Journey 5: Scoped XP

```text
Learner earns public XP
→ learner earns Police Points
→ public reward charges public XP
→ police reward charges Police Points
→ cross-spending attempts fail
→ refund returns to correct account
```

### Journey 6: Contextual referral

```text
Police programme manager creates referral mission
→ names it Bring a Fellow Officer Onboard
→ learner receives contextual referral link
→ invitee accepts and qualifies
→ Police Points are awarded
→ public referral attribution is unchanged
```

### Journey 7: Contextual assessment

```text
Organisation learner enters without public assessment
→ programme requires organisation assessment
→ learner completes it
→ organisation recommendation profile is created
→ public recommendation profile remains separate
```

### Journey 8: Institutional supervision

```text
Instructor opens assigned cohort
→ reviews progress
→ reviews mission proof
→ creates intervention
→ learner receives notification
→ unrelated cohort remains inaccessible
```

---

## Ticket P15-TEST-003: Migration and compatibility verification

### Required verification

* old public users retain XP;
* old mission history remains valid;
* old reward redemptions retain economic meaning;
* public Values Starter Check remains functional;
* public dashboard remains functional;
* existing organisation workspaces remain functional;
* P1 programme and cohort tests continue passing;
* generated database types are updated;
* database reset and migration replay succeed;
* production build succeeds;
* lint and typecheck succeed.

---

# 11. Required implementation sequence

## Batch P1.5A

Implement:

```text
P15-ENT-001 - implemented for review
P15-ORG-001 - implemented for review
P15-ORG-002 - closed
P15-ORG-003 - implemented for review
P15-ORG-004 - closed
P15-ORG-005 - closed
P15-ORG-006 - closed
```

P1.5A is formally closed after the contextual learner browser journey amendment passed. P1.5B is the next batch; do not begin implementation until explicitly requested.

## Batch P1.5B

Implement:

```text
P15-MSN-001
P15-MSN-002
P15-MSN-003
P15-MSN-004
P15-MSN-005
```

Implementation kickoff began on 2026-08-09 after explicit approval.

Foundation implemented for review:

* `P15-MSN-001`: forward migration adds the platform-controlled `mission_types` registry, seeds all existing executable mission capabilities, maps existing mission validation types to registry keys, validates mission configuration server-side, and records handler metadata.
* `P15-MSN-002`: forward migration extends `missions` with platform, organisation-private and adapted-platform catalogue fields, organisation mission type entitlements, provenance fields, presentation configuration, reward mode guardrails, Starter active mission/type/reward-mode enforcement, and organisation mission create/adapt RPCs.
* `P15-MSN-003`: forward migration extends `programme_missions` with delivery dates, required flag, nullable future `xp_account_id`, reward override placeholder, presentation overrides and delivery config; programme mission ownership is enforced by trigger. The nullable XP account field is intentionally not wired to an XP account model before P1.5C.
* `P15-MSN-004`: forward migration adds contextual referral tokens, scoped referral attribution context, unblocks multiple contextual referral links per learner by replacing global referred-user uniqueness with scoped uniqueness, and adds an authenticated contextual referral acceptance RPC.
* `P15-MSN-005`: forward migration adds trusted organisation/programme/programme-mission/XP-account context columns to mission awards and proofs, plus organisation proof/award read policies.
* App data layer now applies mission `presentation_config` and programme mission `presentation_overrides` to learner mission summaries without allowing browser-selected reward or XP account context.
* Admin mission workflow now exposes organisation-scoped create/adapt/edit entry points for entitled mission types, keeps platform mission editing platform-admin-only, routes organisation mission publishing through contextual RPC authorization, and lets adapted missions update local presentation while preserving source execution provenance.
* Programme builder mission rows now expose P1.5B delivery controls for dates, required/optional status, point overrides, programme-specific wording and learner preview; the companion RPC rejects unattached mission ids and browser-supplied XP account ids until P1.5C XP accounts are enabled.
* Programme create/edit catalogue loading now uses the resolved admin workspace instead of the raw workspace cookie for courses, missions and direct rewards, so organisation staff cannot lose private catalogue rows when a stale `platform` workspace cookie is present.
* Contextual invite routing now resolves published organisation referral tokens on `/invite/[code]`, renders organisation-specific copy, carries `refKind=contextual` through login/dashboard capture and applies attribution through `accept_contextual_referral` after authentication.
* Learner mission execution now resolves programme mission context through trusted server/database paths: organisation workspace mission summaries carry verified programme context, proof submissions write organisation/programme/programme-mission context, and programme-scoped awards enforce delivery dates plus point overrides before recording `mission_awards`/`xp_transactions`.
* Contextual referral qualification now issues programme mission referral tokens through `ensure_contextual_referral_token`, separates public and contextual referral progress, and awards per-referral programme mission XP only through the scoped `programme:<programmeId>:referral:<referredUserId>` award path with programme context and point overrides.
Validation completed during kickoff:

```bash
node scripts/supabase-cli.mjs test db supabase/tests/database/lms_organization_missions.sql
npm run db:types:local:check
npm run test:db
npm run test:unit
npm run typecheck
npm run lint
npm run build
git diff --check
```

Learner mission execution validation completed on 2026-08-10:

```bash
npm run typecheck
npm run lint
git diff --check
npm run db:reset
node scripts/supabase-cli.mjs test db supabase/tests/database/lms_organization_missions.sql
npm run build
npm run test:db
```

Organisation mission edit workflow validation completed on 2026-08-10:

```bash
npm run typecheck
npm run lint
git diff --check
npm run db:reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/database/lms_organization_missions.sql
npm run build
npm run test:db
```

Contextual referral qualification validation completed on 2026-08-10:

```bash
npm run typecheck
npm run lint
git diff --check
npm run db:reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -o /tmp/p15b-lms-org-missions.tap -f supabase/tests/database/lms_organization_missions.sql
npm run db:types:local
npm run db:types:local:check
npm run build
npm run test:db
npm run test:unit
```

P1.5B closure gate passed on 2026-08-10:

```bash
npm run test:remediation:local
```

Result: `db:reset`, generated type drift check, 23-file/484-test pgTAP suite, repository contracts, quiz XP concurrency, economic integrity and 8/8 Playwright E2E flows passed.

Focused closure amendment implemented on 2026-08-10 after acceptance review:

* programme mission summaries now use stable delivery ids instead of base mission ids, so the same reusable mission can appear independently in multiple programmes;
* learner progress and referral qualification for programme-delivered missions are scoped to programme-attached content by default;
* organisation mission presentation now carries CTA, instructions, eligibility, reward, pending/success/rejection and terms copy through programme overrides to learner mission cards;
* org mission proof submission refreshes through the org missions API and keeps learners in `/o/[slug]` mode;
* contextual referral acceptance now supports `automatic`, `manual_approval` and `existing_members_only` programme entry outcomes, and automatic entry creates programme/course enrolments without broad organisation membership;
* programme-only learners can read attached organisation missions but not unrelated organisation missions;
* organisation proof review now uses org-aware reviewer roles at the UI and RPC boundary, with platform admins retaining cross-org review capability;
* active plan entitlements advertise only the currently wired `organization_xp` mission reward mode until direct/manual mission reward fulfilment is implemented.

Focused closure validation completed on 2026-08-10:

```bash
npm run db:reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/database/lms_organization_missions.sql
npm run typecheck
```

Result: the P1.5B mission pgTAP file passed 54/54 assertions after applying `supabase/migrations/20260810100000_p15b_focused_closure.sql`; TypeScript passed.

Final P1.5B UI closure pass completed on 2026-08-12 after the focused closure review:

* programme managers now review pending manual contextual-referral access requests from the existing programme workspace, with approve/reject actions delegated to `admin_review_contextual_programme_access`;
* pending contextual referral profile visibility is limited by RLS to programme managers for matching pending contextual enrolments;
* organisation mission create/edit workflows now expose catalogue-only versus all-organisation-learner delivery, and the organisation mission RPCs enforce only those two CMS delivery modes;
* the browser acceptance gate now flips organisation-wide delivery through the mission CMS and approves manual contextual referral access through the programme UI instead of direct Supabase calls.

Final P1.5B closure validation completed on 2026-08-12:

```bash
npm run typecheck
npm run lint
npm run db:reset
npm run test:db
npm run db:types:local:check
npm run test:e2e
npm run test:remediation:local
```

Result: `npm run test:remediation:local` passed, including clean migration replay, generated type drift check, 23-file/509-test pgTAP suite, repository contracts, quiz XP concurrency, economic integrity and 9/9 Playwright E2E flows. P1.5B is ready for acceptance review and P1.5C kickoff.

Final narrow P1.5B closure pass completed on 2026-08-12 after the final closure review:

* confirmation and resend-confirmation callbacks now share `buildConfirmedLoginPath`, preserving safe `next` and contextual `ref`/`refKind` parameters consistently;
* the organisation mission browser acceptance fixture now covers a proof-submission programme mission from learner submission, pending review copy, organisation proof queue approval and the learner's approved mission success state while remaining in Org Mode;
* the proof mission fixture uses the supported `organization_mission_type_entitlements` model before seeding a `proof_submission` mission.

Final narrow P1.5B closure validation completed on 2026-08-12:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run test:db
npm run test:e2e
```

Result: typecheck, lint, unit tests, build, the 23-file/509-test pgTAP database suite and 9/9 Playwright E2E flows passed. P1.5B is formally closed; P1.5C is authorized.

Then stop for review.

## Batch P1.5C

Implement:

```text
P15-XP-001
P15-XP-002
P15-XP-003
P15-XP-004
P15-XP-005
P15-RWD-001
P15-XP-006
```

P15-XP-001 completed on 2026-08-12:

* forward migration `20260812130000_p15c_xp_account_model.sql` introduces `xp_accounts`, scoped account/status enums, the seeded Project Ve XP platform account, default organisation XP accounts, RLS-backed account reads and account FKs for XP transactions/programme mission context;
* historical `xp_transactions` are backfilled to Project Ve XP and future legacy inserts default to that account, preserving `profiles.xp_balance_cached` as the Project Ve compatibility cache;
* duplicate earn identity now includes `xp_account_id`, and current platform XP-producing database paths were updated to use the account-aware conflict target without enabling browser-selected organisation XP awards;
* focused pgTAP coverage in `p15_xp_accounts.sql` verifies seed/backfill behavior, Starter organisation account creation, ownership constraints, account-scoped duplicate awards, RLS reads and trigger helper execute denial.

Validation completed on 2026-08-12:

```bash
npm run db:reset
node scripts/supabase-cli.mjs test db supabase/tests/database/p15_xp_accounts.sql
npm run db:types:local
npm run test:db
npm run typecheck
npm run lint
git diff --check
npm run build
npm run test:unit
npm run db:types:local:check
```

Result: migration replay passed; focused XP account pgTAP passed 16/16; full database suite passed 24 files/525 assertions; typecheck, lint, unit tests, build, generated type drift and whitespace checks passed.

P15-XP-002 completed on 2026-08-12:

* forward migration `20260812140000_p15c_xp_account_balances.sql` adds ledger-reconciled `user_xp_balances`, initializes a Project Ve XP balance for every profile, and backfills every existing account balance from `xp_transactions`;
* a transaction trigger applies account-scoped credits and debits atomically, rejects overdraws, and keeps `profiles.xp`/`xp_balance_cached` as the Project Ve XP compatibility projection only;
* the account-aware `private.post_xp_transaction` overload is private, preserves the old platform-only signature for established callers, and does not accept a browser-selected account;
* focused pgTAP coverage in `p15_xp_balances.sql` verifies platform/organisation isolation, ledger reconciliation, spend protection, RLS and private primitive denial; legacy LMS fixtures now seed opening balances through the ledger.

Validation completed on 2026-08-12:

```bash
npm run db:reset
node scripts/supabase-cli.mjs test db supabase/tests/database/p15_xp_balances.sql
node scripts/supabase-cli.mjs test db supabase/tests/database/xp_ledger_security.sql
npm run db:types:local
npm run test:db
```

Result: migration replay passed; focused balance pgTAP passed 14/14; XP ledger security pgTAP passed 16/16; the full database suite passed 25 files/539 assertions.

P15-XP-003 completed on 2026-08-12:

* forward migration `20260812150000_p15c_account_aware_learning_earning.sql` gives programme delivery, enrolment, programme missions and programme assessments a trusted organisation XP-account reference; programme defaults are assigned from the active organisation account and cross-organisation account configuration is rejected;
* quiz attempts and values-assessment attempts persist their programme and account context. New three-argument public RPC overloads verify active enrolment and programme ownership before resolving the account; established two-argument RPC signatures remain available for public Project Ve XP learning;
* programme mission awards resolve the account from stored delivery context rather than metadata supplied by a client, and their ledger and mission-award records are moved atomically to the organisation account;
* `programme_courses.prior_completion_policy` explicitly supports `recognize_prior_completion` and `require_completion_in_context`, with the former as the conservative existing-behaviour default; generated database types now include the new delivery fields and RPCs;
* contextual programme course completion is recorded in `programme_course_completions`; `recognize_prior_completion` preserves the explicit public-completion path while `require_completion_in_context` requires course-specific contextual activity and cannot be satisfied by a public-only completion;
* focused pgTAP coverage in `p15_xp_learning_earning.sql` verifies account defaults, enrolment snapshots, programme delivery ownership, both prior-completion policies, programme award isolation and rejection of unenrolled/cross-account attempts.

Validation completed on 2026-08-12:

```bash
npm run db:reset
node scripts/supabase-cli.mjs test db supabase/tests/database/p0_release_gate.sql supabase/tests/database/quiz_security.sql supabase/tests/database/p15_xp_learning_earning.sql
npm run db:types:local
npm run db:types:local:check
git diff --check
```

Result: clean migration replay passed; targeted pgTAP passed across the release gate, quiz security and P15-XP-003 tests; generated type drift verification passed. P15-XP-003 is closed.

P15-XP-004 completed on 2026-08-12:

* forward migration `20260812160000_p15c_account_aware_rewards.sql` assigns each reward and redemption an XP account, backfills existing platform and organisation rewards, and rejects incompatible organisation/account configuration;
* redemption derives its account exclusively from the stored reward configuration, charges the matching account while preserving the established atomic inventory workflow, and stores that account on the redemption;
* refunds resolve and credit the account recorded on the original redemption; the legacy internal implementations are no longer directly executable;
* native reward bonuses use the valid ledger source type and the redemption workflow has the timestamp field required by its legacy internal update path;
* focused pgTAP coverage in `p15_xp_rewards.sql` verifies organisation-account charging, outsider denial, redemption account snapshots and refund ledger restoration.

Validation completed on 2026-08-12:

```bash
npm run db:reset
node scripts/supabase-cli.mjs test db supabase/tests/database/p15_xp_rewards.sql
npm run db:types:local
npm run db:types:local:check
git diff --check
```

Result: clean migration replay passed; P15-XP-004 pgTAP passed 7/7; generated type drift verification passed. P15-XP-004 is closed.

P15-XP-005 completed on 2026-08-12:

* forward migration `20260812170000_p15c_xp_account_presentation.sql` adds account-specific display labels, plural labels, icons and formats without changing account ownership or historical ledger values;
* the manager-authorized presentation RPC permits only mutable display fields for organization accounts; platform accounts and ownership remain immutable through this path;
* My Orgs and the organisation learner workspace now resolve the signed-in learner's default organization account balance and configured label, without exposing transfer or exchange controls;
* organisation administration now exposes the account presentation form, circulation/issuance/redemption/adjustment summary and recent transaction history through a manager-scoped overview RPC;
* focused pgTAP coverage in `p15_xp_presentation.sql` verifies defaults, manager configuration and ownership immutability.

Validation completed on 2026-08-12:

```bash
npm run db:reset
node scripts/supabase-cli.mjs test db supabase/tests/database/p15_xp_presentation.sql supabase/tests/database/p0_release_gate.sql
npm run db:types:local
npm run db:types:local:check
npm run typecheck
git diff --check
```

Result: clean migration replay passed; focused pgTAP and release gate passed; generated type drift and TypeScript checks passed. P15-XP-005 is closed.

P15-RWD-001 completed on 2026-08-12:

* Starter reward enforcement is database-backed and concurrency-safe: one active reward, manual fulfilment only, disabled voucher/QR inventory and disabled external/native/perk fulfilment paths;
* Starter open and monthly fulfilled claim caps resolve from plan entitlements, ignore cancelled/refunded/expired claims, and are protected by an organisation transaction lock;
* focused pgTAP coverage in `p15_rwd_starter_rewards.sql` verifies active reward limits, fulfilment restrictions, inventory blocking, open/monthly claim caps, cancelled-claim handling and native reward bonus accounting.

Validation completed on 2026-08-12:

```bash
npm run db:reset
node scripts/supabase-cli.mjs test db supabase/tests/database/p15_rwd_starter_rewards.sql supabase/tests/database/p15_xp_learning_earning.sql
npm run test:db
npm run db:types:local:check
npm run typecheck
git diff --check
```

Result: migration replay passed; focused P15-RWD-001 and XP learning coverage passed; the full database suite passed 29 files/568 assertions; generated type drift, TypeScript and whitespace checks passed. P15-RWD-001 is closed.

P15-XP-006 completed on 2026-08-12:

* forward migration `20260812200000_p15c_xp_issuance_exposure_controls.sql` adds account-scoped rolling issuance periods, total and per-user issuance caps, optional accounting value, funded-reward budget and warning/hard exposure thresholds;
* organisation-account earning is protected by an advisory-locked database trigger. Duplicate award identities remain idempotent, while new issuance is rejected when the account or learner cap is exceeded or projected estimated liability crosses the hard threshold;
* organisation ledger rows retain trusted programme attribution from programme context, quiz/assessment attempts and sponsored reward context; public Project Ve XP rows remain outside organisation issuance controls;
* manager-only controls update is audited through `admin_update_xp_account_controls`; the existing manager overview now exposes period capacity, estimated unredeemed liability, warning/block state, issuance by programme, issuance by learner and existing reward/transaction operations;
* expiration remains intentionally out of scope for Starter, as required by P15-XP-006;
* focused pgTAP coverage in `p15_xp_issuance_controls.sql` verifies manager configuration, programme attribution, total/per-user caps, duplicate handling, exposure thresholds, reporting and learner/anonymous denial.

Validation completed on 2026-08-12:

```bash
npm run db:reset
node scripts/supabase-cli.mjs test db supabase/tests/database/p15_xp_issuance_controls.sql
npm run test:db
npm run db:types:local
npm run db:types:local:check
npm run typecheck
npm run lint
npm run test:unit
npm run build
git diff --check
```

Result: clean migration replay passed; focused P15-XP-006 pgTAP passed 14/14; the full database suite passed 30 files/585 assertions; 138 unit tests, typecheck, lint, production build, generated type drift and whitespace checks passed. P15-XP-006 ticket-level implementation is closed; the focused closure review below records the remaining cross-boundary remediation.

## Focused P1.5C closure review and remediation

The 2026-08-12 acceptance review found that the first P1.5C implementation pass was structurally sound but still partial at several application and legacy-RPC boundaries. The authorized closure scope was limited to `P15C-CLOSE-01` through `P15C-CLOSE-05`; P1.5D was not started.

The focused closure pass completed the remaining gaps:

* `P15C-CLOSE-01`: learner quiz, lesson-page progress and organisation reward routes now carry trusted programme or organisation context; organisation-wide mission scopes resolve the organisation account from stored context rather than browser input; contextual page completion is persisted separately from public completion.
* `P15C-CLOSE-02`: quiz, assessment, mission and reward transactions receive their resolved account and programme context before insertion, so issuance controls and attribution observe the final account at trigger time.
* `P15C-CLOSE-03`: Org Mode rewards use workspace-scoped snapshot and redemption routes, with configured account labels shown in the learner store.
* `P15C-CLOSE-04`: organisation administrators can make audited account-aware adjustments, and genuine reward refunds are exempted from new-issuance caps while restoring the original account.
* `P15C-CLOSE-05`: Starter manual claims support validated single-select fields, and the browser release gate covers public versus organisation earning, contextual completion, organisation redemption, refund and admin-account workflows.

Validation completed on 2026-08-12:

```bash
npm run test:remediation:local
npm run ci
git diff --check
```

Result: clean migration replay and generated type drift passed; the full database suite passed 30 files/585 assertions; repository contracts, quiz XP concurrency, economic integrity, 138 unit tests, typecheck, lint, production build and 9/9 Playwright E2E flows passed. P1.5C was stopped for review. P1.5D remains unstarted.

### Follow-up P1.5C closure pass

The follow-up 2026-08-12 review kept P1.5C open for three focused blockers:

* exact learner delivery context was still ambiguous on Org Mode course, lesson and quiz routes because `workspace.programmeIds[0]` could attribute learning to the wrong programme;
* `require_completion_in_context` still allowed public lesson completion plus a contextual quiz to satisfy programme course completion;
* reward refunds were skipped by the insert-time issuance trigger, but later issuance and overview calculations still counted refund restoration rows as minted issuance.

The follow-up pass adds forward migration `20260812220000_p15c_delivery_context_completion_issuance_closure.sql` and app wiring that:

* resolves Org Mode course delivery as an explicit organisation or programme context and carries the selected `programmeId` through course, lesson, quiz, result and resume links;
* passes `organizationId` plus optional `programmeId` to lesson progress and quiz start APIs while keeping XP account resolution private to database resolvers;
* blocks programme quiz start when `require_completion_in_context` is active and only public/global lesson progress exists;
* evaluates required lessons from `programme_lesson_page_completions` for contextual programme completion;
* excludes genuine reward-refund restoration rows from period, learner, programme and overview issuance calculations while leaving circulation and estimated liability based on outstanding balances.

Validation completed on 2026-08-12:

```bash
npm run typecheck
npm run lint
node scripts/supabase-cli.mjs db reset
node scripts/supabase-cli.mjs test db supabase/tests/database/p15_xp_learning_earning.sql
node scripts/supabase-cli.mjs test db supabase/tests/database/p15_xp_issuance_controls.sql
npm run db:types:local:check
npm run build
npm run test:e2e
git diff --check
```

Result: local migration replay passed; focused contextual learning pgTAP passed 15/15; focused issuance controls pgTAP passed 16/16; local database type drift, typecheck, lint, production build, full Playwright browser suite 9/9 and whitespace checks passed. P1.5C was kept open for final application-layer closure. P1.5D remains unstarted.

### Final P1.5C application closure pass

The final 2026-08-12 review accepted the ledger and backend contextual-completion work but kept P1.5C open for remaining learner/admin application gaps:

* Org Mode learning catalogue did not pass `workspace.courseDeliveryOptions`, so shared courses in multiple programmes rendered as one ambiguous link;
* Org Mode course progress still used public/global lesson progress for programmes configured with `require_completion_in_context`;
* organisation learner quiz/result/reward surfaces still used XP wording instead of the configured account label;
* admin account adjustments only accepted active organisation members, not programme-only learners;
* the browser gate did not prove multi-programme delivery, contextual progress presentation, label copy or programme-only adjustment.

The final pass adds forward migration `20260812230000_p15c_final_app_closure.sql` and application wiring that:

* renders separate Org Mode catalogue cards per delivery option and carries the selected `programmeId` into course, lesson, quiz and result URLs;
* derives completed lesson indicators, course percentage and resume targets from `programme_lesson_page_completions` when the programme-course policy is `require_completion_in_context`;
* passes the workspace account label through Org Mode course, lesson, quiz result and reward-store components while preserving public-mode XP defaults;
* allows `admin_adjust_xp_account` for active/completed programme-only learners in the same organisation without creating organisation memberships;
* extends the institutional Playwright journey to cover two programme deliveries for the same course, contextual progress presentation, white-labelled Police Points copy, and a programme-only learner adjustment.

Validation completed on 2026-08-12:

```bash
npm run typecheck
npm run lint
npm run db:reset
node scripts/supabase-cli.mjs test db supabase/tests/database/p15_xp_issuance_controls.sql
npm run build
npm run test:e2e
git diff --check
```

Result: typecheck passed; lint passed; local migration replay passed including `20260812230000_p15c_final_app_closure.sql`; focused issuance controls pgTAP passed 18/18; production build passed; full Playwright browser suite passed 9/9; whitespace checks passed. P1.5C is ready for acceptance review again. P1.5D remains unstarted.

Then stop for review.

## Batch P1.5D

Implement:

```text
P15-ASMT-001
P15-ASMT-002
P15-ASMT-003
P15-ASMT-004
```

P1.5D closed on 2026-08-12 after P15-ASMT-001 through P15-ASMT-004 validation, then received focused closure passes on 2026-08-13 for the acceptance-review gaps and final assessment-authoring role alignment.

Focused closure:

* `P15D-CLOSE-01`: assessment RLS now allows active/completed programme-only learners to read published organisation assessment versions only when the assessment is attached to one of their enrolled programmes; unpublished organisation assessment versions remain restricted to organisation programme managers and platform admins.
* `P15D-CLOSE-02`: organisation-context assessment completion no longer mutates the public Project Ve profile XP compatibility balance, and Org Mode assessment reward copy uses the workspace XP account label.
* `P15D-CLOSE-03`: successful Org Mode assessment completion redirects with programme and assessment context, and `/o/[organizationSlug]/learn` renders the programme-specific `completion_copy` only after a matching completed attempt exists.
* `P15D-CLOSE-04`: organisation recommendation links no longer pick `workspace.courseDeliveryOptions[courseId][0]` for ambiguous shared-course deliveries; multi-delivery recommendations return to the organisation learn page for explicit learner choice, while single-delivery recommendations preserve their programme context.
* `P15D-CLOSE-05`: the Enterprise assessment entitlement no longer advertises unrestricted `custom`; it is explicitly aligned to `template_adaptation` until managed Enterprise custom dimensions and scoring are implemented in a future Enterprise scope.
* `P15D-CLOSE-06`: browser and pgTAP coverage now extends through programme-only assessment access, organisation XP/profile isolation, programme completion messaging, recommendation context preservation, and the public Values Starter Check regression.
* `P15D-CLOSE-07`: assessment authoring now uses a dedicated organisation assessment-management helper that allows `organisation_owner`, `organisation_admin`, `programme_manager` and `content_editor` for assessment draft read/edit/publish, while leaving generic programme-management permissions restricted to owner/admin/programme_manager.

Result: local migration replay passed including `20260813100000_p15d_assessment_authoring_role_alignment.sql`; focused assessment capability pgTAP passed 32/32, including content-editor authoring, learner/reviewer/report-viewer denial and no programme-management expansion; all 31 database pgTAP files passed in explicit batches with 631 assertions after the Supabase CLI directory form failed at connection setup; generated database types and local type drift passed; typecheck passed; lint passed; whitespace checks passed.

Stop for review before P1.5E.

## Batch P1.5E

Implement:

```text
P15-ENT-002 (implemented 2026-08-13; accepted and closed 2026-08-15)
P15-AI-001 (implemented 2026-08-14; focused closure implemented 2026-08-15; accepted and closed 2026-08-15)
P15-OPS-001
P15-OPS-002
P15-OPS-003
```

P1.5E was accepted and closed on 2026-08-15. Organisation AI access remains governed by the accepted P1.5E entitlement, allocation, cap, rate-limit, concurrency, worker-validation and reconciliation boundaries.

Implement `P15-MEDIA-001` only when a pilot or product decision explicitly depends on organisation-hosted video or audio.

Then stop for review.

## Pre-P1.5F hotfix

`HOTFIX-P15C-CURRENCY-001` was the high-priority P1.5C product-model correction
required before P1.5F implementation.

Status: implemented on 2026-08-18 and verified in the final Phase 1 local release
gate on 2026-08-30.

Scope:

* correct `xp_accounts.accounting_currency` so it stores a nullable per-account ISO-4217 accounting currency code rather than the legacy `XP` sentinel;
* migrate legacy `XP` values to unconfigured/null without assuming NGN, USD or any other fiat currency;
* keep accounting currency on `xp_accounts`, not organisations;
* update `admin_update_xp_account_controls(...)` so the one authoritative manager-controlled RPC path validates, normalizes and persists accounting currency while retiring any stale writable overload;
* update `admin_get_xp_account_overview(p_organization_id)` and server-side mappers so the overview exposes `accountingCurrency`;
* preserve existing exposure mathematics: outstanding organisation Points balances multiplied by `accounting_value_per_unit`; currency is context only and must not perform conversion;
* minimally update the current organisation Points controls and displays so accounting/exposure amounts format from the configured ISO code, while Points quantities remain Points quantities;
* state in admin copy that accounting currency is used internally for exposure/liability estimates and does not make Points cash-redeemable;
* regenerate checked-in database types through the existing workflow;
* add database/app regression coverage for authorised and cross-organisation currency updates, legacy sentinel migration, malformed currency rejection, unchanged exposure mathematics, threshold validation and no RPC privilege regression.

Out of scope: P1.5F Stitch/Points redesign, FX rates, automatic conversion, cash redemption, wallets, withdrawals, crypto, organisation-country inference, learner currency settings, multiple Points-account UX and historical exposure charts.

Implementation evidence:

* migration `20260815110000_hotfix_p15c_currency_accounting.sql` drops the legacy `XP` default, makes `xp_accounts.accounting_currency` nullable, migrates existing `XP` values to null/unconfigured and adds the configured-code constraint;
* the final writable admin control RPC is `public.admin_update_xp_account_controls(uuid, text, numeric, integer, integer, integer, numeric, numeric, numeric)`;
* the previous writable overload `public.admin_update_xp_account_controls(uuid, numeric, integer, integer, integer, numeric, numeric, numeric)` is revoked, dropped and removed from RPC security classifications;
* `admin_get_xp_account_overview(p_organization_id)` now returns `controls.accountingCurrency`;
* the current organisation admin Points controls expose accounting currency with code-based input and format accounting/exposure values from the configured ISO code;
* `types/database.ts` was regenerated from the local database.

Validation completed on 2026-08-18:

```bash
npm run db:reset
node scripts/supabase-cli.mjs test db supabase/tests/database/p15_xp_issuance_controls.sql
npm run db:types:local
npm run db:types:local:check
npm run typecheck
npm run lint
npm run build
npm run test:unit
node scripts/supabase-cli.mjs test db supabase/tests/database/ai_generation_worker.sql supabase/tests/database/cms_template_duplication.sql supabase/tests/database/lms_assessment_plan_capabilities.sql supabase/tests/database/lms_cohorts_assignments.sql supabase/tests/database/lms_completion_transcripts.sql supabase/tests/database/lms_course_catalog_model.sql supabase/tests/database/lms_organization_content_limits.sql supabase/tests/database/lms_organization_entitlements.sql supabase/tests/database/lms_organization_invitations.sql supabase/tests/database/lms_organization_missions.sql supabase/tests/database/lms_organization_profile_lifecycle.sql supabase/tests/database/lms_organizations_memberships.sql supabase/tests/database/lms_p1_release_gate.sql supabase/tests/database/lms_programme_builder.sql supabase/tests/database/lms_programme_engagement.sql supabase/tests/database/lms_programme_notifications.sql supabase/tests/database/lms_reporting.sql supabase/tests/database/lms_self_service_organizations.sql supabase/tests/database/notification_security.sql supabase/tests/database/organization_activity_history.sql supabase/tests/database/organization_ai_metering.sql supabase/tests/database/p0_release_gate.sql supabase/tests/database/p15_rwd_starter_rewards.sql supabase/tests/database/p15_xp_accounts.sql supabase/tests/database/p15_xp_balances.sql supabase/tests/database/p15_xp_issuance_controls.sql supabase/tests/database/p15_xp_learning_earning.sql supabase/tests/database/p15_xp_presentation.sql supabase/tests/database/p15_xp_rewards.sql supabase/tests/database/progress_security.sql supabase/tests/database/quiz_security.sql supabase/tests/database/rpc_security.sql supabase/tests/database/xp_ledger_security.sql
npm run test:repositories:local
npm run test:quiz-xp-concurrency:local
npm run test:organization-ai-concurrency:local
npm run test:economic-integrity:local
npm run test:e2e
git diff --check
```

Result: migration replay passed; focused issuance controls pgTAP passed 34/34; full explicit pgTAP passed 33 files / 711 tests; generated type drift, typecheck, lint, production build, 140 unit tests, repository contracts, quiz XP concurrency, organisation AI concurrency, economic integrity, 15/15 Playwright E2E flows and whitespace checks passed.

## Batch P1.5F

Status: **implemented and locally closed on 2026-08-30**.

`HOTFIX-P15C-CURRENCY-001` is included in the validated Phase 1 state.

Completed:

```text
P15-UI-001
P15-UI-002
P15-UI-003
P15-TEST-001
P15-TEST-002
P15-TEST-003
```

Closure scope:

* the shared admin shell and primitives now provide the Phase 1 visual system,
  responsive navigation, workspace tabs, dialogs, drawers, filters, tables,
  status treatments and task-oriented empty/error states;
* organisation administration now has a dedicated detail workspace with an
  operational Overview and focused People membership, invitation and unit
  workflows, with role-specific section visibility;
* the platform product catalogue is represented as a distinct pseudo-workspace
  with its own Overview and Catalog Staff workflows, rather than leaking
  organisation membership concepts into platform content operations;
* catalogue staffing and content authorization use explicit RLS/RPC boundaries.
  Invitation reads use the narrowly authorized
  `current_user_can_read_platform_catalog_invitation(...)` helper rather than
  exposing private authentication helpers;
* learner, public, course, lesson, mission, reward, advertising, support and
  policy surfaces received the final responsive visual cleanup without replacing
  the accepted CMS/LMS domain architecture;
* organisation reward visibility/actions, XP ledger transactions and contextual
  recommendation sections are covered by focused migrations and repository
  paths; and
* the accepted P0.3, P1.1 and P1.2 performance work is integrated: one-operation
  organisation route context, set-wise mission state, focused course-card read
  models and a first-useful-HTML dashboard boundary.

Final local validation on 2026-08-30:

* `npm run test:remediation:local` passed from a clean migration replay;
* pgTAP passed 35 files / 755 tests;
* demo/live repository contracts, quiz-XP concurrency, organisation-AI
  concurrency and economic-integrity gates passed;
* the production Playwright suite passed 21/21, including three focused browser
  checks for the design system/platform dashboard, organisation Overview/People
  boundaries and Platform Catalog Overview/Catalog Staff boundaries;
* `npm run ci` passed typecheck, lint, 158 unit tests and the production build;
  and
* generated database-type parity and `git diff --check` passed.

The release gate also found and closed two boundary defects before this record
was written: catalog invitation RLS no longer depends on a revoked private
helper, and report viewers no longer invoke owner/admin-only activity reads while
loading the overview.

Stop after Phase 1. Do not begin P2 until hosted query evidence has been captured
and reviewed.

---

# 12. Explicit Phase 1.5 non-goals

Do not implement:

```text
A separate organisation currency engine
A separate mission engine
A separate organisation authentication system
A public organisation directory
Organisation ID login
Points transfer
Points exchange
Cross-organisation balance portability
Multiple active organisation point accounts
Arbitrary organisation-written mission code
Custom JavaScript mission validation
Unlimited Starter storage
Starter video or audio authoring
Starter AI authoring
Starter referral missions
Starter direct reward mission awards
Starter inventory-backed rewards
AI credit trading
AI wallets
Transferable AI credits
AI credit exchanges
AI credit marketplaces
A generic reward integration marketplace
Custom organisation domains
SAML
SCIM
SCORM
xAPI
LTI
Full media transcoding
Fully offline learning
Unlimited organisation hierarchy
Real-time collaborative editing
A separate CMS repository
```

These items must not be introduced through broad interpretation of the tickets.

---

# 13. Phase 1.5 closure gate

Phase 1.5 is complete when:

* Org Mode is part of the learner product;
* `/org` communicates the organisation offering;
* `/org/my` handles invitations and organisation access;
* there is no public organisation directory;
* learners enter organisations through invitations;
* public learning remains available;
* self-service users can create Starter organisations;
* plan entitlements are centrally enforced;
* controlled temporary entitlements, trials, top-ups and granular overrides are centrally resolved, auditable and revocable wherever they are used;
* Starter is limited to one course and five lessons;
* Starter uses text and image-oriented lesson blocks only;
* Starter has no AI access;
* Starter has two automatic XP-only mission types;
* Starter has one manual claim-form reward;
* Starter reward quotas are enforced;
* organisations can configure enabled platform mission capabilities;
* organisation mission communication is customisable;
* contextual referral links work;
* mission outcomes retain organisation and programme context;
* organisation points are white-labelled XP;
* XP accounts are economically isolated;
* rewards charge the correct account;
* public assessment does not block organisation invitation entry;
* public and organisation recommendation profiles remain separate;
* plan-based assessment capabilities are enforced;
* organisation units and instructor supervision are usable;
* organisation activity is auditable;
* organisation AI access is governed by the accepted `P15-ENT-002` and `P15-AI-001` entitlement, allocation, cap, rate-limit, concurrency, worker-validation and reconciliation boundaries;
* wherever organisation AI access is enabled, AI economic enforcement includes allocation, reservation, hard caps, rate limits, concurrency limits, worker validation, actual usage/cost recording and reconciliation;
* CMS and learner UI cleanup is complete;
* database and browser release gates pass;
* public Project Ve behaviour remains intact.

Final sequence:

```text
P0 CMS remediation
→ CLOSED

P1 Hybrid LMS foundation
→ CLOSED

P1.5 Org Mode and institutional pilot readiness
→ P1.5A–P1.5F IMPLEMENTED; FINAL LOCAL RELEASE GATE PASSED

P2 Enterprise and institutional expansion
→ BLOCKED UNTIL HOSTED QUERY EVIDENCE IS CAPTURED AND REVIEWED
```
