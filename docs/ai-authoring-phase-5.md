# AI authoring Phase 5 — review and legacy cutover

Date: 2026-09-06. Status: implemented and locally validated.
Tracking: [Legacy briefs and obsolete entry points #70](https://github.com/scothinks/project-ve/issues/70).

## Implemented behavior

Earlier media briefs map to their actual course covers, lesson covers, page covers
or blocks using explicit identities and exact existing managed-asset links.
The migration does not guess from titles. Empty optional briefs become contextual
placeholders; audio and video retain their type. Ambiguous and conflicting
placements remain available for an editor to resolve in **Earlier media and
pending requests**. Repeated mapping does not duplicate blocks or revise an
already mapped draft. A protected audit retains the complete original row and
mapping outcome. Lesson-only rows receive their exact course parent, with the
original null parent preserved in that audit.

Mapping preserves selected assets, approvals and published snapshots. It does not
start generation, reserve credits or publish content. Draft changes remain drafts.
Existing media work delays mapping until it completes or is cancelled. The new
workspace uses one scoped read-only projection and offers explicit mapping,
contextual editor links and the shared cover picker; provenance stays readable
without restoring the old technical form.

Queued legacy batches require **Continue earlier request** or **Cancel earlier
request**, including unattempted jobs inserted by an older application during a
rolling deployment. Continue uses the original reservation. Cancel before any
attempt releases it. Already attempted or provider-started work is conservatively
charged using the existing reconciliation policy, with matching usage and job
ledger fields. Decisions are idempotent and permission checked. Running jobs keep
their leases and result compatibility. Previously accepted work can continue when
the new-start rollout switch is off.

Legacy courses and lessons now use explicit, actor-attributed Review and Publish
with the same locked revision, registry, cover and quiz checks as current drafts.
Review approves existing populated media; empty inline image/audio/video briefs,
including old required flags, do not impose a generation quota. Missing required
covers, invalid attached assets, revoked access and stale revisions still block
publication. The shared library/upload/AI chooser handles course and lesson covers.

The settings media grid, unused lesson media section and obsolete bulk-media form
actions are removed. Non-media settings remain. Readiness links lead to Review
artwork, the actual page/block or the retained earlier-brief card. Mobile header
controls wrap within the viewport. Stored legacy text-generation flows and media
workers remain available for previously accepted work.

## Database and compatibility

The new forward migration sequence is `20260907010000` through `20260907017000`:
legacy mapping and private audit, queued-job choices, shared review cutover,
SQL type/error corrections, rolling queue protection, cancellation accounting,
and the final lesson-only mapping/backfill. The data backfill runs at the end of
the sequence, after the corrected helper definitions. No pre-existing historical
migration was rewritten. Generated public database types match the local schema.

No RLS policy or broad API grant was added to the private audit/choice tables.
Supported public RPCs enforce existing course/editor and media permissions; the
HTTP route uses the normal admin identity and private, no-store responses.

## Validation

- Full unit suite: **229 passed**. Includes current resolution links, retired
  entry points, accepted worker compatibility and legacy readiness.
- Guardrails: **34 passed**, including a single scoped read with no worker
  dispatch and continuation while new starts are disabled.
- Full database regression: **47 files / 1,357 assertions passed** before the
  final lesson-only backfill correction and six added assertions. The final
  affected legacy/course/image/RPC security batch passed **205 assertions**,
  including **49** focused legacy checks. Coverage includes original rows,
  published snapshots, repeat-safe mapping, explicit ambiguity resolution,
  cross-course/outsider rejection, required covers, old running-job recovery,
  and real organization reservation/charge/release accounting.
- Production browser coverage: both existing course-authoring scenarios passed;
  the integrated contextual-image and legacy-cutover rerun passed **2 tests**.
  The final legacy-only run also passed (**1 test**) and captured desktop/mobile evidence. The legacy case
  covers queued work, explicit cancellation/mapping, contextual links, preserved
  published content, shared artwork controls, Review/Publish without a seed batch,
  no provider starts, and learner rendering without empty placeholders.
- Typecheck, lint, generated-type parity and whitespace checks passed.

Commands: `npm run test:unit`, `npm run test:guardrails`, `npm run typecheck`,
`npm run lint`, `npm run test:db`, focused `node scripts/supabase-cli.mjs test db`
for the four affected files, and `PROJECT_VE_E2E_KEEP_BUILD_CACHE=1 npm run test:e2e
-- tests/e2e/ai-legacy-cutover.spec.ts tests/e2e/ai-image-authoring.spec.ts`.
The browser runner builds the production application. Existing CI discovers the
new unit, database and browser files; no standalone gate was introduced.

The first browser batch exposed mobile header overflow and an image-test cleanup
assertion that masked an earlier drawer-opening timeout. The header now wraps;
the image case exercises keyboard activation and checks deletion protection only
after the image has actually been applied. The affected cases passed on rerun.

Screenshots: [mobile legacy mapping](evidence/ai-authoring-phase-5/legacy-media-mobile.png)
and [desktop Review](evidence/ai-authoring-phase-5/legacy-review-desktop.png).
Media fixtures use a deterministic tiny PNG; these demonstrate workflows, not
actual image generation quality. The [Phase 5 delta](evidence/ai-authoring-phase-5/changed-files.txt)
records changes against the inherited Phase 4 workspace snapshot. The ordinary
Git diff also contains earlier uncommitted implementation work.

## Release boundary

`AI_AUTHORING_PAGE_PILOT_ENABLED` remains default off. No hosted migration,
deployment, database reset, paid provider call, commit or push was performed.
Local migration application and tests do not establish hosted cutover/concurrency,
provider output quality, dispatch latency or outage behavior. Phase 6 is not begun.
Engineering P2 remains closed. Existing follow-ups remain
[#63](https://github.com/scothinks/project-ve/issues/63) (hosted pilot),
[#62](https://github.com/scothinks/project-ve/issues/62) (media release), and
[#71](https://github.com/scothinks/project-ve/issues/71) (release qualification,
including separately authorized capped real-output evaluation).
