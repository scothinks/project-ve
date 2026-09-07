# AI authoring Phase 6: release hardening

Status, 2026-09-07: the practical hosted staging boundary passes on exact revision
`2e17a052f1c9f334621a41930108ec384823d825`; PR #92 is merged to `main` as
`9da4187cd85ad8bc15d9adf923e02031b6e66078`. CI, migration parity, recovery ACL,
runtime access, worker denial and the complete read-only media smoke are established.
Representative paid output review remains a pilot follow-up rather than a merge or
deployment blocker. This is AI Authoring Phase 6, not authorization for engineering
P2. Tracking: [AI Authoring #71](https://github.com/scothinks/project-ve/issues/71).

## Deployment and blocker audit

Before deployment, the named staging alias was
`https://project-ve-git-codex-ai-course-work-ec78ce-oby-douglas-projects.vercel.app`.
It redirected unauthenticated requests to Vercel SSO. GitHub's public
deployment record identifies Preview deployment `6163386672`, immutable URL
`https://project-l8805cm9e-oby-douglas-projects.vercel.app`, at commit
`ffcbffb80dd03dfd494619f5b7e3d2366cff31e9`. That commit is the local branch base;
the Phase 1–6 work was absent from that deployment.
The machine-readable result is retained in
[pre-deploy qualification evidence](evidence/ai-authoring-phase-6/predeploy-qualification-2026-09-06.json).

The latest qualification is [GitHub Actions run 34069618360](https://github.com/scothinks/project-ve/actions/runs/34069618360).
It resolves Preview deployment `6299394706`, immutable URL
`https://project-bgvtlczlz-oby-douglas-projects.vercel.app`, and exactly matches
revision `2e17a052f1c9f334621a41930108ec384823d825`. The Vercel automation bypass is
configured: the protected application returned HTTP 200 and the worker correctly
denied an unauthenticated request with HTTP 401.

The manual workflow reached the default branch in
[#83](https://github.com/scothinks/project-ve/pull/83). Follow-up runs established
that the hosted migration ledger is in parity, the recovery migration is present,
and the function ACL remains service-role-only. A source matcher initially rejected
the hosted function's valid bounded-limit expression. The matcher is now shared
with the local release gate, which applies it to the checked-in migration before a
hosted run can be dispatched.

The ordinary CI workflow runs `npm run test:release-readiness`. This secret-free
merge gate checks the coordinated migration files, the same recovery-function
markers used by the hosted audit, all seven current operation kinds, `after()`
dispatch, the private SSE contract, worker authentication/order/duration, rollback
switch, maintenance declaration, media smoke tool, current branch trigger and
hosted workflow wiring. The manual `Hosted AI Authoring Qualification` workflow
checks out the exact expected SHA, resolves that SHA's successful Preview deployment
and uses its immutable URL for runtime and media probes. Independent diagnostics run
even when an earlier gate fails, emit specific failed assertions, and upload all JSON
artifacts. Completed non-secret evidence can be supplied directly at dispatch, so
recording evidence does not change the SHA being qualified.

The read-only media smoke now distinguishes missing fixtures, deployment-protection
blocks and failed assertions. The 16 retained legacy versions intentionally keep
their recorded `unverified` rights profile, as documented by the accepted privacy
cutover; that inventory is visible evidence and does not reopen the completed bucket
closure. Unverified versions remain ineligible for platform stock sharing under the
database delivery and permission rules.
It uses access-token Management queries, rather than invoking the service-only
inventory RPC, to check unresolved migration inventory, public bucket state, reference-to-registry
and active-registry-to-object reconciliation, non-empty objects, anonymous delivery,
and direct public-URL denial. Tenant role denial remains a separate authenticated
fixture check and is not claimed by the anonymous media probe.

The hosted workflow intentionally does not create paid AI work. Real provider
requests remain behind a separately approved spending cap. Before pilot activation,
one representative text operation and one image operation are sufficient to record
acknowledgement, dispatch, first result, completion, streaming, reconciliation and
output review in a completed copy of
`docs/evidence/ai-authoring-phase-6/hosted-qualification.template.json`. This evidence
is advisory to the automated release qualification.

Non-blocking pilot and operational follow-ups:

1. Approve a small provider spending cap, run one representative text operation and
   one image operation, and reconcile their jobs, credits and media before enabling
   the pilot flag. Completion time is recorded, not treated as a provider SLA.
2. Keep the current daily recovery invocation as a documented fallback and choose a
   faster scheduler before relying on unattended recovery for a wider rollout. The
   five-minute target is an infrastructure follow-up, not a Vercel Hobby release gate.
3. Capture forward replay if a suitable pre-migration target snapshot becomes
   available. Current hosted ledger parity, migration tests and recovery-function
   inspection remain the release evidence in its absence.
4. Use production telemetry to compare all seven operation kinds after pilot traffic
   exists. CI continues to own source-level `after()`, SSE, worker-duration, tenant
   boundary and feature-switch checks rather than duplicating them as hosted proofs.

## Integrated implementation

The completed Phase 4/5 implementation was integrated from its existing worktree
after comparing every incoming path against its recorded Phase 3 baseline. There
were no divergent paths; 77 files changed and one was already identical. The
[integration manifest](evidence/ai-authoring-phase-6/integration-manifest.json)
records paths and hashes. Unrelated workspace changes were preserved. Earlier
phase evidence remains historical; the checks below exercise the combined tree.

The existing secret-authenticated worker now runs bounded outage recovery before
claiming work. Migration `20260907020000_ai_authoring_outage_recovery.sql` adds a
service-only RPC, limited to 20 rows with `FOR UPDATE SKIP LOCKED`. It replaces
expired leases after the existing 30-minute boundary and settles exhausted or
ineligible queued operations through the existing checkpoint/accounting functions.
Late workers fail their original lease fence. Course checkpoints remain available,
started work is charged under existing rules, and unused reservations are released.
Recovery creates no provider request, new job or new reservation.

For images uploaded to the deterministic private result path, recovery validates
the stored object's PNG type and bounded size, then uses the existing atomic
registration/settlement boundary. An uncertain registration response after upload
leaves the result recoverable. It also repairs older terminal-failed image jobs
whose paid file exists. Registration failures roll back only that recovery item,
retain its bytes and increment `deferred`; later maintenance can retry after the
underlying quota/registry issue is repaired. Recovery does not turn a provider URL
into Ready, delete paid bytes, or relax asset ownership checks.

The worker declares a 300-second route duration and avoids taking a subsequent
lease without enough time for a bounded course request. Its response reports
`recoveredImages`, `settledIncomplete` and `deferred`. Recovery remains on the
trusted worker endpoint; ordinary renders, status reads and event streams remain
read-only. Course and image delay notices now use a timer, so a connected but
silent stream cannot suppress the message.

Stopping a course request now leaves a visible live status and transfers keyboard
focus to it. The deferred rich-text editor reserves its toolbar and content
footprint while loading; previously, a fresh navigation could expand the editor
between pointer down and pointer up, preventing the following image button from
opening. The page recovery browser case reproduced this failure; its assertions
were retained while correcting the loading layout.

## Acceptance matrix

| Release requirement | Local evidence | Hosted or pilot status |
| --- | --- | --- |
| Course, expansion, page, quiz and image setup/cost/progress/use | Existing unit, pgTAP and production Playwright journeys run against the integrated implementation | One representative text and one image operation before pilot activation |
| Course economy and intentional composition | Provider spies, bounded scope contracts, contrasting teaching fixtures, course browser tests | Review the representative text output under the approved cap |
| Visible progress and worker outage | Silent-stream delay/keyboard-stop browser case; runtime worker tests; expired lease, exhausted attempts and deferred registry repair pgTAP | Record acknowledgement, dispatch, streaming, first result and completion for the two pilot samples |
| Draft safety and application recovery | Revision, outsider/deleted target, double apply and retained receipt contracts; lost-response page/quiz tests | Local evidence is sufficient for release qualification |
| Partial results and retry | Checkpoint preservation, unfinished-only retry and 135-used/35-released partial-course accounting | Observe during the representative text run; no separate paid run required |
| Paid-image retention | Upload/registration uncertainty, failed legacy worker recovery, immutable version/idempotency and unused discovery tests | Hosted private delivery passes; reconcile the representative paid image |
| Media choice and style | Contextual brief persistence, default/override prompt contracts, explicit Use image and media authorization tests | Review one representative image under the approved cap |
| Review and migration | Mixed legacy/new review, explicit queued-job choices, optional inline placeholders, preserved cover and attached-asset checks | Hosted migration parity passes; source-level rollback gate remains in CI |
| Metering and concurrency | Full DB suite, organization-AI concurrency, economic integrity, quiz/XP concurrency and denied revocation fixtures | Reconcile jobs, credits and media for the two pilot samples |
| Tenant and worker security | RPC ACL/classification, auth-before-recovery, fenced writes, media reuse/withdrawal and repository contracts | Hosted worker denial and media privacy pass; no repeated hosted tenant fixture required |
| Accessibility and layout | Role/label-driven browser actions, mobile overflow assertions, reduced-motion delay, keyboard cancellation and focus retained on the stopped status | Manual assistive-technology review on the supported deployment |
| Rollback | Feature-switch route contracts and legacy compatibility tests retain reads/results/accepted work | CI contract is sufficient before pilot; no hosted environment toggle required |

## Validation

Tests use local Supabase and deterministic provider/worker fixtures. This gate
refresh made no paid model calls and changed no hosted data or configuration. The
application revision was deployed separately before this post-deploy audit.

| Command / scope | Result |
| --- | --- |
| `npm run test:unit` | 230 passed; subsequently added worker-route runtime test passed separately; 13 affected component/course contracts passed after UI fixes |
| `npm run test:guardrails` | 35 passed |
| `npm run test:db` | 48 files, 1,388 assertions passed |
| Focused final `ai_authoring_release.sql` | 27 assertions passed, including two added older-worker recovery assertions after the full DB run |
| `npm run test:repositories:local` | 6 passed across demo, live, publication and media authorization suites |
| `npm run test:organization-ai-concurrency:local` | Passed |
| `npm run test:quiz-xp-concurrency:local` | Passed |
| `npm run test:economic-integrity:local` | Passed |
| `npm run db:types:local:check` | Passed after local type regeneration |
| `npm run typecheck`, `npm run lint` | Passed; focused lint covers subsequent test edits |
| `npm run test:release-readiness` | 9/9 deployable source and workflow contracts passed |
| `PROJECT_VE_E2E_KEEP_BUILD_CACHE=1 npm run test:e2e` | 39/39 browser scenarios passed in 3.8 minutes after aligning the CMS and institutional fixtures with the current routed UI, media-placement flow and immutable published lesson snapshots |
| `npm run ci` | Passed: typecheck, lint, 35 guardrail tests, 9/9 release-readiness checks, 231 unit tests and production build |
| GitHub CI run `34056654615` at `f3319ff414f9cdb69079669358abe928f434297e` | Passed: app, database type drift and full remediation-local jobs |
| Updated CI memory boundary | Repeated full-tree checks exhausted Node's default heap in build and typecheck; both commands now use a bounded 4 GB heap, and the production build completed successfully |
| Production Playwright release matrix | 14/15 passed initially; after the reproduced layout fix, all 7 affected course/page/recovery/picker cases passed. Sixteen distinct browser scenarios have passing evidence across the initial run and affected reruns. |

The final production build, including type and lint validation, passed through the
Playwright harness. Screenshots and exact validation excerpts are retained in
[evidence](evidence/ai-authoring-phase-6/validation.txt); the
[post-deploy CI gate refresh](evidence/ai-authoring-phase-6/ci-gate-refresh-2026-09-06.json)
records the current full-suite results and remaining hosted blockers. The
[working-tree manifest](evidence/ai-authoring-phase-6/working-tree-manifest.json)
records the baseline commit and hashes of integrated/Phase 6 paths, not a deployed
revision. The mobile stopped state and contextual image drawer were visually
inspected. `git diff --check` passed.

The repository integration fixture initially selected a catalog lesson without a
quiz and invented a fallback quiz ID. It now selects an actual lesson with pages
and quiz questions, then checks projections by its real ID. The complete
repository wrapper passed after this correction.

Existing CI discovers the added unit, database and browser tests through its
current commands. No second test platform was introduced. The complete
application E2E suite now has current passing evidence. The
`test:remediation:local` reset chain was not repeated locally after that full E2E
run; its component checks are represented by the earlier database/repository/
concurrency evidence and the current application and browser gates.

## Pilot evidence follow-up

The automated release gate owns the exact deployment, migration, runtime, worker
security and media checks. Source-level `after()`, SSE, worker duration, tenant
boundaries and rollback remain enforced by CI and local remediation suites. Their
absence from a second hosted evidence document does not fail qualification.

With an explicitly approved cap, run one representative text operation and one
image operation. Record request-start acknowledgement and persisted dispatch against
the two-second/five-second healthy-system targets, then record streaming, first
result and completion without imposing a completion SLA. Reconcile only those runs'
jobs, credits and media, review both outputs, and stop at the cap.

The daily 08:30 UTC recovery invocation remains a limited fallback. A faster
scheduler is needed before wider unattended rollout, but the mismatch between the
five-minute aspiration and the current Vercel plan does not invalidate the tested
application. Forward replay may be added when a suitable snapshot exists; current
ledger parity and migration tests are the available release evidence.

## Migration follow-up

Run 34069618360 used the repository's Supabase access token and project reference
only for read-only Management API calls. It established 221 local and 221 hosted
migrations with no missing or remote-only entries, matched every recovery-function
marker, and verified execute access for `service_role` while `anon` and
`authenticated` remain denied. The function was not invoked. The older
[API schema evidence](evidence/ai-authoring-phase-6/hosted-schema-presence.json)
remains historical; the workflow artifact is the stronger current migration and
ACL evidence. Forward replay remains conditional on obtaining a suitable snapshot.
