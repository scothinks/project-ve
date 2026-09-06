# AI authoring Phase 6: release hardening

Status, 2026-09-06: Local implementation and validation are complete; the full release gate remains open.
Hosted activation and representative provider-output qualification are pending a
deployment target and an explicitly authorized spending cap. This is AI Authoring
Phase 6, not authorization for engineering P2. Tracking: [AI Authoring #71](https://github.com/scothinks/project-ve/issues/71).

## Pre-deploy blocker audit

The named staging alias is
`https://project-ve-git-codex-ai-course-work-ec78ce-oby-douglas-projects.vercel.app`.
On 2026-09-06 it redirected unauthenticated requests to Vercel SSO. GitHub's public
deployment record identifies Preview deployment `6163386672`, immutable URL
`https://project-l8805cm9e-oby-douglas-projects.vercel.app`, at commit
`ffcbffb80dd03dfd494619f5b7e3d2366cff31e9`. That commit is the local branch base;
the Phase 1–6 work is still in the local working tree and is therefore absent from
the named deployment.
The machine-readable result is retained in
[pre-deploy qualification evidence](evidence/ai-authoring-phase-6/predeploy-qualification-2026-09-06.json).

The ordinary CI workflow now runs `npm run test:release-readiness`. This
secret-free merge gate checks the coordinated migration files, `after()` dispatch,
private SSE contract, worker authentication/order/duration, rollback switch,
maintenance declaration, media smoke tool, current branch trigger and hosted
workflow wiring. The manual
`Hosted AI Authoring Qualification` workflow checks out the exact expected SHA,
matches it to GitHub's Preview deployment record, probes the protected app and
worker denial boundary, validates the completed evidence document, and optionally
runs the read-only media cutover smoke. It uploads the resulting JSON even when a
release requirement is blocked.

The hosted workflow intentionally does not create paid AI work. Real provider
requests remain behind the separately approved spending cap and must be recorded
in a completed copy of
`docs/evidence/ai-authoring-phase-6/hosted-qualification.template.json`.

Required fixes before activation:

1. Commit and deploy the complete coordinated application and migration revision,
   then run the hosted workflow with that full SHA. A branch alias alone is not
   revision evidence.
2. Add `VERCEL_AUTOMATION_BYPASS_SECRET` to the GitHub `staging` environment so CI
   can reach the protected Preview without weakening Deployment Protection.
3. Provide read-only migration-ledger access and capture forward replay against a
   target snapshot. RPC presence alone does not establish ledger parity or function
   body compatibility.
4. Replace the daily 08:30 UTC worker fallback with an observed maintenance path
   no slower than every five minutes. Vercel Hobby accepts only daily cron; use a
   Pro/Enterprise cron or an authenticated external scheduler if the project stays
   on Hobby. Keep `CRON_SECRET` configured and record one actual invocation.
5. On the exact deployment, measure acknowledgement at or below two seconds and
   persisted dispatch visibility at or below five seconds for course outline,
   course draft, lesson plan, lesson draft, page, quiz and image operations. Record
   first-result and completion times without imposing a provider-latency fiction.
6. Supply isolated admin and outsider tenant fixtures, then run denial, private
   media delivery, public denial and storage/reference reconciliation. The optional
   workflow media step needs the hosted Supabase URL, publishable key and service
   role key in the `staging` environment.
7. Reconcile jobs, credits and media after the measured runs. Investigate any
   nonzero recovery `deferred` count before release.
8. Exercise `AI_AUTHORING_PAGE_PILOT_ENABLED=false` against the deployed schema,
   confirm legacy review and accepted history remain available, then restore the
   intended staging value. This is the rollback smoke; it must not delete results.
9. Approve and record a provider spending cap before representative text/image
   quality review. The CI workflow must remain read-only with respect to paid work.

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

| Release requirement | Local evidence | Remaining qualification |
| --- | --- | --- |
| Course, expansion, page, quiz and image setup/cost/progress/use | Existing unit, pgTAP and production Playwright journeys run against the integrated implementation | Hosted smoke of each supported entry point |
| Course economy and intentional composition | Provider spies, bounded scope contracts, contrasting teaching fixtures, course browser tests | Representative real text output review |
| Visible progress and worker outage | Silent-stream delay/keyboard-stop browser case; runtime worker tests; expired lease, exhausted attempts and deferred registry repair pgTAP | Measure HTTP acknowledgement, dispatch, first result and total completion on the deployment |
| Draft safety and application recovery | Revision, outsider/deleted target, double apply and retained receipt contracts; lost-response page/quiz tests | Hosted connection-loss smoke |
| Partial results and retry | Checkpoint preservation, unfinished-only retry and 135-used/35-released partial-course accounting | Real bounded course completion |
| Paid-image retention | Upload/registration uncertainty, failed legacy worker recovery, immutable version/idempotency and unused discovery tests | Hosted private storage delivery and quota smoke |
| Media choice and style | Contextual brief persistence, default/override prompt contracts, explicit Use image and media authorization tests | Inspect representative real preset/custom images under the approved cap |
| Review and migration | Mixed legacy/new review, explicit queued-job choices, optional inline placeholders, preserved cover and attached-asset checks | Hosted migration compatibility and rollback smoke |
| Metering and concurrency | Full DB suite, organization-AI concurrency, economic integrity, quiz/XP concurrency and denied revocation fixtures | Hosted reconciliation against the exact qualified revision |
| Tenant and worker security | RPC ACL/classification, auth-before-recovery, fenced writes, media reuse/withdrawal and repository contracts | Supported hosted auth/tenant smoke |
| Accessibility and layout | Role/label-driven browser actions, mobile overflow assertions, reduced-motion delay, keyboard cancellation and focus retained on the stopped status | Manual assistive-technology review on the supported deployment |
| Rollback | Feature-switch route contracts and legacy compatibility tests retain reads/results/accepted work | Exercise the switch against the deployed schema without discarding history |

## Validation

Tests use local Supabase and deterministic provider/worker fixtures. No paid model
calls, hosted migrations, deployment, commit or push were performed. Local schema
migrations were applied incrementally; the database was not reset.

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
| Updated CI memory boundary | Repeated full-tree checks exhausted Node's default heap in build and typecheck; both commands now use a bounded 4 GB heap, and the production build completed successfully |
| Production Playwright release matrix | 14/15 passed initially; after the reproduced layout fix, all 7 affected course/page/recovery/picker cases passed. Sixteen distinct browser scenarios have passing evidence across the initial run and affected reruns. |

The final production build, including type and lint validation, passed through the
Playwright harness. Screenshots and exact validation excerpts are retained in
[evidence](evidence/ai-authoring-phase-6/validation.txt); the
[working-tree manifest](evidence/ai-authoring-phase-6/working-tree-manifest.json)
records the baseline commit and hashes of integrated/Phase 6 paths, not a deployed
revision. The mobile stopped state and contextual image drawer were visually
inspected. `git diff --check` passed.

The repository integration fixture initially selected a catalog lesson without a
quiz and invented a fallback quiz ID. It now selects an actual lesson with pages
and quiz questions, then checks projections by its real ID. The complete
repository wrapper passed after this correction.

Existing CI discovers the added unit, database and browser tests through its
current commands. No second test platform or new manual-only automated gate was
introduced. The all-application E2E suite and `test:remediation:local` reset chain
were not claimed as run; validation used the affected release journeys and the
individual relevant integration gates without a local database reset.

## Hosted release evidence still required

Record the deployed revision, compatible migration list, runtime support for
`after()`/streaming and the worker's 300-second execution window. The checked-in
fallback cron currently runs daily at 08:30 UTC; it does not establish a five-second
outage recovery guarantee. Qualify the deployment's actual worker wake-up and
maintenance schedule before activation.

Measure authenticated HTTP acknowledgement and persisted worker-stage visibility
against the proposed two-second/five-second healthy-system targets. Record first
result, completion, stop/retry and recovery timing separately for each operation.
The local browser attachment measures only a fixture RPC acknowledgement and is
not HTTP, hosted dispatch or provider-performance evidence. Retain worker recovery
counts and investigate nonzero `deferred` without exposing secrets or private
prompts in release artifacts.

With an explicitly approved cap, review representative course/text compositions
and image presets/custom direction, retaining the accepted quote, actual usage,
output assessment and budget totals. Stop at the cap. Then exercise tenant denial,
private image delivery, uncertain application and feature-switch rollback on the
named deployment. Until these checks have recorded evidence, #71 remains open and
the full Phase 6 release gate is not complete.

## Migration follow-up

The user reports the migration was pushed. A subsequent read-only check of the
hosted REST schema confirms `service_recover_ai_authoring_jobs` is present for
the configured service identity; it was not invoked. See the timestamped
[API schema evidence](evidence/ai-authoring-phase-6/hosted-schema-presence.json).
The migration ledger and function body could not be independently verified:
the CLI has no platform access token and the configured direct database password
was rejected. An anonymous schema read returned HTTP 401, so it does not establish
the function's individual ACL. Local ACL tests remain the existing evidence.
This confirms hosted API presence, not application deployment, hosted workflow
validation or completed provider-output qualification.
