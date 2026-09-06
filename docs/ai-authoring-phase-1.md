# AI authoring Phase 1: page pilot

Status: Phase 1 implementation closed and locally verified (6 September 2026).
Hosted rollout and live-provider evidence remain pending.

## Editor experience

The lesson Pages step offers **Suggest next page**. Opening it saves outstanding
edits and prepares the cost estimate automatically. No topic, page type or
placement decision is required. **Add direction** is optional; refinement
accepts a short change request.

After cost acceptance, one provider request considers the lesson purpose and
actual teaching content and prepares a useful draft. It infers the topic, format
and insertion position, explaining why the page helps. The recommendation and
draft share the existing quoted cost, avoiding a separate paid planning step.
Alternatively, it can suggest **Review quiz** with an explanation and no page.
This is not a publication approval. The quoted cost also covers a recommendation
to move on; that outcome never implies a refund. Editors review the recommendation
and draft, then explicitly add the page or steer another version.

A suggested page contains text, callouts or tables, plus
optional media placeholders where they add instructional value. Each placeholder
stores a purpose, media kind, aspect ratio and inherited style. It creates no
media files, fabricates no URLs and reserves no image credits. Editors choose
media separately using the existing block chooser. Empty placeholders are visible
in editorial review and omitted from learner rendering; optional placeholders do
not block publication. Phase 2 subsequently removed inline-media presence gates for legacy required flags too, by explicit user instruction; see [Phase 2](ai-authoring-phase-2.md).

Opening an image placeholder’s media picker prefills an editable brief from its
purpose, the current lesson/page and bounded teaching content. Editor changes
autosave on the block and survive dismissal, reopening and reload; even a cleared
brief is preserved. No aesthetic is imposed. The picker clearly explains that
live image generation remains part of Phase 4; preparing a brief spends no credits.

Previously accepted text-only requests retain their original scope; new page
quotes include placeholder support.

The drawer shows acknowledged and working stages from durable server state, then
the real candidate using the shared lesson renderer. Delays and connection loss
are visible. Closing the drawer leaves generation/results intact. **AI results**
in Courses and the lesson editor provides recovery; the platform catalogue maps
to unowned results rather than an organisation UUID.

Candidates and earlier refinement versions have no automatic expiry. A quote
expires after ten minutes; this does not expire accepted work or its results.
Explicit deletion removes candidate content without deleting applied lesson
pages, receipts or usage history. Results for a deleted destination remain
accessible to authorized workspace editors with an explanation.

**Add page** is a separate revision-checked save. A durable application intent
precedes the atomic page/block write and success receipt. A lost response shows
**Checking save…**; replay uses the same candidate/application identity. A
confirmed conflict shows **Not saved** and retains the candidate. Applying twice
inserts once. New content never approves or publishes itself. The editor
reconciles the saved page when it has no newer local changes; newer edits are
preserved and explained rather than replaced. Active autosaves finish before quoting
or applying; toggling rich-text editability does not create a content change.

## Implementation boundaries

- Assistant quotes take a revision-locked, lesson-scoped snapshot in a set-wise
  read: ordered page titles/types and plain-text teaching excerpts (up to 20
  pages, 1,800 characters each). Context stays private to the worker. Truncation
  is explicit and prevents a suggestion to move on based on incomplete context.
- Recommendations use the same durable result, lease, metering and recovery
  path as page drafts. Inferred positions are validated against the snapshot;
  normal source-revision checks still guard application. Both prepare and apply
  RPCs reject quiz-review recommendations. No empty page can be inserted.
- The old sidebar form and missing-page-type heuristic are removed. Turning the
  pilot off retains AI results without restoring the old background-only UI.

- Existing `ai_generation_jobs`, leases, organisation reservations and settlement
  remain authoritative. The versioned `authoring_page_v1` mode stages results;
  existing queued modes retain their behavior.
- `private.ai_authoring_results` holds quote/context snapshots, candidates,
  refinement links and application receipts independently of job-log retention.
  No direct browser table grants are added. Focused RPCs check current editorial
  access and ownership; service-only checkpoint RPCs fence every worker write.
- The start route acknowledges first, then uses Next `after` to wake a worker for
  that accepted job. The existing scheduled worker also recognizes this mode.
  Provider-start checkpoints prevent an expired lease from repeating an uncertain
  paid call. Before-provider failures release reservations; started failures
  settle under the existing estimate policy without an automatic provider retry.
- Authenticated SSE sends durable state changes with a resume cursor. Bounded
  polling is the fallback. Both paths are read-only, use private/no-store
  responses, and recheck result access. Lists are paginated projections with an
  aggregate unused count, not full lesson graphs.
- The single-page provider request has a two-minute timeout. The start route has
  a 300-second execution budget; event streams have a 60-second route budget and
  rotate before it expires. No worker secret enters the browser.

## Rollout

Apply the additive migrations in order with the matching application:

1. `20260906010000_ai_authoring_page_pilot.sql`
2. `20260906020000_ai_authoring_application_recovery.sql`
3. `20260906030000_ai_authoring_save_boundary.sql`
4. `20260906040000_ai_authoring_target_review_guard.sql`
5. `20260906050000_ai_authoring_results_list.sql`
6. `20260906060000_ai_page_media_placeholders.sql`
7. `20260906070000_ai_placeholder_validation.sql`
8. `20260906080000_ai_page_assistant.sql`

Enable `AI_AUTHORING_PAGE_PILOT_ENABLED=true` in the server environment after the
schema is available. It defaults to false. The isolated local test environment
enables it against local Supabase; the workspace connected to hosted Supabase
remains disabled until its rollout migrations are applied. Verify the hosting runtime supports
the `after` execution budget and SSE delivery, and retains the existing scheduled
worker recovery. A rollout rollback disables new starts while leaving status,
results, stop and application available for accepted work.

No hosted migration, deployment or paid generation was performed for this phase.
Before hosted rollout, measure acknowledgement and worker-stage latency, exercise
a real provider response with an authorized budget, and verify recovery across
runtime restarts. Local deterministic checks do not establish those timings.

## Validation

The existing unit, guardrail, database and browser CI entry points include the new
tests. Provider execution in the browser fixtures is replaced with deterministic
fenced checkpoints; there is no production test endpoint or provider bypass flag.
Worker tests execute the real orchestration with an injected provider function.

- `tests/unit/ai-authoring-worker.test.mjs`: dispatch boundary, sanitization,
  uncertain-call non-replay, provider failure and rejection of generated media files, and retention of optional media intent.
- `tests/unit/ai-authoring-routes.test.mjs`: acknowledgement before dispatch,
  read-only/scoped recovery, catalogue workspace mapping, rollout rollback and
  ambiguous save outcomes. Included in `test:guardrails`.
- `supabase/tests/database/ai_authoring_page_pilot.sql`: durable quote/start,
  fenced execution, apply receipts, duplicate protection, retained results after
  job deletion, stale edits, access denial, inferred placement, quiz recommendation
  recovery/application rejection and organisation credit outcomes.
- `tests/unit/media-generation-brief.test.mjs`: contextual prefill, plain-text and
  length boundaries, current lesson edits and preservation of editor overrides.
- `tests/e2e/ai-page-authoring.spec.ts`: save before quoting, visible progress,
  close/reopen through Courses, review/application, desktop/mobile layout,
  lost-save-response recovery, polling after a dropped connection, isolated list errors,
  retained earlier versions after refinement fails, no-prompt suggestions, quiz
  recommendations with no inserted page, and media brief persistence
  across picker dismissal/reopening and a lesson reload.

Verified locally on 6 September 2026:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run test:unit` | 197 passed |
| `node --experimental-strip-types --test tests/unit/media-generation-brief.test.mjs tests/unit/media-intent.test.mjs` | 5 passed |
| `npm run test:guardrails` | 26 passed |
| Assistant pilot, RPC security and lesson draft/publication DB regressions | 180 assertions passed |
| Existing RPC security, lesson draft/publication and organisation AI metering DB regressions | 131 assertions passed |
| Placeholder, lesson publication and media release DB regressions | 203 assertions passed |
| `npm run db:types:local:check` | Passed |
| `PROJECT_VE_E2E_KEEP_BUILD_CACHE=1 npm run test:e2e -- tests/e2e/ai-page-authoring.spec.ts` | Production build passed; 3 browser tests passed |

Inspected 1280px and 390px layouts. Provider execution is deterministic in these
checks; they do not establish live provider latency or output quality. The
placeholder regression also edits and saves a caption, then verifies that the
stored purpose survives ordinary builder saves. Rendering tests prove that
placeholder descriptions are visible only in editorial preview.

All eight migrations were applied to local Supabase. The isolated test workspace
enables the pilot; the hosted-backed workspace and checked-in switch remain off. Scoped whitespace checks passed; the repository-wide check still
reports existing trailing blank lines in `planner-commands.ts` and generated
`types/database.ts`, outside this phase's focused edits.


Placeholder correction verified on 6 September 2026: typecheck, lint, 25 guardrail
checks, 187 unit tests, 203 focused database assertions, and the production build
with both browser scenarios passed. No paid generation or hosted migration was
performed.

Contextual brief follow-up: typecheck and lint passed; the production build and
both authoring browser tests passed again. The browser verifies prefilled lesson,
page, purpose and teaching content, saves a custom photographic direction, then
verifies it after closing/reopening the picker and reloading the lesson. The
390px brief layout has no horizontal overflow. No additional migration, hosted
deployment or paid generation was needed.

## Phase 1 closure

The assistant-led follow-up is complete locally. Editors start without choosing
scope or placement; cost acceptance, optional steering, explained recommendations,
explicit application, placeholders and recoverable results are covered. The
final production browser run passed all three scenarios, including reload and
media-brief recovery. Media chooser buttons remain disabled until their client
handlers are ready, preventing a click from being lost immediately after reload.
Typecheck, lint, 197 unit tests, 26 guardrail checks and 180 focused database
assertions passed. The eight provider/worker tests were rerun after the final
prompt wording change and passed without a paid provider call.

No Phase 2 work has begun. Hosted migration/activation, provider quality and
runtime latency verification remain rollout work; the hosted-backed workspace
keeps its pilot switch off until its matching schema is available.

The setup copy is condensed to one introductory sentence, optional direction,
the credit amount and the action. Cost mechanics use a collapsed disclosure;
metered reviews still state upfront that credits apply even without a new page.
Setup omits the repeated retention description and results link.
