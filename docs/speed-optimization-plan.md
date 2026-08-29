# Speed Optimization Plan

## Objective

Improve perceived and server-side performance across the public app and admin CMS without reducing personalization, rewards, mission, or direct ads functionality.

## Baseline Findings

- Middleware currently refreshes Supabase auth on nearly every non-static request.
- Public pages rely heavily on dynamic server rendering.
- Dashboard data loading is mostly sequential and combines critical and non-critical work.
- Learning detail pages overfetch by loading the full published catalog to render a single course, lesson, or quiz.
- Mission summary reads perform per-mission progress and award checks, and may write/sync during page reads.
- Ads decisioning is on the render path and adds latency, but it is not the original or only cause of app slowness.
- Public images mostly use raw `img`, which hurts perceived speed and LCP.

## Phase 1 — Instrumentation and Safety

- Add lightweight server timing utilities for development/staging.
- Capture route loader durations around auth, catalog, progress, missions, rewards, recommendations, and ads.
- Keep production logging low-noise and controlled by env flag.

## Phase 2 — Remove Global Request Tax

- Avoid an expanding manual route list for middleware auth refresh.
- Refresh auth consistently on matched dynamic routes while explicitly excluding
  static assets, Next image assets, and common image files.
- Keep the device cookie used by ads/risk protection available on relevant routes.

## Phase 3 — Targeted Learning Loaders

- Add targeted course, lesson, and quiz loaders that query only required rows.
- Stop `getLearningCourse()`, `getLearningLesson()`, and `getLearningQuiz()` from loading the full catalog.
- Preserve explicit `APP_MODE=demo` behavior through demo repositories; missing
  Supabase configuration in live mode must not serve seed/demo learning content.

## Phase 4 — Public Route Waterfall Reduction

- Parallelize independent dashboard reads after auth/assessment gating.
- Parallelize course and lesson page ad-prep work where safe.
- Keep first paint focused on primary learning/reward content.
- Move or defer non-critical data when practical.

## Phase 5 — Mission and Rewards Read Optimization

- Avoid write/sync work in read-only render paths.
- Add a read-only mission summary mode for dashboard and mission list rendering.
- Keep explicit sync/award behavior in claim/proof/action flows.
- Avoid duplicate reward reads where SSR already has data.

## Phase 6 — Ads Render-Path Optimization

- Keep fallback behavior intact.
- Avoid unnecessary paid decision work when a fallback can be returned quickly.
- Cache or memoize placement fallback metadata per request where possible.
- Keep ad decision timeout bounded and fail soft.

## Phase 7 — Admin/CMS Performance

- Keep ads admin pages route-scoped with route-specific data loaders.
- Add pagination/filtering before admin event tables grow large.
- Keep destructive jobs explicit and separate from page render.

## Phase 8 — Frontend Perceived Speed

- Replace high-impact public `img` usage with optimized image handling where dimensions are known.
- Prioritize dashboard, course cards, lesson hero images, reward thumbnails, and ad images.

## Completion Criteria

- Middleware auth refresh uses one explicit matcher and avoids static asset
  requests without relying on a growing protected-route allowlist.
- Single course/lesson/quiz pages no longer load the full learning catalog.
- Dashboard has fewer sequential await waterfalls.
- Mission list/dashboard rendering avoids award-sync writes.
- Ads fallback remains controlled by CMS and visible when enabled and paid inventory is unavailable.
- `npm run typecheck` and `npm run build` pass.
- Final audit maps implementation back to each phase and lists any remaining intentional follow-ups.

## Implementation Audit

### Completed

- Added `PERF_LOGS=1` server timing support for high-impact dashboard loaders.
- Replaced the expanding middleware auth-route list with one explicit matcher
  that refreshes auth on matched dynamic routes and excludes static assets.
- Added targeted published course, lesson, and quiz loaders so detail pages no longer load the full catalog.
- Batched dashboard reads into primary and secondary parallel groups.
- Reused an existing Supabase server client in hot routes to avoid duplicate client/cookie setup.
- Made mission summaries read-only by default and parallelized per-mission progress/award reads.
- Server-rendered the initial XP Store snapshot to avoid waiting for the client fetch before showing rewards.
- Started paid ad decisioning and fallback lookup in the same timeout window instead of serializing fallback before paid decisioning.
- Converted high-impact public images to `next/image`.
- Confirmed `npm run typecheck` and `npm run build` pass.
- Ran local production route timing against `next start` on representative routes.
- Closed a measured `/courses` gap by adding a cached public course-summary loader and skipping auth/profile work when no Supabase auth cookie exists.

### Local Production Timing

Measured from a local production server with a warmed Next cache. These timings validate server response time only; browser Lighthouse/Web Vitals should still be captured in staging.

| Route | Status | Avg total | P95 sample |
| --- | ---: | ---: | ---: |
| `/` | 200 | 5.0ms | 5.5ms |
| `/courses` | 200 | 5.4ms | 5.9ms |
| `/dashboard` | 307 | 5.3ms | 5.8ms |
| `/missions` | 200 | 110.8ms | 112.6ms |
| `/xp-store` | 307 | 7.9ms | 12.2ms |
| `/advertise` | 200 | 1.8ms | 2.9ms |

The `/dashboard` and `/xp-store` rows above are signed-out redirects. They do not
measure the authenticated server-render path and must not be used as evidence
that either learner surface is fast.

## 2026-08-29 Authenticated Performance Audit

### Method

The audit added opt-in `PERF_LOGS=1` timers at the network-wave boundaries for:

- middleware auth;
- page auth and profile resolution;
- organisation learner workspace resolution;
- mission catalogue, progress, award-count and current-award reads;
- the existing dashboard catalogue, primary batch and secondary batch.

Measurements came from a local production build against the local Supabase
stack, using existing seeded Playwright journeys:

```bash
DEBUG=pw:webserver PERF_LOGS=1 npm run test:e2e -- tests/e2e/organization-missions.spec.ts
PERF_LOGS=1 npm run test:e2e -- tests/e2e/remediation-flows.spec.ts --grep "learner completes a lesson page"
```

These are diagnostic samples rather than a latency SLO. Local Docker contention,
fixture setup and concurrent browser requests can produce cold outliers. The
dependency-wave shape and call multiplicity are nevertheless deterministic in
the current code.

### Authenticated Dashboard Sample

One seeded, assessment-complete learner render produced:

| Stage | Duration |
| --- | ---: |
| Middleware `auth.getUser()` | 78ms |
| Page `auth.getUser()` | 90ms |
| Current profile | 48ms |
| Full learning catalogue | 183ms |
| Primary data batch | 153ms |
| Secondary data batch | 49ms |

This is a measured lower bound of **601ms across sequential server barriers**
before accounting for the assessment-status query, React rendering, response
transfer, images or hydration.

The primary batch was mission-bound in this fixture. Mission catalogue loading
took 47ms and the per-mission summary batch took 104ms. Five missions emitted:

- five award-count reads;
- four additional current-award reads;
- five progress evaluations, covering referral, proof, lesson, course and
  lesson-count validation.

The progress evaluators perform further relational reads, so those fourteen
timers are not the complete mission query count.

### Organisation Workspace Samples

The organisation mission journey repeatedly demonstrated this dependency chain:

```text
page auth + profile
  -> organisation lookup
  -> can-enter RPC
  -> membership/enrolment/XP-account batch
  -> XP-balance read
  -> programme/course/mission delivery batch
  -> page data
  -> mission catalogue and per-mission state
```

Observed organisation workspace resolution ranged from 47ms warm to 526ms in a
cold/contended sample. Organisation mission summary loading ranged from 55ms to
415ms. A representative warm path spent 91ms in auth/profile, 47ms resolving the
workspace and 68ms on mission summaries before the rest of the page work. A
cold/contended path reached roughly one second across those same three barriers.

Middleware auth was also invoked many times during a single browser journey,
including public/login/admin/API navigation. Individual calls ranged from
sub-millisecond cached/missing-session results to multi-second contended
outliers. Those concurrent calls must not be summed as one route's latency, but
their count confirms that auth is still a global request tax.

### Static Read-Path Verification

- `getLearningCatalog()` performs eight logical Supabase requests across six
  dependency waves: courses; course media; lessons; pages plus quizzes; blocks
  plus questions; then options. Dashboard uses this full graph.
- `getLearningCourseSummaries()` is lighter but still reads quizzes and quiz
  questions. `/courses` calls it through the uncached repository path.
- `getCachedLearningCourseSummaries()` exists but currently has no caller.
- `getOrganizationWorkspaceCourses()` uses the full course graph for
  organisation Home and Learn card surfaces.
- `resolveOrganizationLearnerWorkspace()` performs up to eleven logical reads
  across five sequential waves before route-specific data begins.
- Mission summaries scale approximately with the number and validation type of
  missions because award and progress state is evaluated per mission.

## Ordered Performance Remediation

### P0.1 — Auth Boundary and Request-Scoped Identity

Status: **complete in local production validation (2026-08-29)**.

1. Classify the route before calling Supabase Auth in middleware. Keep the safe
   redirect contract for protected learner routes and preserve session refresh
   where it is actually required.
2. Introduce one request-scoped identity/profile loader for server components so
   layouts, pages and shared loaders reuse the same result.
3. Keep middleware and page auth behavior covered by the existing signed-out,
   safe-return and authenticated browser tests.
4. Re-measure authenticated `/dashboard`, `/courses`, `/missions` and one Org
   Mode route in a production build.

Exit criterion: public dynamic routes do not pay a Supabase Auth round trip
merely because the global matcher ran, and a protected page does not resolve the
same identity/profile more than once in the Next server runtime.

#### P0.1 Delivery Review

- Middleware now classifies the route before creating a Supabase client. Public,
  auth-entry and API routes retain the device cookie but do not refresh auth
  merely because they matched middleware.
- Protected learner and admin routes still validate with `auth.getUser()`.
  Middleware removes all browser-supplied internal identity headers before the
  check, then forwards only the validated user ID/email or a validated signed-out
  result to the server render.
- The server identity/profile context is React request-cached. Dashboard,
  Missions, Org Mode route context and admin authorization share that context;
  explicit callers that pass their own Supabase client retain independent auth
  verification for API/action boundaries.
- Signed-out learner redirects and safe `next`/referral return parameters are
  unchanged. Browser coverage also proves that spoofing all internal identity
  headers cannot bypass middleware.

Representative local production samples after P0.1:

| Route | Middleware auth | Page profile | Repeated page `auth.getUser()` |
| --- | ---: | ---: | --- |
| `/dashboard` | 51ms | 18ms | No |
| `/courses` | 47ms | 24ms | No |
| `/missions` | 70ms | 24ms | No |
| Org missions | 37ms | 11ms (`org.route.auth_profile`: 12ms) | No |

The pre-P0.1 dashboard sample spent 78ms in middleware auth, then another 90ms
in page auth and 48ms on the profile. The post-P0.1 sample is not a latency SLO,
but it removes that measured 90ms network barrier and changes the dependency
shape from two identity checks to one.

Two intentional distinctions remain:

- personalized public shells still resolve auth in their page loader when they
  need signed-in navigation; they no longer pay an additional middleware auth
  call for the public route itself;
- `/missions` still loads mission state through its client `/api/missions`
  request, and that API boundary authenticates independently. Collapsing the
  mission client request belongs with P1.1 rather than weakening API auth.

Local validation: 148 unit tests, lint, typecheck and a production build passed.
Focused Playwright coverage passed for signed-out redirects, safe referral
returns, spoofed-header rejection, authenticated Courses/Missions, public-shell
navigation, the dashboard lesson journey and the Org Mode mission journey.

### P0.2 — Screen-Specific Learning Read Models

Status: **complete in local production validation (2026-08-29)**.

1. Define focused application read types for dashboard cards, course-library
   cards and organisation learning cards. Do not reuse `Course[]` when the
   surface does not need pages, blocks, quiz questions or options.
2. Add targeted projections/loaders for those types. Use the existing cached
   summary path only as an interim step if its quiz-question overfetch is
   removed or proven necessary.
3. Keep full graph loaders only on lesson/course delivery surfaces that render
   full content.
4. Cache published platform metadata with explicit invalidation from publish,
   unpublish and relevant editorial mutations. Organisation-private projections
   must remain tenant-scoped and must not enter a cross-tenant cache key.

Exit criterion: dashboard, `/courses`, organisation Home and organisation Learn
never fetch lesson content blocks or quiz options, and query count does not grow
with the number of pages/questions on a course.

#### P0.2 Delivery Review

- Dashboard, `/courses`, organisation Home and organisation Learn now consume a
  focused `LearningCourseCard` model. It retains course/lesson presentation,
  page identity/order, quiz identity/question IDs and XP totals needed for
  progress and resume behavior, but excludes content blocks, question prompts,
  options, explanations and answer keys.
- The focused loader performs five logical requests across four dependency
  waves: courses; lessons; pages plus quizzes; then question ID/XP rows. Pages
  and questions are batched with `in` filters, so request count remains constant
  as either collection grows. The prior full graph required eight requests
  across six waves and also loaded media rows, blocks and options.
- Full `Course` graphs remain on course, lesson and quiz delivery surfaces and
  in the explicit delivery repository contract. Card surfaces no longer call
  `getLearningCatalog()` or the removed summary loader.
- Published platform cards use one five-minute tagged cache. A cache miss uses
  the authenticated request client for RLS evaluation, while the root query is
  hard-filtered to published platform courses; the Supabase client is captured
  by the cache callback and is never serialized as a cache argument. Publish,
  unpublish/archive and all editorial mutations that affect projected card
  metadata invalidate the tag.
- Organisation cards use entitled course IDs with the request's authenticated
  RLS client and deliberately bypass the cross-user cache. No tenant-private
  projection enters the platform cache key.

Representative local production samples after P0.2:

| Surface | Focused card read | Browser verification |
| --- | ---: | --- |
| `/courses` | 243ms cold; 1–4ms warm | 391ms warm navigation; 272ms repeat |
| `/dashboard` | 1–2ms warm after the shared platform cache was primed | 749ms warm navigation |
| Organisation Home | 25–94ms, intentionally uncached | Org acceptance journey passed |
| Organisation Learn | 14–50ms, intentionally uncached | Org acceptance journey passed |

The Dashboard/Courses focused journey completed Dashboard → Courses → Dashboard
→ Courses in 3.2 seconds. These numbers are local Docker measurements rather
than production latency SLOs; the important verified change is the request and
payload shape plus the warm platform cache reuse.

Validation passed with 150 unit tests, scoped and full lint, typecheck, a local
production build, demo/live repository contracts, the dedicated Dashboard and
Courses card journey, and the Org Mode mission journey extended with an Org Home
assertion. Projection tests recursively reject blocks, prompts, options,
explanations and answer-key fields.

### P0.3 — Collapse Organisation Workspace Context

Status: **complete in local production validation (2026-08-29)**.

1. Replace literal reconstruction with one RLS-respecting workspace-context read
   operation that returns access source, roles, enrolment/delivery identifiers,
   branding and XP-account state.
2. Keep course, assessment, mission and reward screen data in focused read
   operations rather than growing a new workspace god RPC.
3. Preserve invoker/RLS semantics or add a narrowly executable RPC with explicit
   authorization tests. Do not broaden grants, bypass RLS or expose service-only
   primitives.

Exit criterion: organisation route context is established in one database
operation, with pgTAP coverage for member, enrolled learner, outsider, admin and
service-role boundaries.

#### P0.3 Delivery Review

- Organisation route context now resolves through the focused
  `get_organization_learner_workspace_context` RPC. The application performs one
  database operation and no direct table reads while establishing route context,
  replacing up to eleven logical reads across five sequential waves.
- The RPC derives the learner identity only from `auth.uid()`, resolves the
  organisation by slug, and requires `current_user_can_enter_organization`
  before returning data. It accepts no caller-selected user or organisation ID,
  is not executable by `anon`, and a `service_role` call without a user JWT
  subject returns no context.
- The response is intentionally limited to access source, active roles,
  programme/course delivery identifiers, branding, and the caller's active
  organisation XP account state. Mission, assessment, reward, and course-screen
  data remain in their focused read operations; the unused mission-ID preload
  was removed from route context.
- A focused application parser validates the privileged JSON boundary and
  rejects cross-workspace or malformed delivery identifiers before they become
  route state. A unit contract also locks the route resolver to exactly one RPC
  and zero table reads.

Representative local production samples from the authenticated Org Mode
acceptance journey:

| Shape/sample | Before P0.3 | After P0.3 |
| --- | ---: | ---: |
| Context database operations | Up to 11 | 1 |
| Sequential context waves | 5 | 1 |
| Cold context resolution | Up to 526ms cold/contended | 30ms |
| Warm context resolution | 47ms representative warm | 8–14ms |

These remain local Docker samples rather than hosted latency SLOs. The durable
result is the constant one-operation dependency shape and the explicit
self-scoped authorization boundary.

Validation passed with a database reset and migration replay, generated-type
parity, the dedicated 15-assertion pgTAP boundary suite, the full 34-file/732-test
database suite, 153 unit tests, full lint, typecheck, a production build, demo
and live repository contracts, the seven-test auth-route boundary suite, and the
production Org Mode mission journey.

### P1.1 — Set-Wise Mission State

Status: **complete in local production validation (2026-08-29)**.

1. Add a read-only `get_dashboard_mission_state`-style operation that evaluates
   all visible missions for the current user and context set-wise.
2. Keep award mutation in explicit claim/proof/action flows. Rendering a mission
   list must remain read-only.
3. Include referral qualification, proof state and contextual programme scope in
   the database contract without exposing private mutation helpers.

Exit criterion: mission summary query count is constant for a screen and does
not scale linearly with mission count or referred-user count. Add pgTAP boundary
tests and repository contract coverage.

#### P1.1 Delivery Review

- Mission lists now load the published mission catalogue once and evaluate every
  requested delivery through one `get_dashboard_mission_state` RPC. The state
  operation returns award count/current-period completion, learning progress,
  proof-field/review state, referral qualification and an existing contextual
  referral token for all deliveries in one response.
- The RPC derives identity only from `auth.uid()` and revalidates each requested
  delivery as public platform scope, active-membership organisation scope, or a
  readable published programme attachment. Caller-supplied cross-organisation
  context is dropped, anonymous execution is denied, no-subject service calls
  fail closed, and input is bounded to 100 deliveries.
- Mission-list rendering no longer calls award/proof/referral tables per mission
  and cannot invoke `award_valid_mission_xp` or
  `ensure_contextual_referral_token`. Proof submission continues to award only
  through its explicit action flow. A contextual invite token is created only
  by the authenticated `POST /api/missions/[id]/referral-link` user action; GET
  and server rendering remain read-only.
- For five seeded public missions, the summary dependency shape changed from one
  catalogue read plus at least fourteen timed per-mission operations (and nested
  relational reads, including one read per referred learner) to exactly two
  database operations: one catalogue read and one state RPC. Organisation
  delivery lookup remains a separate constant-size focused batch.

Authenticated local Docker samples for the five-mission state RPC were 79ms on
the first call and 31.4–54.4ms across five warm calls. These are not hosted
latency SLOs; the durable result is one state operation whose network query
count is unchanged as mission or referred-user rows grow.

Validation passed with a database reset and migration replay, generated-type
parity, the dedicated 23-assertion pgTAP boundary suite, the full 35-file/755-test
database suite, 155 unit tests, typecheck, lint, a production build, demo/live
repository contracts, the eight-test auth-route boundary suite, the production
Org Mode mission journey, and `git diff --check`.

### P1.2 — First-Useful-HTML Boundary

Status: **complete in local production validation (2026-08-29)**.

1. Keep identity, XP, continue-learning state and basic navigation in the core
   render path.
2. Move recommendations, non-critical missions/rewards, ads and organisation
   switcher extras behind Suspense boundaries where product behavior permits.
3. Collapse the two-stage personalized recommendation tag loading into one
   focused read operation and cache editorial configuration separately from
   user state.

Exit criterion: secondary features cannot delay first useful dashboard HTML;
their errors retain current fail-soft behavior.

#### P1.2 Delivery Review

- The dashboard core path now waits only for authenticated identity/profile,
  assessment routing, XP, the focused learning catalogue/progress models, and
  continue-learning state. It can emit the learner chrome, welcome/XP state,
  continue-learning card or empty state, footer, and basic navigation without
  waiting for optional modules.
- Missions, rewards, editorial and personalized recommendations, ads,
  organisation switcher organisations, and unread-notification decoration start
  eagerly but render through independent Suspense boundaries. Each loader keeps
  the existing logged empty/null/zero fallback, so a failed optional dependency
  cannot fail the page or hold the core HTML boundary.
- The workspace switcher fallback retains Project Ve navigation and the
  notification fallback retains a working notifications link; only their
  database-backed extras stream later.
- Personalized recommendations now start user profile/scores and editorial
  configuration concurrently. All candidate content tags are selected through
  one focused `content_value_tags` read instead of one query per content type.
  Active dimensions and published-content tags use a five-minute tagged cache;
  authenticated profile and score rows never enter that shared cache. Content
  tag admin mutations explicitly invalidate the editorial cache.
- A focused unit contract locks core/secondary ordering, the required Suspense
  fallbacks, logged fail-soft behavior, the single tag read, the user/editorial
  cache separation, and cache invalidation. The Dashboard/Courses browser
  journey now waits for the core marker before the streamed editorial marker.

Authenticated local production-browser samples were 253ms cold for first useful
HTML versus 257ms for the editorial secondary marker, and 151ms warm versus
156ms. Local Docker dependencies are fast, so the gap is intentionally small;
the durable result is that optional work is no longer in the awaited core path
and cannot extend first-useful-HTML time when it is slow or unavailable.

Validation passed with the full 35-file/755-test database suite, demo/live
repository contracts, 158 unit tests, typecheck, lint, a production build, the
eight-test auth-route boundary suite, the focused Dashboard/Courses journey, the
production Org Mode mission journey, and `git diff --check`.

### P2 — Query Tuning After Read-Path Repair

Capture hosted Supabase query statistics and `EXPLAIN (ANALYZE, BUFFERS)` for the
new read operations. Add indexes only for demonstrated scans or join costs. Do
not use index work as a substitute for removing network dependency waves.

### Required Validation Per Batch

- auth boundary: unit policy tests plus auth-route Playwright coverage;
- DB/RPC read models: pgTAP RLS/RPC tests and live repository contracts;
- dashboard/Org Mode behavior: focused Playwright journeys;
- every batch: `npm run typecheck`, `npm run lint`, `npm run build` and
  `git diff --check`;
- after each batch: repeat the authenticated timing commands and record cold and
  warm samples without replacing them with redirect timings.

### Remaining Follow-Ups

- Stop after this P1.2 review; proceed to P2 query tuning only as a separate
  explicitly requested batch backed by hosted query statistics and plans.
- Capture hosted/staging server timings; local Docker numbers establish
  the request shape but not production network latency.
- Capture browser Lighthouse/Web Vitals in staging after the server dependency
  waves are reduced.
- Browser-level Lighthouse/Web Vitals should be captured in staging because local server timing does not measure hydration, image loading, real device CPU, or mobile network behavior.
- Investigate why `/api/referrals/accept` fires during simple learner navigation such as dashboard → courses → course detail. Current likely source is `ReferralAttributionCapture` on `/dashboard`; confirm whether stale `project-ve-referral-code` localStorage or missing accepted/refused state causes repeated 400s, then gate or clear it so normal course browsing does not produce referral API noise.
