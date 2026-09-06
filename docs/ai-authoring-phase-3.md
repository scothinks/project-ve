# AI authoring Phase 3 — course drafting and readiness

Date: 2026-09-06. Status: implementation complete and locally validated; hosted rollout remains disabled.
Tracking: [Editable course outline #67](https://github.com/scothinks/project-ve/issues/67), [Recoverable staged course drafts #68](https://github.com/scothinks/project-ve/issues/68).

## Implemented journey

The course brief produces one separately quoted outline (57 credits), with one to
six lessons. Editors can change course/lesson titles and descriptions, add/remove
lessons and reorder with dnd-kit pointer/keyboard controls or move buttons. Outline
saves check a persisted revision. Unsaved edits retain their original revision even when background progress reads
see another editor's save; conflicts preserve local text and offer explicit reload.
Conflict responses also refresh the saved state directly, so reload does not depend
on timely progress-stream delivery.
Generated and edited outlines remain in workspace
AI results before a course exists; refinement creates a retained new version.

Outline generation reasons about the audience, intended outcomes and prerequisite
progression within the selected lesson count. Descriptions carry each lesson's
teaching contribution without requiring more authoring form fields. Lesson requests
receive the entire accepted outline and actual completed checkpoints, including on
retry. The provider receives bounded teaching excerpts (600 characters per page,
at most four pages per completed lesson), page types and block combinations to
build on earlier concepts without copying a fixed scaffold. No extra summarization
request is made.

Composition guidance chooses explanation, worked examples, comparisons, scenarios,
application and reflection when useful, using only existing concept/scenario/
reflection/summary page types and text/callout/table/optional-media blocks. The
one-to-four page and block limits are scope bounds, not quotas or mandatory page
sequences. Media briefs identify a specific instructional purpose. Exact copied
teaching under cosmetic heading/layout changes is rejected; different teaching
may reuse a useful layout. This deterministic check does not assess semantic
redundancy or certify pedagogical quality. Billable lesson/question scope and the
existing quote amounts are unchanged.

Editors explicitly choose zero to three questions per lesson. Saving the outline
and checking draft cost snapshots that scope; Generate accepts a separate quote.
The established course estimate is 100 base + 35 per unfinished lesson + 6 per
selected question in those lessons. Quotes expire after ten minutes and can be
refreshed. Changed outlines invalidate earlier draft estimates.

One existing durable job and reservation runs sequential lesson requests, at most
six 40-second text calls. Each provider start is lease fenced and persisted before
dispatch. Each validated lesson checkpoints its pages, optional media intents and
selected quiz questions. The shared authenticated stream/polling read exposes the
actual completed count, previews, reconnects and delayed-work messaging. There is
no fabricated percentage and no per-lesson browser listener.

Closing or navigating retains results. Failed/stopped drafts keep completed
lessons. Explicit retries create a separately quoted version containing those
checkpoints and request only missing indices. A provider outcome that is uncertain
cannot be automatically replayed. Stops settle the base and started calls; unused
lesson/question allocation is released. No child work is reserved twice.

Generation never inserts a course or approves/publishes it. Editors explicitly
save all completed lessons, including an explicitly labelled partial save. The
existing atomic row materializer is extracted into a private helper shared by
legacy leased jobs and the new authorized application RPC. The candidate,
application intent and durable receipt support concurrent requests, lost responses
and retries after confirmed rollback. Deleting an applied course never causes a
receipt replay to resurrect it. Organisation courses retain private catalog scope.

## Review and media compatibility

New courses use the normal Review page with an explicit review acknowledgement.
Review locks the course/content graph and expected lesson revisions, checks actual
teaching/quiz content, retains cover requirements and records reviewer attribution.
Publication is a separate atomic action through the existing lesson publication
and attached-asset integrity boundaries. It saves published lesson snapshots.

Course thumbnail/cover requirements can be resolved directly in Review using the
existing library/upload picker. Assignment checks registry permission, image type
and alt text and resets review. This creates a placement only when an editor
chooses artwork; text generation creates no media seeds, files, image jobs or image
credit reservations. Optional inline image/audio/video remains discretionary,
including legacy required flags. Empty placeholders remain absent for learners.
Old in-flight generation handlers and legacy result routes remain available.
Callout bodies use the existing sanitized rich-text renderer in previews and learner
delivery. Plain-text callouts remain supported; markup is rendered rather than
shown as literal tags, and unsafe HTML/URLs are removed.

## Local migrations

Apply after Phase 2, in timestamp order, without a reset:

- `20260906150000_ai_course_authoring_lifecycle.sql`
- `20260906160000_ai_course_atomic_application.sql`
- `20260906170000_ai_course_review_boundary.sql`
- `20260906180000_ai_course_scope_compatibility.sql`
- `20260906190000_ai_course_review_artwork.sql`
- `20260906200000_ai_course_review_locking.sql`
- `20260906210000_ai_course_recovery_consistency.sql`
- `20260906220000_ai_course_teaching_context.sql`

All are applied to the local test database. Corrections are forward migrations
because earlier migrations had already been applied locally. Generated public
RPC types are updated. Functions retain narrow authenticated/service grants;
private materialization, authorization and settlement helpers are not API callable.

## Validation

Following the [canonical testing cadence](codex/skills/project-ve-guardrails/SKILL.md),
focused validation runs after meaningful changes, then broader checks cover the
integrated course/page/lesson/media boundaries. New tests join existing CI suites.
No new standalone CI command is needed.

- Focused course/provider/worker tests pass; no real provider calls are made.
- 60 course pgTAP assertions pass: outline recovery, stale quotes/saves, checkpoint
  fencing, partial retry, atomic rollback/recovery, tenant ownership, credit release,
  optional media, required covers, explicit review and publication.
- Full database suite passes: 45 files / 1,259 assertions. Subsequent recovery,
  revoked-artwork and individual-lesson review changes pass the affected four-file
  course/lesson/page/RPC security batch (231 assertions).
- Full unit suite passes: 208 tests; seven subsequent route/readiness/revision/recovery/composition/rendering contracts also
  pass within their focused batches.
- Typecheck and lint pass. The final guardrail suite passes 30 checks. Generated
  database types match the local schema; later migrations do not change signatures.
- The teaching-context addition passes five focused unit tests and 107 database
  assertions across course/RPC security. Contrasting hand-authored lessons verify
  actual context transport, bounded excerpts, structure preservation, allowed
  layout reuse and rejection of copied/invalid teaching. These are contract checks,
  not evidence of actual model teaching quality. The final production browser batch
  passes all six scenarios: course creation/recovery, page authoring and lesson
  publication. Explanations, scenarios, comparison tables and reflection callouts
  retain their teaching through preview, atomic save and published learner delivery.
- The final course and callout rendering unit batch passes seven tests, including
  safe HTML, unchanged plain text and placeholder omission in learner delivery.

The integrated browser command covered `ai-course-authoring`,
`ai-assistance-authoring`, `ai-page-authoring`, `lesson-publication` and
`media-release`: 11 of 12 scenarios initially passed. It exposed a missing
`draft_revision` in the existing batched admin-lesson projection, which prevented
course review. The projection was corrected without adding reads. The affected
assistance/recovery scenarios passed; a subsequent course-only run passed both
scenarios, including stale-outline conflict preservation, publication and a lost
concurrent save response. The teaching-composition extension adds fixture coverage
to those same two course scenarios. Earlier passing page, publication and media
cases remain valid. The first composition run passed partial recovery; its full
course case timed out waiting for a streamed outline revision, before drafting.
The concurrency test now deliberately exercises real polling fallback, and save
conflicts directly refresh saved state. Visual inspection also found literal HTML
in callout bodies; that renderer was corrected and the final batch includes page
authoring and lesson publication because they share it. The intervening browser
build was stopped to incorporate that rendering fix and is not validation evidence.

Final focused commands for the teaching-composition extension:

```sh
node --experimental-strip-types --test tests/unit/ai-course-authoring.test.mjs
node --experimental-strip-types --test tests/unit/media-placeholder-rendering.test.mjs tests/unit/ai-course-authoring.test.mjs
node scripts/supabase-cli.mjs test db supabase/tests/database/ai_course_authoring.sql supabase/tests/database/rpc_security.sql
npm run typecheck
PROJECT_VE_E2E_KEEP_BUILD_CACHE=1 npm run test:e2e -- tests/e2e/ai-course-authoring.spec.ts tests/e2e/ai-page-authoring.spec.ts tests/e2e/lesson-publication.spec.ts
```

The final browser build also passes its production type/lint checks.

Focused ESLint also covers the changed provider/context/validation, fixture and
browser files. Browser tests use real local authorization and lifecycle RPCs with
intercepted provider-start fixtures, never paid calls or hosted credentials.

## Visual evidence

- [Course draft on mobile](evidence/ai-authoring-phase-3/course-mobile.png)
- [Recovered draft on mobile](evidence/ai-authoring-phase-3/recovered-mobile.png)
- [Explicit course Review](evidence/ai-authoring-phase-3/review-desktop.png)

The course previews and Review were visually inspected; callout markup now renders
correctly. The existing shared admin header extends beyond the 390-pixel viewport
in full-page captures; that shared-shell layout remains outside this extension.

## Rollout boundary

`AI_AUTHORING_PAGE_PILOT_ENABLED` remains default off. This is local product Phase 3,
not engineering P2 or Phase 4 media generation. No hosted migration/deployment,
reset, paid provider call, commit or push was performed. Hosted replay, live model
quality and latency, dispatch/outage behavior and rollout activation remain
separate checks requiring authorization.
