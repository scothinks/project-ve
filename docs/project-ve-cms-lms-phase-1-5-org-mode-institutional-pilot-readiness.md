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
```

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
* organisation rewards use organisation-owned and programme-sponsored reward filters, with redemption disabled until isolated organisation point accounts land;
* organisation transcript view filters the canonical transcript response to the active organisation workspace;
* shared learner components accept scoped initial snapshots so org views do not hydrate back into public data.

Scope notes:

* Isolated organisation point balances and organisation reward redemption mutations remain for the later XP/reward tickets; this ticket exposes the workspace account label and read-scoped store only.
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

---

## Conditional ticket P15-AI-001: Organisation AI metering

This ticket is required only before paid organisations are given AI access.

### Extend existing system

Build on:

```text
ai_generation_jobs
current durable worker lease system
existing AI activity panel
```

Add:

```text
organization_id
programme_id where applicable
operation type
estimated credits
actual provider usage
actual internal cost
```

Introduce organisation AI budgets:

```text
monthly allocation
warning threshold
hard limit
allowed roles
```

Do not create an AI credit market.

Do not make AI credits transferable.

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
P15-XP-006 core controls
```

Then stop for review.

## Batch P1.5D

Implement:

```text
P15-ASMT-001
P15-ASMT-002
P15-ASMT-003
P15-ASMT-004
```

Then stop for review.

## Batch P1.5E

Implement:

```text
P15-OPS-001
P15-OPS-002
P15-OPS-003
```

Implement conditional AI or media tickets only with explicit pilot authorisation.

Then stop for review.

## Batch P1.5F

Implement:

```text
P15-UI-001
P15-UI-002
P15-UI-003
P15-TEST-001
P15-TEST-002
P15-TEST-003
```

Then stop for final Phase 1 review.

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
→ MUST CLOSE

P2 Enterprise and institutional expansion
→ MAY BEGIN
```
