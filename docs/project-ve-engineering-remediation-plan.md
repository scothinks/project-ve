# Project Ve Engineering Remediation Plan

## Purpose

This plan converts the engineering audit of Project Ve into an implementation backlog.

The objective is **not to rewrite Project Ve**.

The objective is to:

1. close confirmed security and integrity vulnerabilities;
2. establish trustworthy database and application boundaries;
3. introduce automated enforcement of those boundaries;
4. simplify architecture around explicit domain use cases;
5. improve reliability, observability, testability and maintainability;
6. preserve existing product behavior unless a ticket explicitly changes it.

The current application contains substantial working functionality. Refactoring must therefore be incremental and migration-safe.

---

# 0. CODEX EXECUTION RULES

These rules apply to every ticket below.

## 0.1 Do not rewrite migration history

Existing files under:

```text
supabase/migrations/
```

represent historical database state.

Do not modify historical migrations to implement these fixes.

Create **new forward migrations** for all database changes.

Historical migration files mentioned below are references showing where the problematic behavior originated.

---

## 0.2 Work in priority order

Implementation order:

```text
P0 security/integrity
    ↓
P1 architecture/reliability
    ↓
P2 sophistication/cleanup
```

Do not begin large structural refactors while P0 attack paths remain open.

---

## 0.3 One invariant per ticket

Each ticket should result in an independently verifiable architectural improvement.

Avoid combining unrelated cleanup into a large "refactor" PR.

---

## 0.4 Every security fix requires a regression test

Do not consider a vulnerability fixed because the normal UI can no longer reach it.

Tests must attempt the operation using:

```text
anonymous role
authenticated learner
authenticated admin
service role
```

where relevant.

The database must enforce the boundary.

---

## 0.5 Treat the browser as hostile

Never rely on:

```text
React hiding something
Next.js not exposing a button
TypeScript types
server-side rendering
application code choosing not to call an RPC
```

as authorization.

Anything reachable through Supabase must be secure when called directly.

---

## 0.6 Authoritative state must be server-controlled

Clients must not directly determine:

* XP amounts
* reward effects
* inventory mutations
* answer correctness
* quiz snapshots
* administrative state
* system-wide notifications
* privileged workflow transitions

The client submits intent.

The authoritative application/database layer determines the resulting state.

---

## 0.7 Completion report required for every ticket

After implementing a ticket, report:

```text
Ticket:
Files changed:
Migration(s):
Architecture change:
Tests added:
Commands run:
Compatibility concerns:
Known follow-ups:
```

Run at minimum:

```bash
npm run typecheck
npm run lint
npm run build
```

Once the testing tickets land, also run the relevant DB/unit/integration/E2E suites.

---

# 1. TARGET ARCHITECTURE

Project Ve should progressively move toward:

```text
┌─────────────────────────────────────────┐
│ Next.js UI / Routes / Server Actions    │
│ Transport + presentation only           │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ Application Use Cases                   │
│                                         │
│ StartQuiz                               │
│ AnswerQuizQuestion                      │
│ RedeemReward                            │
│ CompleteLessonPage                      │
│ PublishCourse                           │
│ GrantAdminXp                            │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ Domain                                  │
│                                         │
│ XP rules                                │
│ eligibility                             │
│ state transitions                       │
│ scoring                                 │
│ reward rules                            │
│ recommendation rules                    │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ Typed Repositories / Supabase Adapters  │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ PostgreSQL                              │
│                                         │
│ RLS                                     │
│ Public use-case RPCs                    │
│ Admin-authorized RPCs                   │
│ Service-only operations                 │
│ Private implementation helpers          │
│ Transactional invariants                │
└─────────────────────────────────────────┘
```

A key architectural distinction:

```text
BAD PUBLIC RPC

increment_profile_xp(user_id, amount)
```

versus:

```text
GOOD PUBLIC USE CASE

answer_quiz_question(attempt_id, question_id, selected_options)
redeem_reward(reward_id)
```

The first exposes an implementation primitive.

The second exposes an authorized business operation.

---

# P0: SECURITY AND ECONOMIC INTEGRITY

These tickets are release blockers for any expansion of XP, rewards, vouchers, perks or other economically meaningful functionality.

---

# VE-SEC-001

## Establish default-deny RPC security

**Priority:** P0

### Problem

Project Ve has a large `SECURITY DEFINER` surface.

The audit identified approximately 114 public functions, with roughly 99 using `SECURITY DEFINER`.

Several implementation helpers and administrative functions are executable by `authenticated` despite lacking appropriate authorization checks.

Some older functions also do not explicitly revoke PostgreSQL's default `PUBLIC` execute privilege.

### Confirmed affected functions

At minimum audit and remediate:

```text
public.increment_profile_xp
public.apply_native_reward_effect

public.admin_reset_ai_course_tree
public.admin_reset_ai_course_media

public.queue_user_notification
public.queue_push_deliveries_for_notification
public.queue_broadcast_notification
public.generate_continue_learning_reminders

public.find_existing_reward_inventory_values
public.admin_reward_assignment_counts
public.admin_perk_prize_assignment_counts

public.refresh_reward_item_inventory_counts
```

Historical definitions include:

```text
supabase/migrations/20260512201000_increment_profile_xp.sql
supabase/migrations/20260518093000_low_xp_perk_bundles.sql
supabase/migrations/20260522110000_ai_learning_workflow.sql
supabase/migrations/20260525235500_remove_automatic_stale_media_state.sql
supabase/migrations/20260524211759_notification_push_delivery_and_events.sql
supabase/migrations/20260524224500_notification_reminders_and_broadcasts.sql
supabase/migrations/20260514103000_inventory_batches.sql
supabase/migrations/20260518223000_perk_prize_inventory_allocations.sql
supabase/migrations/20260513212000_inventory_release_windows.sql
```

### Required architecture

Create an explicit classification for every exposed RPC:

```text
PUBLIC_ANON
PUBLIC_AUTHENTICATED_SELF
ADMIN_AUTHENTICATED
SERVICE_ROLE_ONLY
INTERNAL_HELPER
TRIGGER_ONLY
```

Create:

```text
docs/database-rpc-security.md
```

containing:

```text
function
classification
intended callers
authorization rule
roles with EXECUTE
```

For every function:

1. explicitly revoke inappropriate `PUBLIC`, `anon` and `authenticated` execution;
2. grant only required roles;
3. require authorization inside privileged `SECURITY DEFINER` functions;
4. move implementation helpers to a non-client-facing/private schema where practical.

For admin-callable functions:

```sql
if auth.uid() is null or not public.current_user_is_admin() then
  raise exception 'Admin access required.';
end if;
```

For service-only functions:

```text
PUBLIC: no execute
anon: no execute
authenticated: no execute
service_role: execute
```

### Important

Do not blindly revoke everything and hope the application survives.

Inventory all function callers before changing privileges.

### Acceptance tests

Automated DB tests must prove:

* learner cannot execute `increment_profile_xp`;
* learner cannot execute `apply_native_reward_effect`;
* learner cannot execute either AI reset RPC;
* learner cannot execute inventory admin/count functions;
* learner cannot execute reminder/broadcast operational RPCs;
* admin can execute intended admin RPCs;
* service role can execute intended operational RPCs;
* legitimate learner use-case RPCs still work;
* no unclassified `SECURITY DEFINER` function remains.

Add a test that queries PostgreSQL ACL metadata and fails if a new `SECURITY DEFINER` function is introduced without an approved privilege classification.

---

# VE-QUIZ-001

## Remove quiz answer keys from learner-readable data

**Priority:** P0

### Problem

Published quiz content currently exposes answer information through learner-readable tables.

Affected definitions:

```text
supabase/migrations/20260512170000_product_model.sql
supabase/migrations/20260514152000_learning_catalog_read_policies.sql
```

Affected application code:

```text
lib/supabase-learning.ts
  loadMappedPublishedCourses()

lib/lessons.ts
  getPublicQuiz()
```

Current learner-facing database reads include:

```text
quiz_questions.explanation
quiz_options.is_correct
```

The React/application layer later removes these properties through `getPublicQuiz()`, but a learner can query Supabase directly.

### Required architecture

Answer keys must have a separate authorization boundary.

Preferred model:

```text
quiz_questions
  learner-readable question content

quiz_options
  learner-readable option content

private.quiz_answer_keys
  question_id
  correct_option_ids
  explanation
```

Alternative implementation is acceptable if it provides equivalent database-level isolation.

The learner must not be able to retrieve:

```text
correct option IDs
is_correct
answer explanation
grading rules that disclose the answer
```

before answering.

Admin authoring must still support setting and reviewing the correct answer.

### Application changes

Update:

```text
lib/supabase-learning.ts
lib/lessons.ts
admin quiz authoring code
AI quiz materialization code
quiz grading RPCs
```

so learner course loading no longer requires answer-key data.

### Acceptance tests

As authenticated learner:

```text
SELECT correct answer information
```

must be impossible.

Verify:

* `quiz_options.is_correct` is no longer learner-readable;
* explanations that reveal answers are not learner-readable before grading;
* learner catalog/API payloads contain no answer-key properties;
* admin can still create/edit correct answers;
* grading still identifies correct selections;
* post-answer feedback can return explanation only when product rules permit it.

Add a regression test that recursively inspects the learner quiz payload and fails if:

```text
is_correct
correctOptionIds
answer key
pre-answer explanation
```

is present.

---

# VE-QUIZ-002

## Make quiz attempts server-authoritative and atomic

**Priority:** P0

### Problem

Learners currently have INSERT policies for:

```text
quiz_attempts
quiz_attempt_questions
```

Historical policy:

```text
supabase/migrations/20260512193000_seed_quizzes_and_answer_rpc.sql
```

Application code currently constructs authoritative attempt snapshots in:

```text
lib/supabase-quiz.ts
```

including:

```text
question_snapshot
options_snapshot
xp
```

The database then later trusts `quiz_attempt_questions.xp`.

This means an authenticated caller can potentially create a forged attempt snapshot containing attacker-controlled XP.

### Required architecture

Remove direct learner INSERT access to authoritative quiz attempt tables.

Introduce a transactional use-case RPC:

```text
start_quiz_attempt(p_quiz_id or p_lesson_id)
```

The RPC must:

1. derive `auth.uid()`;
2. verify quiz eligibility;
3. calculate earning/retry mode;
4. calculate daily XP availability;
5. choose questions;
6. obtain XP from canonical quiz configuration;
7. create the attempt;
8. create the attempt-question snapshot;
9. return a sanitized quiz payload.

The caller must never provide:

```text
user_id
question XP
correct options
canonical question configuration
attempt mode without validation
```

The existing answer RPC must validate against server-created attempt data only.

### Database invariants

Learner cannot directly:

```text
INSERT quiz_attempts
INSERT quiz_attempt_questions
UPDATE quiz_attempt_questions.xp
```

Attempt creation and question snapshot creation must occur in one transaction.

If any part fails, no partial attempt remains.

### Acceptance tests

* direct learner INSERT into `quiz_attempts` fails;
* direct learner INSERT into `quiz_attempt_questions` fails;
* caller cannot specify XP;
* caller cannot specify another user;
* caller cannot substitute arbitrary questions;
* failure halfway through attempt creation leaves no partial rows;
* valid quiz start returns sanitized questions;
* duplicate/concurrent attempts respect retry rules;
* concurrent answers cannot bypass the daily XP cap;
* forged HTTP/Supabase requests cannot increase XP beyond canonical quiz values.

---

# VE-XP-001

## Make XP ledger-owned and remove direct XP mutation primitives

**Priority:** P0

### Problem

`increment_profile_xp` permits caller-supplied:

```text
user_id
amount
```

without authorization.

`apply_native_reward_effect` similarly accepts trusted reward-effect data that should never originate from an untrusted caller.

Affected historical files:

```text
supabase/migrations/20260512201000_increment_profile_xp.sql
supabase/migrations/20260518093000_low_xp_perk_bundles.sql
```

Other XP mutation logic exists across:

```text
quiz RPCs
mission rewards
reward redemption
admin XP grants
referrals
perk bundles
```

### Required architecture

Define:

```text
xp_transactions
```

as the canonical financial-style ledger.

`profiles.xp_balance_cached` should be a cache/materialized balance, not an independently trusted source of truth.

Externally callable functions should represent authorized use cases:

```text
answer_quiz_question(...)
complete_mission(...)
redeem_reward(...)
redeem_perk_bundle(...)
admin_grant_user_xp(...)
```

Internal balance posting should be encapsulated in something conceptually equivalent to:

```text
private.post_xp_transaction(...)
```

It must not be executable by client roles.

Each XP transaction should contain enough data for auditability:

```text
user_id
direction
amount
source_type
source_id
idempotency/dedupe key where applicable
metadata
created_at
```

### Requirements

Remove client execution permission from:

```text
increment_profile_xp
apply_native_reward_effect
```

Audit every direct mutation of:

```text
profiles.xp
profiles.xp_balance_cached
```

and route domain XP changes through a canonical posting mechanism.

Do not break the existing administrative XP grant workflow.

### Acceptance tests

* learner cannot call generic XP mutation primitives;
* learner cannot choose XP amount;
* quiz XP produces one ledger transaction;
* duplicate quiz/reward events cannot double-credit;
* redemption debits and inventory mutation are atomic;
* rollback leaves XP and inventory unchanged if redemption fails;
* cached balance equals canonical ledger balance after all tested flows;
* admin grants remain auditable;
* concurrency tests do not permit double spending.

---

# VE-NOTIF-001

## Secure notification creation and broadcasting

**Priority:** P0

### Problem

Current `SECURITY DEFINER` functions include:

```text
queue_user_notification(...)
queue_broadcast_notification(...)
generate_continue_learning_reminders()
```

Affected files:

```text
supabase/migrations/20260524205743_notification_preference_controls.sql
supabase/migrations/20260524211759_notification_push_delivery_and_events.sql
supabase/migrations/20260524224500_notification_reminders_and_broadcasts.sql
```

A normal authenticated user must not be able to send arbitrary notifications to another learner or broadcast to the entire user base.

### Required architecture

Separate notification primitives from notification use cases.

Internal:

```text
private.queue_user_notification(...)
private.queue_push_delivery(...)
```

System/service operation:

```text
generate_continue_learning_reminders()
```

Admin operation, only if the product requires it:

```text
admin_broadcast_notification(...)
```

Domain functions such as reward or mission completion may call internal notification primitives as trusted database code.

### Current caller to preserve

```text
app/api/notifications/dispatch/route.ts
```

currently invokes:

```text
generate_continue_learning_reminders
```

through an admin/service Supabase client.

### Acceptance tests

* learner cannot queue a notification to themselves using arbitrary content;
* learner cannot queue a notification to another user;
* learner cannot broadcast;
* learner cannot manually run global reminder generation;
* service role can run reminder generation;
* valid reward/mission/referral flows still generate notifications;
* admin broadcasting, if retained, explicitly verifies admin role;
* notification deduplication remains functional.

---

# P1: RELIABILITY, TESTABILITY AND MAINTAINABILITY

---

# VE-AUTH-001

## Make fraud and signup controls fail closed

**Priority:** P1

### Problem

Affected:

```text
lib/auth-risk.ts
lib/oauth-signup-proof.ts
app/api/auth/signup/route.ts

supabase/migrations/20260513130000_profile_management.sql
supabase/migrations/20260513120000_risk_events_and_signup_controls.sql
```

Current production-risk fallbacks include:

```text
project-ve-local-risk-salt
project-ve-local-oauth-proof-secret
```

and:

```ts
if (!TURNSTILE_SECRET_KEY) {
  return true;
}
```

The profile trigger also interprets:

```text
raw_user_meta_data.captcha_passed
```

as trusted risk information even though user metadata is not an appropriate authorization boundary.

### Required architecture

Create centralized environment validation.

In production, application startup must fail if required security secrets are missing.

At minimum validate:

```text
TURNSTILE_SECRET_KEY
FRAUD_HASH_SALT
OAuth proof secret if kept separate
Supabase configuration
```

Development-only fallback behavior may exist but must be impossible when:

```text
NODE_ENV=production
```

Do not use client-settable user metadata as proof of successful anti-abuse verification.

Where Supabase Auth CAPTCHA enforcement is part of the architecture:

* pass CAPTCHA through the Auth-supported flow;
* document required Supabase dashboard configuration;
* ensure direct Auth API signup cannot bypass protection.

### Acceptance tests

* production with missing Turnstile secret refuses insecure startup/operation;
* production with missing fraud salt refuses insecure startup/operation;
* development mode remains usable;
* forged `captcha_passed=true` metadata does not confer trust;
* direct signup path cannot bypass the intended CAPTCHA control;
* OAuth proof rejects tampering, expiry and mismatched context.

---

# VE-TEST-001

## Introduce automated test and CI infrastructure

**Priority:** P1, begin during P0 remediation

### Current state

Repository currently contains:

```text
0 automated test/spec files
0 CI workflow files
```

`package.json` currently provides:

```text
build
lint
typecheck
```

only.

### Required architecture

Add:

```text
DB authorization/invariant tests
domain unit tests
API integration tests
critical E2E tests
CI enforcement
```

Recommended tooling:

```text
pgTAP / Supabase database tests
Vitest
Playwright
GitHub Actions
```

Exact tools may vary if a better fit is justified.

### Required scripts

Provide consistent commands such as:

```bash
npm test
npm run test:db
npm run test:integration
npm run test:e2e
npm run ci
```

### Minimum DB security matrix

Test:

```text
anon
learner
admin
service_role
```

against sensitive tables and RPCs.

### Minimum E2E flows

1. signup/login;
2. course → lesson → page completion;
3. quiz start → answer → XP;
4. reward redemption;
5. admin content workflow.

### CI must block merge on

```text
dependency install
database reset/migration validation
DB tests
typecheck
lint
unit/integration tests
build
critical E2E tests
```

---

# VE-PROGRESS-001

## Establish one canonical lesson progress model

**Priority:** P1

### Problem

Affected:

```text
lib/progress.ts
```

Current state stores page completion in both:

```text
lesson_page_completions
lesson_progress.completed_pages
```

`markLessonPageCompletedInSupabase()` performs:

```text
insert page completion
read lesson_progress
merge array in JavaScript
write lesson_progress
```

This read-modify-write sequence is vulnerable to concurrent lost updates.

### Required architecture

Make:

```text
lesson_page_completions
```

the canonical record of page completion.

If `lesson_progress` remains, treat it as a transactional summary/cache.

Introduce a database use case:

```text
complete_lesson_page(p_lesson_id, p_page_id)
```

which atomically:

1. validates the user and page;
2. inserts/upserts completion;
3. determines lesson completion;
4. updates any retained summary;
5. returns current progress.

Remove client-side synchronization of duplicate representations.

### Acceptance tests

* duplicate completion is idempotent;
* simultaneous completion of two pages records both;
* no completion disappears due to race conditions;
* lesson completion occurs only when every required page is complete;
* old users retain progress after migration;
* course progress calculations remain correct.

---

# VE-AI-001

## Convert AI generation into durable jobs

**Priority:** P1

### Problem

Main affected file:

```text
app/admin/courses/ai-actions.ts
```

Important functions/areas:

```text
insertGeneratedLessonTree()
ai_generation_jobs writes
generateAiCourseDraftFromModel()
media generation loops
AI reset functions
```

Current server actions:

1. create an `ai_generation_jobs` row with `status=running`;
2. call the model directly;
3. perform multiple database writes sequentially.

The "job" is therefore mostly execution logging rather than a durable job processor.

Course materialization writes independently to:

```text
lessons
lesson_pages
lesson_content_blocks
quizzes
quiz_questions
quiz_options
media assets
```

without one atomic transaction.

### Required architecture

Use `ai_generation_jobs` as an actual durable queue.

State model:

```text
queued
running
completed
failed
```

Recommended additional state:

```text
attempt_count
locked_at
locked_by
heartbeat_at
available_at
failure_code
failure_detail
idempotency_key
```

Admin action should:

```text
validate request
create queued job
return job ID
```

A durable worker should:

```text
claim job atomically
generate content
validate output
materialize transactionally
mark completed
```

Worker may be implemented using the existing deployment infrastructure and cron/service endpoints. An external queue is not required unless justified.

Use an atomic claim strategy such as:

```text
FOR UPDATE SKIP LOCKED
```

or equivalent.

### Materialization

Create a transactional database command for inserting the generated course tree.

Do not write seven tables independently from TypeScript.

### Media generation

Use bounded concurrency.

Do not create an unbounded sequential request whose durability depends on one HTTP execution remaining alive.

### Acceptance tests

* admin generation request returns a queued job;
* killing worker mid-job does not permanently strand the job;
* stale leases can be recovered;
* two workers cannot execute the same job simultaneously;
* retry does not duplicate course tree records;
* invalid model output produces no partial course;
* database failure halfway through materialization rolls back everything;
* media generation retries individual failures safely;
* reset actions remain admin-only.

### Current implementation status

Initial durable course-text worker pass is implemented:

* `ai_generation_jobs` now has durable queue metadata:
  `attempt_count`, `locked_at`, `locked_by`, `heartbeat_at`, `available_at`,
  `failure_code`, `failure_detail`, `idempotency_key`, `started_at`, and
  `completed_at`;
* job status now uses `queued`, `running`, `completed`, and `failed`;
* `public.claim_ai_generation_job(...)` claims one queued or stale job with
  `FOR UPDATE SKIP LOCKED`;
* `public.materialize_ai_course_text_job(...)` transactionally inserts generated
  course text rows across courses, lessons, pages, blocks, quizzes, questions,
  options, and media seed rows, and marks the job completed in the same database
  transaction;
* `public.fail_ai_generation_job(...)` marks failed jobs or requeues retryable
  failures;
* worker RPCs are `SERVICE_ROLE_ONLY`, explicitly revoked from `anon` and
  `authenticated`, and classified in `private.rpc_security_classifications`;
* `generateAiCourseDraft(...)` and `extendCourseWithAiLessons(...)` now validate
  input, create queued `course_text` jobs, and redirect with the job id instead
  of calling the model and materializing rows inside the admin request;
* `POST /api/admin/ai/jobs/process` processes queued jobs through a
  service-role worker, authorized by `AI_GENERATION_WORKER_SECRET` or
  `CRON_SECRET`.
* `GET /api/admin/ai/jobs/process` uses the same worker path for Vercel Cron,
  and `vercel.json` schedules it daily after notification dispatch.
* `reviseCourseTextWithAi(...)` now validates the admin request, enqueues a
  `revise_course` job, and returns immediately instead of calling the model and
  replacing the course tree inside the request;
* `public.replace_ai_course_text_job(...)` transactionally replaces an
  unpublished AI course's generated text tree and media seed rows, then marks
  the running job completed through the existing materialization primitive.
* Course media, lesson media, and individual media-slot generation now enqueue
  `media_assets` jobs and run through the worker instead of generating images
  inside admin server actions;
* media worker execution selects targets deterministically, skips unsupported
  or duplicate targets before generation, and runs image calls with bounded
  concurrency.

Remaining VE-AI-001 work:

* deploy the cron route changes and confirm Vercel sends
  `Authorization: Bearer $CRON_SECRET` to `/api/admin/ai/jobs/process`;
* add worker-level tests for stale lease recovery, simultaneous claim exclusion,
  retry behavior, and no-partial-materialization failure cases.

---

# VE-DATA-001

## Generate and enforce Supabase database types

**Priority:** P1

### Problem

Affected globally, particularly:

```text
lib/supabase.ts
lib/supabase-server.ts
lib/supabase-learning.ts
lib/supabase-rewards.ts
lib/supabase-recommendations.ts
lib/ads.ts
lib/values-assessment.ts
lib/admin.ts
app/admin/**
```

The repository initially contained roughly 132:

```ts
.returns<SomeHandWrittenType>()
```

calls.

Supabase clients are not parameterized with a generated `Database` contract.

Current cleanup status:

* `types/database.ts` is generated from the linked `public` schema and committed.
* Browser, server, plain, and admin Supabase client factories are parameterized with `Database`.
* `db:types`, `db:types:check`, and `db:types:check:ci` scripts are available.
* Runtime reward-redemption schema-version fallback has been removed.
* Handwritten Supabase result overrides have been removed across `lib`, `app`, and `components`: no `.returns<T>()`, `maybeSingle<T>()`, or `single<T>()` call sites remain.
* Converted modules include learner catalog/rewards/recommendations/notifications/value-profile/personalized-recommendations/XP settings, ad decision/reporting paths, admin read models, course admin workflows, and small notification dispatch/push prompt call sites.
* CI wiring for linked Supabase type drift detection is in place through
  `.github/workflows/ci.yml`.
* Repository secret configuration required from the project owner:
  `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF`.

### Required architecture

Generate:

```text
types/database.ts
```

from the actual Supabase schema.

Use:

```ts
createClient<Database>()
createBrowserClient<Database>()
createServerClient<Database>()
```

as appropriate.

Add a script such as:

```text
db:types
```

for regeneration.

Use generated:

```text
Tables
Insert
Update
Enums
Functions
```

rather than manually reproducing database row definitions.

### Compatibility cleanup

Affected legacy branch:

```text
app/api/rewards/[id]/redeem/route.ts
```

currently retries a query based on an error message if `distribution_mode` does not exist.

Remove runtime schema-version inference once migration guarantees are established.

### Acceptance tests

* generated DB type is committed or reproducibly generated;
* CI detects schema/type drift;
* Supabase clients use `Database`;
* critical modules no longer use handwritten row contracts;
* ideally no `.returns<T>()` remains where generated inference is sufficient;
* reward redemption does not infer schema version from database error strings.

---

# VE-API-001

## Introduce runtime request validation

**Priority:** P1

### Problem

Many external boundaries currently use:

```ts
const body = (await request.json()) as SomeType;
```

and scattered manual parsing helpers.

TypeScript does not validate HTTP input.

### Required architecture

Introduce a runtime validation library such as:

```text
Zod
Valibot
```

Use schemas for:

```text
API mutation requests
server actions
admin commands
AI generation requests
quiz submissions
reward mutations
notification preference updates
signup inputs
```

Pattern:

```ts
const InputSchema = z.object({
  ...
});

type Input = z.infer<typeof InputSchema>;
```

At the transport boundary:

```text
parse
validate
normalize
call application use case
```

### Current implementation status

JSON API mutation routes now use a shared runtime request validator:

```text
lib/request-validation.ts
```

Covered API boundaries:

```text
app/api/admin/learning/blocks/route.ts
app/api/admin/learning/builder/route.ts
app/api/admin/learning/reorder/route.ts
app/api/ads/event/route.ts
app/api/ads/house-event/route.ts
app/api/auth/oauth-signup/prepare/route.ts
app/api/auth/signup/route.ts
app/api/lesson-progress/route.ts
app/api/missions/[id]/proof/route.ts
app/api/notifications/push-subscription/route.ts
app/api/quizzes/[id]/answer/route.ts
app/api/quizzes/[id]/start/route.ts
app/api/quizzes/[id]/submit/route.ts
app/api/redemptions/[id]/claim/route.ts
app/api/referrals/accept/route.ts
app/api/referrals/visit/route.ts
```

Implemented behavior:

* malformed JSON returns structured `400` responses;
* non-object JSON request bodies are rejected;
* required string/object/array fields are validated before domain calls;
* event/proof/reorder enum values are rejected at the boundary;
* integer/range validation is applied to admin learning builder numeric fields before RPC execution;
* unsafe `request.json()` casts have been removed from `app/api`;
* direct admin course catalog FormData actions now parse through
  `lib/admin-course-validation.ts` before RPC execution, covering course,
  lesson, lesson page/block, quiz settings, and quiz question mutations;
* large admin FormData mutation surfaces now parse through explicit validators
  before server-action domain/RPC execution:
  `lib/admin-ad-validation.ts`, `lib/admin-ai-validation.ts`,
  `lib/admin-inventory-validation.ts`, and
  `lib/admin-reward-validation.ts`;
* reward thumbnail validation now propagates nested URL issues into the parent
  reward/perk prize mutation result instead of dropping them;
* admin ad campaign/flight/billing and reward/inventory availability windows
  reject inverted date ranges before domain calls;
* unit coverage exists in `tests/unit/request-validation.test.mjs`.
* FormData unit coverage exists in `tests/unit/admin-course-validation.test.mjs`
  for required fields, enum rejection, numeric ranges, URL normalization, quiz
  option rules, and canonical domain payloads.
* Follow-up FormData unit coverage exists in:
  `tests/unit/admin-ad-validation.test.mjs`,
  `tests/unit/admin-ai-validation.test.mjs`,
  `tests/unit/admin-inventory-validation.test.mjs`, and
  `tests/unit/admin-reward-validation.test.mjs`.

Remaining optional architecture follow-up:

* decide whether to adopt a package validator such as Zod/Valibot once dependency changes are allowed, or keep the local zero-dependency validator.

### Acceptance tests

* malformed JSON returns 400;
* missing required fields return structured validation errors;
* unexpected enum values are rejected;
* numbers/ranges are validated before domain execution;
* mutation handlers no longer use unsafe request-body casts;
* domain code receives validated values.

---

# VE-OBS-001

## Replace silent failure with explicit error handling and observability

**Priority:** P1

### Problem

Examples:

```text
lib/supabase-learning.ts
app/dashboard/page.tsx
app/notifications/page.tsx
app/lessons/[id]/page.tsx
app/courses/[id]/page.tsx
app/xp-store/page.tsx
```

Current patterns include:

```ts
catch {
  return [];
}
```

and:

```ts
.catch(() => null)
.catch(() => 0)
.catch(() => [])
```

This converts infrastructure failures into valid empty application states.

Also:

```text
app/dashboard/page.tsx
```

currently contains:

```ts
profile?.xp_balance_cached ?? 45232
```

which can show fake XP in a configured live environment.

### Required architecture

Introduce an application error taxonomy, for example:

```text
ValidationError
AuthenticationError
AuthorizationError
NotFoundError
ConflictError
DependencyUnavailableError
InvariantViolationError
```

Introduce structured logging:

```text
error type
operation
request/job context
user identifier where appropriate
resource identifier
underlying error
```

Optional UI sections may degrade gracefully, but the failure must still be observable.

Explicitly distinguish:

```text
valid empty result
dependency failed
resource not found
unauthorized
```

### Current implementation status

Initial observability pass is implemented:

```text
lib/app-errors.ts
tests/unit/app-errors.test.mjs
```

Implemented behavior:

* application error taxonomy now includes validation, dependency-unavailable, and invariant-violation errors;
* structured server logs include error type/code/status, operation, user/resource context where supplied, metadata, and underlying error details;
* structured logs intentionally route to JSON `console.error`; deployed runtime log capture is the sink for now, with no custom external endpoint added in application code;
* `lib/supabase-learning.ts` no longer converts Supabase failures into empty catalogs or `null` detail results; valid empty published-content results still return empty arrays/null;
* dashboard live XP fallback now uses `0` when a configured user profile is missing, and logs the missing profile invariant;
* optional dashboard, notifications, profile, XP store, missions, course, and lesson modules degrade with explicit logged fallbacks rather than silent `.catch(() => [])` / `.catch(() => 0)` / `.catch(() => null)`;
* notifications page now distinguishes a real empty inbox from a notification-load failure with a safe client message;
* learning-dependent API routes return safe `503` messages instead of leaking underlying dependency details.
* admin course planner hidden JSON FormData parsing now fails closed as validation errors instead of silently falling back;
* invalid stored AI course plans and cleanup rollback failures under `app/admin/courses/*` are logged with operation and plan/course/job context.
* profile loading now treats Supabase/auth query errors as dependency failures instead of collapsing them into a missing-profile state;
* dashboard missing-profile XP fallback and notification page load-state decisions are covered by unit tests, including the "zero XP, logged invariant" and "load failed, not empty inbox" cases.

### Acceptance tests

* database outage is not interpreted as empty catalog;
* failed notification count query is logged/observable;
* live-mode missing profile does not display 45,232 XP;
* optional dashboard modules may degrade without crashing the whole page;
* errors include operation/context information;
* sensitive information is not leaked into client error messages.

---

# VE-NOTIF-002

## Restrict learner notification mutations

**Priority:** P1

### Problem

Historical policy:

```text
supabase/migrations/20260524203617_user_notifications.sql
```

allows users to UPDATE any notification row belonging to themselves.

The intended learner action appears primarily to be marking notifications read.

### Required architecture

Remove generic learner UPDATE capability.

Expose a scoped command:

```text
mark_notification_read(notification_id)
```

and, if required:

```text
mark_all_notifications_read()
```

The command determines:

```text
user_id = auth.uid()
```

and only changes permitted fields such as:

```text
read_at
```

### Acceptance tests

Learner cannot alter:

```text
title
body
category
event_type
cta
notification data
user_id
```

Learner can mark their own notification read.

Learner cannot mark another user's notification read.

---

# VE-ARCH-001

## Split god modules into vertical feature boundaries

**Priority:** P1, after P0 stabilization

### Current hotspots

Approximate sizes from the audit:

```text
app/admin/courses/ai-actions.ts             4217 lines
lib/admin.ts                                2401
app/admin/courses/[id]/page.tsx             1610
components/admin/LessonPageBuilder.tsx      1556
lib/demo-progress-store.ts                  1292
app/admin/courses/planner-actions.ts        1131
components/admin/PerkPrizeManager.tsx       1043
components/rewards/XPStore.tsx              1038
```

### Problem

Large modules currently mix:

```text
transport
database queries
domain rules
validation
mapping
workflow orchestration
UI state
```

### Required architecture

Progressively introduce vertical features:

```text
features/
  learning/
    domain/
    application/
    data/
    admin/
    learner/

  quizzes/
  rewards/
  missions/
  notifications/
  referrals/
  assessment/
  recommendations/
  ads/
```

Server actions/routes should become thin.

Example:

```ts
export async function updateCourseAction(rawInput: unknown) {
  const context = await requireAdmin();
  const command = UpdateCourseSchema.parse(rawInput);

  return updateCourse(context, command);
}
```

Business rules must live outside React components and route handlers.

### Important

Do not mechanically split files merely to reduce line count.

Move code according to responsibility and ownership.

### Acceptance tests

* business logic can be unit tested without rendering React;
* database access is isolated behind feature-specific adapters/use cases;
* UI components no longer contain substantial persistence logic;
* `lib/admin.ts` is decomposed into feature-specific modules;
* AI orchestration no longer lives in a single 4,000-line action file;
* behavior remains unchanged.

---

# VE-DB-001

## Remove stale `supabase/schema.sql` ambiguity

**Priority:** P1

### Problem

Audit found approximately:

```text
74 tables defined by migration history
24 tables represented in supabase/schema.sql
```

`supabase/schema.sql` is therefore materially stale.

README says:

```text
supabase/migrations
```

is the source of truth.

### Required architecture

There must be one clear schema authority.

Preferred approach:

1. keep migrations as deployment history/source;
2. remove stale hand-maintained `supabase/schema.sql`;
3. provide reproducible local database reset;
4. generate database TypeScript types from the resulting schema;
5. optionally generate a schema dump as a build artifact, not a manually edited source file.

Document the workflow in:

```text
docs/database.md
```

### Acceptance tests

A clean checkout can:

```text
start/reset local Supabase
apply all migrations
generate DB types
run DB tests
```

without consulting `supabase/schema.sql`.

### Current implementation status

Implemented:

* removed the stale hand-maintained `supabase/schema.sql`;
* added `supabase/config.toml` so local Supabase has a committed project config;
* added `supabase/roles.sql` so local reset mirrors the linked project's
  Supabase role/default privilege posture before migrations replay;
* added `supabase/seed.sql` for the permanent pgTAP learner/admin users used by
  local DB tests;
* added local database scripts for start, reset, local type generation, local
  type checking, and one-command local verification;
* added normalized DB type checking so linked and direct local DB generation
  compare schema contracts instead of generator metadata;
* documented the database workflow in `docs/database.md`;
* documented the local/linked DB test split in `docs/testing.md`;
* updated README Supabase notes to make migrations the only checked-in schema
  authority.
* corrected two historical migration syntax errors that prevented clean local
  migration replay. This was a replay-only source correction for invalid SQL
  already applied on the linked project, not a pattern for implementing new
  schema changes in historical migrations.

Validation:

```text
npm run db:verify:local
```

This command intentionally resets the local Supabase database from migrations,
checks generated public-schema TypeScript types, and runs local pgTAP tests. It
does not use `supabase/schema.sql`.

Latest result:

```text
All tests successful.
Files=6, Tests=107
Result: PASS
```

---

# P2: SOPHISTICATION AND LONG-TERM CLEANUP

---

# VE-DEMO-001

## Create an explicit demo/live architecture

**Priority:** P2

### Problem

Affected areas include:

```text
lib/demo-progress-store.ts
lib/supabase-learning.ts
app/dashboard/page.tsx
reward/mission/progress helpers
```

Demo fallback logic is distributed throughout live application code.

Current behaviors vary between:

```text
return seed data
return empty data
return demo snapshot
return magic value
```

### Required architecture

Introduce explicit application mode:

```text
APP_MODE=demo
APP_MODE=live
```

Define repository contracts such as:

```ts
interface LearningRepository {}
interface RewardRepository {}
interface ProgressRepository {}
interface MissionRepository {}
```

Implement:

```text
SupabaseLearningRepository
DemoLearningRepository
```

etc.

Application/domain code should depend on interfaces, not scattered:

```ts
if (!supabase) ...
```

branches.

### Acceptance tests

* live mode never silently serves demo XP;
* live mode never silently serves demo progress;
* demo mode works without Supabase;
* repository contract tests run against demo and live adapters;
* switching mode occurs through centralized configuration.

---

# VE-REC-001

## Upgrade personalization scoring to use actual assessment vectors

**Priority:** P2

### Problem

Affected:

```text
lib/personalized-recommendations.ts
```

The application loads:

```text
user_value_dimension_scores.score
user_value_dimension_scores.confidence
```

but current ranking primarily scores:

```text
primary dimension +50
secondary dimension +35
readiness match +20
untargeted level +10
tag weight ×10
```

The richer score/confidence data is therefore not materially driving recommendations.

### Required architecture

Keep recommendations deterministic and explainable.

Do not replace this with an LLM ranking system.

Introduce a versioned scoring policy using components such as:

```text
dimension fit
assessment confidence
readiness fit
content weight
progression relevance
completion status
novelty/recent exposure
editorial priority
```

A reasonable dimension component:

```text
Σ(
  normalized user dimension score
  × assessment confidence
  × content dimension weight
)
```

Store or return score components so recommendations can be explained and measured.

Example:

```json
{
  "policyVersion": "v2",
  "dimensionFit": 43,
  "readinessFit": 20,
  "novelty": 10,
  "editorial": 5,
  "total": 78
}
```

### Acceptance tests

* changing dimension score changes ranking predictably;
* low-confidence scores influence ranking less than high-confidence scores;
* readiness mismatch behaves according to policy;
* completed content is deprioritized/excluded appropriately;
* algorithm is deterministic;
* recommendation reason corresponds to actual scoring;
* scoring version is recorded.

---

# VE-HARD-001

## Security and maintenance hardening sweep

**Priority:** P2

This ticket contains several smaller audit findings that do not justify separate architectural projects.

---

## A. Restrict remote image hosts

Affected:

```text
next.config.ts
```

Current:

```text
hostname: "**"
```

Inventory actual image sources and replace wildcard HTTPS access with approved host patterns.

### Acceptance

No unrestricted remote image hostname wildcard remains.

---

## B. Simplify auth session middleware coverage

Affected:

```text
middleware.ts
```

Current `shouldRefreshAuthSession()` contains an expanding manual route list.

Routes including newer product surfaces can be omitted accidentally.

Prefer a strategy where matched dynamic routes receive consistent session refresh unless explicitly exempted, or centralize route classification.

### Acceptance

Adding a new authenticated route does not require remembering a second unrelated auth-refresh list.

---

## C. Remove dead API contracts

Affected:

```text
app/api/quizzes/[id]/submit/route.ts
app/api/missions/[id]/claim/route.ts
```

Current quiz submission route pretends to process a quiz but marks every answer incorrect and instructs callers to use another endpoint.

Mission claim route exists only to explain that missions auto-award.

Remove dead APIs or return an explicit deprecation status during a temporary compatibility period.

### Acceptance

There is one canonical supported API for each operation.

---

## D. Remove runtime schema compatibility probing

Affected:

```text
app/api/rewards/[id]/redeem/route.ts
```

Remove logic that retries without `distribution_mode` when database error text implies the column does not exist.

Schema version must be guaranteed through migrations/deployment.

---

## E. Reuse Supabase admin auth context

Affected:

```text
lib/admin.ts
requireAdmin()
```

Current implementation creates a Supabase client and separately calls:

```text
getCurrentUserProfile()
```

without passing the already-created client.

Pass the existing client.

Avoid duplicate authentication/database setup.

---

## F. Fix repository documentation links

Affected:

```text
README.md
```

README currently contains absolute local paths such as:

```text
/Users/scoteritemu/Nu-Project-VE/...
```

Replace them with repository-relative links.

---

# 2. IMPLEMENTATION SEQUENCE

Codex should execute in this order.

## Current status

Phase 0A and Phase 0B P0 remediation are complete and validated by the linked pgTAP gate:

```text
notification_security.sql .. ok
p0_release_gate.sql ........ ok
quiz_security.sql .......... ok
rpc_security.sql ........... ok
xp_ledger_security.sql ..... ok
All tests successful.
Files=5, Tests=89
Result: PASS
```

Phase 1A is complete and validated by the linked pgTAP gate:

* `VE-TEST-001`: app CI, Node unit-test scaffolding, and testing command documentation added; pgTAP remains the linked database security gate.
* `VE-AUTH-001`: production security-secret checks, metadata-trust hardening, and Supabase CAPTCHA configuration notes added.
* `VE-NOTIF-002`: scoped notification mark-read RPCs added; generic learner notification updates removed.

```text
notification_security.sql .. ok
p0_release_gate.sql ........ ok
quiz_security.sql .......... ok
rpc_security.sql ........... ok
xp_ledger_security.sql ..... ok
All tests successful.
Files=5, Tests=96
Result: PASS
```

Continue with Phase 1B.

Phase 1B status:

* `VE-PROGRESS-001`: complete and validated. Atomic `complete_lesson_page(...)` RPC, app callsite update, and progress pgTAP coverage are in place.
* `VE-DATA-001`: database type contract generated from the linked public schema, Supabase client factories parameterized with `Database`, `db:types`/`db:types:check`/`db:types:check:ci` scripts added, reward redemption schema-version fallback removed, handwritten Supabase result overrides removed across `lib`, `app`, and `components`, and GitHub Actions type-drift wiring added. Repository owner must configure `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` secrets for the CI job to enforce linked drift.
* `VE-API-001`: JSON API mutation routes, direct admin course catalog FormData actions, reward/inventory/ads FormData actions, and AI generation/planner FormData actions use explicit runtime validation before domain/RPC execution. Remaining optional architecture decision: adopt Zod/Valibot later, or keep the local zero-dependency validators.
* `VE-OBS-001`: explicit application error taxonomy, structured server logging, logged optional fallbacks, profile-load dependency failure handling, notification load-failure UI state, and unit coverage for missing-profile XP and notification failure states are in place.

```text
notification_security.sql .. ok
p0_release_gate.sql ........ ok
progress_security.sql ...... ok
quiz_security.sql .......... ok
rpc_security.sql ........... ok
xp_ledger_security.sql ..... ok
All tests successful.
Files=6, Tests=107
Result: PASS
```

## Phase 0A: Stop direct privilege escalation

```text
VE-SEC-001
VE-NOTIF-001
VE-XP-001
```

Goal:

```text
Authenticated learner ≠ trusted application code
```

---

## Phase 0B: Repair quiz trust model

```text
VE-QUIZ-001
VE-QUIZ-002
```

Goal:

```text
Learner cannot know answers or manufacture rewarded attempts
```

---

## Phase 1A: Build safety rails

```text
VE-TEST-001
VE-AUTH-001
VE-NOTIF-002
```

Goal:

Security boundaries become continuously enforceable.

---

## Phase 1B: Correct authoritative state

```text
VE-PROGRESS-001
VE-DATA-001
VE-API-001
VE-OBS-001
VE-DB-001
```

Goal:

One source of truth, validated inputs, typed persistence and observable failure.

---

## Phase 1C: Refactor major workflows

```text
VE-AI-001
VE-ARCH-001
```

Goal:

Durable workflows and explicit feature boundaries.

---

## Phase 2: Product and engineering sophistication

```text
VE-DEMO-001
VE-REC-001
VE-HARD-001
```

---

# 3. P0 RELEASE GATE

Do not consider the P0 remediation complete until all of these statements are true.

### RPC security

```text
Every SECURITY DEFINER function has an explicit classification.
Every client-executable privileged RPC verifies its caller.
Internal helpers are not client executable.
```

### XP

```text
A learner cannot choose an XP amount.
A learner cannot directly mutate XP balance.
Every XP change is attributable to a legitimate domain event.
```

### Quizzes

```text
A learner cannot read answer keys before answering.
A learner cannot create authoritative attempt snapshots.
A learner cannot determine question XP.
A learner cannot exceed canonical reward limits through forged calls.
```

### Notifications

```text
A learner cannot create arbitrary notifications.
A learner cannot broadcast.
A learner cannot run operational notification jobs.
```

### Tests

There must be automated regression coverage demonstrating each of the above with a learner session/JWT.

---

# 4. DATABASE SECURITY PRINCIPLES GOING FORWARD

Apply these rules to all new database work.

## Rule 1

Prefer:

```text
public business use-case RPC
```

over:

```text
public implementation helper RPC
```

---

## Rule 2

Every `SECURITY DEFINER` function must explicitly answer:

```text
Who may call this?
How is that checked?
Why does it need SECURITY DEFINER?
Which roles have EXECUTE?
```

---

## Rule 3

For every new privileged function explicitly issue appropriate:

```sql
REVOKE EXECUTE ... FROM PUBLIC;
REVOKE EXECUTE ... FROM anon;
REVOKE EXECUTE ... FROM authenticated;
```

before granting intended access.

Do not depend on implicit privilege defaults.

---

## Rule 4

Never accept authoritative values from the caller when the server can derive them.

Examples:

Bad:

```text
award_xp(user_id, 500)
```

Good:

```text
complete_quiz_question(attempt_id, answer)
```

---

## Rule 5

RLS is necessary but not sufficient.

Review:

```text
table privileges
column sensitivity
RPC privileges
SECURITY DEFINER behavior
views
service-role paths
```

together.

---

# 5. ENGINEERING DEFINITION OF DONE

A remediation ticket is complete only when:

* implementation is forward-migration safe;
* existing legitimate product behavior still works;
* authorization is enforced below the UI layer;
* tests reproduce the old failure/attack and prove it no longer works;
* typecheck passes;
* lint passes;
* build passes;
* relevant integration tests pass;
* no new silent catch/fallback behavior has been introduced;
* documentation is updated where architecture changed.

Do not mark tickets complete based solely on code inspection.

---

# 6. WHAT NOT TO DO

Do not:

* rewrite Project Ve from scratch;
* modify historical migrations to make the repository look cleaner;
* solve database authorization solely in Next.js;
* replace deterministic recommendation logic with an LLM;
* move everything into server actions and assume that makes it secure;
* introduce repository abstractions around every trivial query;
* split giant files into arbitrary smaller files without establishing ownership boundaries;
* silently preserve legacy schemas forever;
* keep magic demo values in live application paths;
* add generic utility RPCs that mutate XP, inventory or privileged state.

---

# 7. SUCCESS STATE

When this remediation is complete, Project Ve should have the following properties:

```text
The database distrusts the browser.

XP is ledger-backed and attributable.

Quiz rewards cannot be forged.

Quiz answers cannot be inspected before submission.

Privileged RPCs have explicit caller contracts.

Notifications cannot be abused as a broadcast channel.

Security controls fail closed.

Concurrent state changes are transactional.

Database types are generated.

External input is runtime validated.

Failures are observable instead of silently becoming empty data.

AI generation survives process interruption.

Progress has one canonical source of truth.

Demo and production behavior are explicitly separated.

Recommendation scoring uses the data Project Ve already collects.

Large modules are organized around domain ownership rather than accumulated history.

Critical invariants are continuously tested in CI.
```

That is the target.

Do not optimize for fewer lines of code.

Optimize for a system where an engineer can answer:

> "Who is allowed to change this state, through which use case, under which invariant, and what automated test proves it?"

without reading half the repository.
