# AI authoring Phase 4 — contextual images

Date: 2026-09-06. Status: implemented and locally validated. Hosted activation remains gated.
Tracking: [Individual contextual images #69](https://github.com/scothinks/project-ve/issues/69).

## Implemented journey

The contextual image chooser offers the existing library/upload choices and an
explicit image-generation flow. Image briefs carry the placeholder purpose and
bounded lesson/page teaching context; edits and block style overrides autosave
with the existing draft. Newly saved block identities are reconciled before
quoting. Unsaved course settings prevent generation until the editor saves them.
GIF, audio and video generation remain outside scope.

Photography, realistic illustration, flat illustration, diagram/infographic and
custom direction have distinct prompt contracts. Palette and look-and-feel are
optional except for custom direction. Bundled UI examples make no provider call.
Editors can save a course default or use a block override. With no default they
must choose a style. Effective style, brief, alt text, caption, inferred shape and
target revision are retained in the quote; subsequent default changes cannot
mutate accepted requests or existing assets. Legacy fallback prompts no longer
force warm illustration aesthetics.

Checking cost is free. Generate explicitly accepts the existing 75-credit single
image estimate and creates one existing media job/reservation. A lease-fenced
provider-start checkpoint prevents automatic replay of an uncertain paid request.
The normal immediate dispatch and scheduled worker both recognize image jobs.
Progress uses the shared authenticated stream/poll fallback. It reports accepted,
creating, reconnecting/delayed, ready and failure states without invented percent
completion. Stopping before the provider releases credit; an image completed after
a stop request remains retained and is charged once.

The worker saves PNG bytes to managed private storage before a single transaction
registers the immutable version, links its authoring result and settles usage.
Ready never means a temporary provider URL. Image files are bounded at 10 MB; quote,
start and provider begin check that much available organisation storage. Actual
registration rechecks byte limits. Upload or registration failure is reported as
failure, without regenerating or showing an unsafe ready preview. Uncertain ready
responses never trigger file deletion or a second provider call.

Closing, navigation and refinement retain paid versions without automatic expiry.
The exact placement recovers its latest result in a focused read. All accepted
results remain discoverable in Courses AI results; Generated and Unused filters in
the chooser and media manager use the same registry versions. Explicit media
deletion retains the registry's reference protections and does not refund credits.
Hiding a result retains its registered image and accounting/application history.

Use image is a separate revision-checked transaction. It adds to the real block,
page cover, lesson cover or course artwork, preserving the registry's placement
checks and published snapshots. It resets editorial review instead of approving
or publishing. Concurrent use/replay returns one durable receipt. A stale draft
keeps its current edits and points the editor to the retained library image.
Lost responses recover Saved/Not saved/Checking save through the same result;
subsequent lesson autosaves reconcile the applied block instead of overwriting it.
Optional inline images remain entirely discretionary; existing cover requirements
and invalid/revoked attached-asset checks remain enforced.

## Local migrations and baseline

This isolated worktree started with a hash-verified snapshot of all 996 tracked
and untracked non-ignored files in the completed Phase 3 source checkout, including
its uncommitted work. The source checkout was not edited. Its finalized AGENTS.md
and README workflow/navigation changes were subsequently synchronized separately.
No commit or push was made.

Local migrations, applied in order after `20260906220000`, without a reset:

- `20260906230000_ai_image_authoring.sql`
- `20260906231000_ai_image_library.sql`
- `20260906232000_ai_image_job_type.sql`
- `20260906233000_ai_image_recovery_read.sql`
- `20260906234000_ai_image_apply_columns.sql`
- `20260906235000_ai_image_lesson_cover.sql`
- `20260906235500_ai_image_cover_compatibility.sql`

Corrections remain forward migrations because their predecessors were already
applied locally. Private tables/helpers retain default-deny access and new public
RPCs have explicit narrow grants and security classifications. Generated public
schema types have been updated and parity checked.

## Validation

The [canonical testing cadence](codex/skills/project-ve-guardrails/SKILL.md) applies.
New unit, database and browser files run under existing CI commands.

- Full unit suite: **224 passed**, including seven focused style/worker contracts
  and the saved-application receipt/cache failure boundary.
- Guardrails: **32 passed**, including constant-operation contextual recovery.
- Full database regression: **46 files / 1,308 assertions passed** before the
  final cover compatibility adjustment. The affected image/course/RPC suite then
  passed **151 assertions**; final expanded image coverage passed **49 assertions**.
  These cover permissions/revocation, quote expiry and style snapshots, single
  reservations/charges, stop, durable registry retention/discovery, protected
  deletion, exact recovery, atomic/stale use and all supported cover destinations.
- Final production browser batch: **4 passed** (contextual image lifecycle and
  three media release scenarios). The preceding page-authoring batch also passed
  all three page scenarios; the existing media-picker case passed in the initial
  integrated batch. The image fixture verifies widths 1280/390, style persistence,
  no generation before acceptance, closing/reopening, stored preview, lost apply
  response recovery, later autosave preservation and AI results recovery.
- Typecheck, lint, generated-type parity and `git diff --check`: passed.
- Screenshots: [desktop cost](evidence/ai-authoring-phase-4/image-cost-1280.png),
  [mobile cost](evidence/ai-authoring-phase-4/image-cost-390.png),
  [mobile retained result](evidence/ai-authoring-phase-4/image-ready-mobile.png).
  These are scrollable drawer captures; transient save notifications appear in
  the cost views. The retained preview uses a one-pixel deterministic PNG and
  intentionally disconnected stream to exercise polling recovery, so it is
  lifecycle evidence, not generated artwork quality evidence.
- Browser logs reported unavailable external Unsplash assets in existing media
  fixtures; all four final scenarios passed. No paid provider was invoked.

Validation commands: `npm run test:unit`, `npm run test:guardrails`,
`npm run typecheck`, `npm run lint`, `npm run test:db`, focused
`node scripts/supabase-cli.mjs test db` calls, generated-type parity, and
`PROJECT_VE_E2E_KEEP_BUILD_CACHE=1 npm run test:e2e -- tests/e2e/ai-image-authoring.spec.ts tests/e2e/media-release.spec.ts`.
The E2E command includes a production build. Existing CI commands discover the new
tests; no new standalone gate was needed.

The [Phase 4 delta](evidence/ai-authoring-phase-4/changed-files.txt) lists files
changed relative to the verified Phase 3 snapshot; the ordinary Git diff also
contains the inherited uncommitted Phase 1–3 baseline.

## Rollout boundary

`AI_AUTHORING_PAGE_PILOT_ENABLED` remains default off. No hosted migration,
deployment, database reset, paid provider call, commit or push was performed.
Deterministic fixtures verify lifecycle and prompt contracts; they do not certify
actual photographic/illustration quality, pedagogical correctness or latency.
Representative real images across styles require a separately authorized capped
budget before release. Hosted dispatch/outage, reconciliation, rollout and broader
Phase 6 qualification remain separate evidence. Phase 5 legacy migration/cutover was subsequently completed locally; see
[Phase 5 evidence](ai-authoring-phase-5.md). Engineering P2 remains closed. Release follow-ups remain
[#63](https://github.com/scothinks/project-ve/issues/63) (hosted pilot),
[#62](https://github.com/scothinks/project-ve/issues/62) (media release) and
[#71](https://github.com/scothinks/project-ve/issues/71) (full qualification,
including capped real-output inspection).
