# AI authoring experience redesign

Status: Phase 1 implementation closed and locally verified; verification and rollout
evidence in [Phase 1 page pilot](ai-authoring-phase-1.md). Phase 2 is implemented and locally validated; see [Phase 2 evidence](ai-authoring-phase-2.md). Phase 3 is implemented and locally validated; see [Phase 3 evidence](ai-authoring-phase-3.md). Phase 4 is implemented and locally validated; see [Phase 4 evidence](ai-authoring-phase-4.md). Phase 5 is implemented and locally validated; see [Phase 5 evidence](ai-authoring-phase-5.md). Phase 6 implementation and local validation are complete; see [Phase 6 evidence](ai-authoring-phase-6.md). Hosted activation and capped real-output qualification remain pending.
The approved course-setup follow-up adds [guided idea/audience discovery and upfront pricing](ai-course-journey-improvement-plan.md); see its [implementation evidence](ai-course-guided-journey.md) for local checks and remaining rollout conditions.
Owner context: Project VE editorial/CMS experience.
Date: 5 September 2026.

## Product decision

AI helps an editor create and refine a draft in the place they are working.
Generation has a visible beginning, progress, result and next action. Media is
an optional, separately requested activity with a user-controlled style and a
clear credit cost.

This applies equally to a course, additional lessons, a lesson page, quiz
questions and an individual image. It replaces the old disconnected AI screens,
bulk-media workflow and job notices. It does not replace the durable job engine,
organisation metering, media registry or editorial publication boundaries.

The intended interaction is:

**Describe → adjust → see cost → generate → watch progress → review → use or refine.**

Authoring continues through **Pages → Quiz → Values → Review**. AI assistance is
part of those steps, not a second editorial lifecycle that an editor must learn.

## Starting point

The source audit shows that course text generation already seeds media briefs
without directly creating image files. The redesign builds on that separation:
remove default required-image quotas and the separate bulk-media journey, turn
briefs into editable placeholders, and ensure no text path can implicitly enqueue
image work. The general image picker is currently a placeholder while a separate
brief-based picker is connected; these converge into one working experience.

## Confirmed requirements

- Generate course/lesson structure, relevant text and purposeful media placeholders.
- Do not generate images, reserve image credits or start image jobs as a side
  effect of course, lesson, page or quiz generation.
- Let an editor fill a media placeholder from the library, an upload or AI.
- Let editors control visual style; remove the forced warm/brown/cartoon direction.
- Show progress and completed results in context for every generation operation.
- Show costs before generating; preserve work on errors, retries and navigation.
- Retire the course settings image grid and its technical media-brief fields.
- Retain explicit editorial review and publishing, permissions and usage accounting.

The touchpoint inventory is [AI experience touchpoints](ai-experience-touchpoints.md).
This is a bounded product extension under the CMS remediation plan, not P2
query/index tuning or a reopening of the completed organisational architecture.
The P1.5E metering, leases, retries, reconciliation and entitlement rules remain
mandatory.

## Target editor journeys

| Operation | Setup | Visible generation | Result and next action |
| --- | --- | --- | --- |
| New course outline | Topic/learning need, audience, tone and intended size | Planning your course | One editable outline. Edit titles, reorder, add/remove lessons, then generate the draft. |
| Course draft | Accepted outline; explicit choice whether to include quizzes; item counts and text-generation cost | Writing lessons, checking questions where selected, preparing your draft | Completed lesson previews appear as validated results become available. Open the saved draft in the curriculum. Images remain placeholders. |
| Additional lessons | Focus/gap, intended number and audience level | Planning lessons, writing the selected lessons | Review suggestions, select which to draft, then add completed lessons. Existing lessons remain intact. |
| Lesson page | Lesson context; optional direction only. Infer topic, page type and placement. | Considering what helps next; one quoted request includes recommendation and draft. | Explain the recommendation; Add page, refine or dismiss. Suggest reviewing the quiz when no useful page is needed. |
| Quiz question(s) | Focus, question type and count; a small default scope | Writing questions, checking answers | Review prompts, answer keys and explanations. Add selected questions or refine. |
| Image | Description, selected style, shape inferred from the block and cost | Creating your image, preparing preview | View image, caption/alt text; Use image or explicitly request a new version. |

The course flow generates one outline by default, rather than paying for three
and showing one. Additional alternatives require a deliberate request. Keep the
brief and editable outline when returning to an earlier step. Quote outline and
full-draft generation separately so the handoff does not hide a second charge.
Quiz inclusion is visible before course generation; when excluded, do not call
the question generator. When included, its cost is part of the accepted estimate.

Only controls meaningful to an editor belong in setup. Model names, worker IDs,
placement keys, raw JSON, seed terminology and generation-status enums remain
internal. Use task-specific actions such as **Generate page**, **Generate
questions**, **Generate image**, **Add page**, and **Use image**. Use the existing
CMS components, spacing and accessible dialogs; avoid a separate purple workflow
or repeated AI disclaimers throughout the editor.

## Media placeholders and image style

### Placeholder behavior

A placeholder explains the visual’s purpose, for example “A diagram showing the
three levels of government”. It offers **Choose from library**, **Upload**, and
**Generate with AI** in the block. The supported choices respect the workspace’s
media and AI entitlements. A blocked AI option includes a short explanation while
library/upload remain usable where permitted.

Use the existing image/block and course-cover structures with a versioned media
intent payload: purpose/description, supported media kind, aspect ratio,
optional/required designation and style inheritance. Preserve stable block IDs.
A placeholder has no fabricated URL, no generated asset and no image-credit
reservation. It must not be disguised as a failed image.

The AI acts as an assistant: opening image generation carries the placeholder’s
purpose and lesson/page teaching context into an editable brief. Editors do not
start from a blank prompt. Preserve their changes with the block, including after
closing the picker or reloading. Brief preparation makes no paid request; style
selection and explicit cost acceptance remain separate generation steps.

Generate a placeholder only where a visual adds instructional value. Remove the
legacy quota of mandatory image/infographic seeds per lesson. Do not insert one
on every page or add a hero illustration simply to satisfy an AI readiness flag.
New AI-suggested placeholders are optional by default; inline visuals remain entirely at the editor’s discretion, including legacy required flags. An editor may omit an optional image without paying
for generation. The assistant can help improve text that refers to an omitted visual, but this is not a blocking validation.

Course/lesson covers use the same media chooser in their normal editing location.
Keep a media library for finding and managing assets. Remove the old course
settings grid for generating or reviewing all seeded images.

### Style controls

- Offer a compact set of distinct presets: Photography, Realistic illustration,
  Flat illustration and Diagram/infographic, plus a plain-language custom direction.
- Expose an optional palette and short “Look and feel” instruction. Show these as
  editing choices, not raw model prompts. Preset examples should be bundled UI
  assets; browsing styles must never trigger paid generation.
- Allow a course default through a small **Image style** control in course
  settings/the image chooser. Each block can follow that default or override it.
- With no course default, ask the editor to choose a style in the generation
  setup; do not silently apply a universal brown/cartoon treatment.
- Resolve and snapshot the effective style when the editor accepts the quote.
  Changing a default affects future requests only. It never regenerates existing
  images, mutates an in-flight request or changes approved assets.
- Keep representation, accessibility and content-safety requirements separate
  from aesthetic defaults. In particular, remove conflicting “warm educational
  illustration” instructions from prompt builders and fallback briefs.
- Reusing a generated image elsewhere reuses its asset/version; changing one
  placement’s style does not regenerate other placements.

Initial generation scope remains images/infographics. This plan does not add AI
video, audio or GIF generation. Existing permitted uploads/library types remain.

## Visible generation, not an invisible queue

### Shared interaction contract

Every operation uses the same underlying status/result contract with an
appropriately sized surface: course workspace for a full course; an editor panel
or dialog for pages/questions; the media block’s chooser for images.

| State | Editor sees | Available action |
| --- | --- | --- |
| Setup / estimate | Inputs, scope and credit estimate | Generate or cancel setup |
| Accepted / starting | Immediate acknowledgement and retained inputs | Stay and watch; optionally leave and return |
| Generating | Real stage and completed-item count where known | Stop remaining work; continue elsewhere if desired |
| Taking longer / reconnecting | Honest delay/reconnection message and last confirmed progress | Keep waiting, return later, or stop where supported |
| Result ready | Persisted, validated preview; “Not added yet” for an unapplied result | Use result, refine or close; closing keeps the result |
| Applying | “Saving…” and the target draft | Leave and return safely; prevent duplicate application; no Stop or Cancel action |
| Application outcome | “Saved” with a link to the content, “Not saved” with a reason, or “Checking save…” while uncertain | Open saved content or resolve a confirmed failure; reconcile uncertain outcomes before retry |
| Partial result / failure | What completed, what did not, and the credit outcome | Keep/use valid completed work or retry the unfinished part |
| Stopped | What was retained and what was charged/released | Return to draft or start a new request |

Do not invent percentages, simulate typing as provider progress, or promise an
ETA the system cannot substantiate. “3 of 6 lessons ready” appears only after
three valid results are durably checkpointed. For a single image call with no
provider progress, show an honest creating stage and elapsed activity, then the
actual result. A stalled worker is not presented indefinitely as healthy work.

A persistent spinner alone does not meet the requirement. Generation must end in
a visible result/failure state; the editor must not be sent to a listing with an
opaque job ID. Announce stage changes and results accessibly without announcing
every streamed token. Respect reduced motion and retain keyboard focus.

### Where results live and how editors return

Results are durable workspace-owned records linked to the operation, source
revision and intended target. Store validated outlines, text candidates, completed
lesson checkpoints and image references on the server, not solely in a dialog,
browser storage or an expiring provider URL. Operational job-log cleanup must not
delete these records or application receipts.

- Provide **AI results** in the Courses workspace, with the same panel filtered to
  the current course/lesson from its editor. Show a count of results not yet added.
  A course outline without a course ID is discoverable from Courses immediately.
- List results by recognizable title, content type, creation date and plain status
  such as **Not added yet** or **Added**. Reopening restores the preview, versions,
  credit outcome and next action. This is a recovery surface; normal generation
  still completes in context without redirecting the editor to a queue.
- Generated images also appear in the existing media library under **Generated**,
  with an **Unused** filter. Both surfaces refer to the same asset/version. Persist
  the actual file in managed private storage and register its ownership before
  calling it ready. If persistence fails, show recovery in progress or a failure;
  do not present a transient preview as a safely retained paid image.
- **Initial retention policy: no automatic expiry.** Unapplied results, partial
  results and earlier refinement versions remain until explicitly deleted by an
  authorized editor, subject to existing workspace deletion, access and retention
  obligations. Closing, navigating away, refining or applying a newer version
  does not delete an earlier result. Applying records where it was used.
- Deletion is a distinct action with a clear explanation; it does not refund
  generation. Referenced assets remain subject to registry deletion/withdrawal
  protections. Deleting a text candidate must not delete content already added
  to a draft or erase usage history and application receipts.
- Check applicable storage/result limits before accepting generation. A full
  workspace requires an explicit resolution; never silently evict paid results.
  Any future automatic-expiry policy needs a separate product decision, visible
  dates and notice before it affects stored work.

Permissions are checked on every recovery read and mutation. Losing access removes
access to the result too. If its original target was deleted, retain the result in
the workspace results panel/library for authorized editors, explain the missing
target and require an explicit permitted destination to reuse it. Never resurrect
the target. Use paginated, focused summaries and batched reads, not a full content
graph or one query per result.

### Execution and delivery

Reuse the durable queue, idempotency, worker leases and metering. Add prompt
worker dispatch/wake-up on accepted requests through a trusted server mechanism;
a spinner over a slow periodic worker is not a solution. Validate dispatch in the
hosted environment, including worker outage handling, before rollout.

Persist sanitized progress events/checkpoints against existing jobs. Use a
focused, authenticated status/result read model and an SSE stream with cursor
resume, with bounded polling as a fallback. A single course operation shares one
stream; do not create a listener/query per lesson or block. Reconnects read the
latest durable state rather than creating new work. GET/status/render paths are
read-only. Existing worker credentials never reach the browser.

Progress should be acknowledged immediately after acceptance. Proposed healthy-
system targets are acknowledgement within two seconds and worker-stage visibility
within five seconds, excluding provider completion time. Validate these targets
with measurements; surface dispatch delays honestly rather than hiding them.
Track time to first result and total completion for each operation before setting
provider-dependent expectations.

The current course generator returns a whole structured response before
materialization. Showing genuinely completed lessons therefore needs real staged
outputs, not a client animation. Use sequential/bounded lesson checkpoints under
the existing course operation, retaining the accepted outline/context. Checkpoint
validated results; materialize the canonical course tree through the existing
atomic boundary once complete. Before then, show checkpoint previews, not partly
published entities. On partial failure, offer to save only the valid completed
lessons explicitly. Retry only unfinished checkpoints, within the accepted scope
and accounting policy. Do not introduce a second job platform or unbounded
fan-out merely to provide progress.

## Draft safety, result application and review

1. Save and reconcile relevant editor changes before quoting/generating. Explain
   any save failure inline and retain inputs. Generation uses that saved revision.
2. Store the target, source revision, accepted options and style snapshot with
   the operation. Distinguish an intentional new generation from a network retry.
3. For additions/replacements in an existing course, stage candidates first.
   Generation must not append or replace editable content before the editor sees
   the result and chooses to use it. Preserve a previous candidate during refine.
4. Applying a result is an idempotent, authenticated, revision-checked mutation.
   A double-click adds once. A stale target shows a conflict with choices to keep
   current edits or regenerate against the latest version; it never overwrites
   newer work. Deleted/moved targets cannot be silently recreated.
5. A brand-new course can be saved as a draft after its accepted generation
   completes; show the finished result with **Open draft**. It is never published
   or approved automatically.
6. Add/replace media through the existing registry and placement authorization.
   Generated images are owned by the initiating organisation/workspace, with
   immutable versions and existing access, reuse, withdrawal and revocation rules.
   A candidate cannot silently replace an approved published reference.
7. Keep the unified Review step. It shows human-readable content/media issues and
   links to the exact page, question or block. Applying a candidate is not the
   same as editorial approval. Required review attribution and publication checks
   remain server-enforced.

### Stop, close and save are separate actions

Track generation, candidate availability and application as separate lifecycles.
Generation can be completed while a candidate is still **Not added yet**. A failed
application does not change a completed generation into a failed/free operation.

| Action | Meaning | Content and credit outcome |
| --- | --- | --- |
| Cancel setup | Leave before accepting Generate | No generation starts and no reservation is made. |
| Stop generation | Request that remaining provider work stop | Best effort; retain completed results and settle started work. Show Stopping until acknowledged. |
| Close a ready result | Dismiss the preview without using it | Result stays in AI results/library. No application, deletion, refund or new provider call. |
| Refine / create another version | Accept a separately quoted generation request | Keep the earlier result available, even if the new request fails. |
| Add / Use | Submit the selected result for application | Save once to the authorized draft target. No new generation or AI credit charge. |
| Navigate while saving | Leave a submitted application running | Preserve its durable outcome; navigation is not a cancellation request. |

Before Add/Use is submitted, the editor can change their selection or close without
saving it. After the server accepts application, offer no cancel/stop control:
finish or fail the save atomically. Record an application identity, candidate and
target revision, then commit the content change and success receipt together at
the existing atomic boundary. Repeated requests with that identity return the
same outcome instead of inserting again. New-course materialization uses the same
save-outcome contract even though it follows generation automatically.

On refresh, navigation, a lost response or a second tab, look up that receipt:
**Saved** links to the resulting content; **Not saved** reports a confirmed failure
or conflict and keeps the candidate; **Checking save…** covers an unresolved
outcome. Never infer “Not saved” from a network timeout or issue a fresh application
while the earlier one is uncertain. Retry with the same identity only after safe
reconciliation. Once saved, any removal or replacement is a separate normal
editorial action, subject to its usual permissions, and does not undo the charge
for generation. Show application status separately from pending credit settlement.

### Readiness compatibility

Readiness must assess actual content and placements, not whether an obsolete
mandatory AI media batch has finished. Optional placeholders can be omitted;
existing cover requirements and invalid/revoked attached references remain enforceable. Inline media presence never gates review or publication, including legacy required flags. Empty placeholders, internal briefs and style prompts never render
for learners. Implement this narrowly across readiness, AI status derivation and
publication checks; do not disable validation generally to let text-only content
through. Preview remains free of learner attempts, progress and XP writes.

Minimum compatibility is a **Phase 3 release prerequisite**, alongside course
drafting: update readiness, AI status derivation, server publication checks and
learner omission of optional placeholders together. New drafts must complete
Review and publish after their actual content and required reviews pass, without
an image batch or a visit to the old settings grid. If a Phase 1/2 flow produces
the new placeholder payload earlier, bring this compatibility into that flow's
release gate too. Phase 5 handles remaining legacy migration and UI retirement;
it must not be the first phase in which new drafts can pass review.

## Credit and retry contract

- Show a server-calculated estimate and the scope it covers before each paid
  operation. Reserve through the existing organisation ledger only after Generate.
- Tie quote validity to workspace, operation, source revision, item count, style
  and quality parameters. Recalculate changed/expired quotes before starting.
- Plan hidden text-validation/model-review calls into the accepted text estimate.
  Placeholder descriptions are text work; they do not reserve image credits.
- Reserve the accepted operation envelope once, checkpoint/reconcile provider
  usage within it, and release unused allocation according to existing policy.
  Do not reserve both a parent’s full estimate and the same child work again.
- Do not start additional provider work beyond the accepted budget envelope
  without a new user-visible decision. Recheck entitlements, limits, lease and
  reservation immediately before provider work.
- Network retries and reconnects reuse the same operation/idempotency key. An
  intentional new variant is a new request with its own visible cost. Automatic
  retry must not repeat a completed provider call or charge twice for one logical
  operation; uncertain outcomes are reconciled before replay.
- Stop before provider work releases the reservation. Stop during provider
  work is best effort: stop remaining work, preserve completed outputs and settle
  started work under the existing failed/cancelled-job policy. Say **Stopping…**
  until that outcome is known; never promise that closing a dialog avoids charges.
- A completed generation is settled independently of whether the editor uses,
  closes or deletes its result. Closing a ready result and navigating during
  application never call the generation-stop or reservation-release endpoint.
- Show plain-language settled outcomes: credits used, released or still being
  confirmed. Do not claim every failure/retry is free. Costs depend on whether
  provider work occurred and the accepted reconciliation policy.
- Library selection, upload, changing style and inspecting a candidate do not
  consume AI credits. Existing storage/asset permissions and limits still apply.
- Platform catalogue exemption from organisation metering must be described
  accurately; provider work still has an internal cost. Do not invent an AI wallet
  or a separate privilege system.

## Implementation workstreams and code ownership

Keep route handlers/components thin and split by responsibility. The following
are proposed contracts and locations, not existing shipped APIs.

| Workstream | Existing code to reuse/change | Deliverable |
| --- | --- | --- |
| Operation lifecycle | `features/ai-generation/data/jobs.ts`, application job requests/orchestration and worker endpoint | Versioned progress/checkpoints, prompt dispatch, safe status/event/result projection, stopping and recovery on existing jobs |
| Quote/accounting | `organization-ai-metering.ts`, entitlement guards and existing reservation/reconciliation RPCs | Quote/start agreement, bounded provider scope, clear credit outcomes, no duplicate reservation |
| Shared generation UI | Focused new admin generation components; existing dialogs/selects/pending primitives | Setup, progress, result, error and reconnect surfaces; contextual AI results recovery and distinct generation/save outcomes |
| Text candidates | `course-text-jobs.ts`, `lesson-page-jobs.ts`, `quiz-question-jobs.ts`, generated-tree and planner modules | Single editable outline, text-only generation with purposeful placeholders, staged candidates and safe apply |
| Media/style | `MediaPickerProvider`, `MediaPickerScreen`, media registry; `ai-media-generator.ts`, media planning | One working chooser; course defaults/block overrides; single-image generation and use/versioning |
| Review/retirement | Lesson review, course readiness/finalization, settings/media workspace, pending actions | Content-based readiness, exact resolution links, removal of the old bulk-media UI and unreachable legacy controls |

Proposed server contract: estimate; start; read status/events; list/read candidates;
apply selected result; read application receipt; stop generation; delete a
candidate through authorized retention rules. Responses expose progress, target,
result references, recoverable errors and credit state. They do not expose raw
provider prompts, secrets, stack traces or another tenant’s content. Only callers
with current authoring access can start/apply/stop/delete; scope read access to
the operation’s workspace and editor role. Revalidate relevant editorial caches
on supported mutations, never during status reads.

Schema/RPC work should be additive and focused: progress/checkpoint/result
metadata on existing jobs, durably retained candidate references/version lineage,
target revisions/application receipts, versioned style configuration and placeholder
metadata. Candidate retention must be independent of job-log pruning. Reuse the
media registry for image files and versions. Typed generated database contracts and
RLS/RPC tests accompany changes. No broad grants or service-role browser APIs.

## Delivery sequence

| Phase | Scope | Exit condition |
| --- | --- | --- |
| 1. Shared foundation and page pilot | Quote/start/status/result/apply; prompt worker dispatch; durable candidate retention and AI results recovery; application receipts; distinct stop/close/save states; assistant-led suggestions grounded in teaching content, inferred placement and a no-page quiz-review outcome; one complete page-generation flow with purposeful optional media placeholders and minimum publication/rendering compatibility | A page can be generated, watched, closed, rediscovered and added once on desktop/mobile. Failure, refinement, reconnect, stale edits and navigation during saving preserve a clear outcome. Proves the pattern before expanding it. |
| 2. Quiz and lesson assistance | Reuse the same experience for questions and additional lessons; preserve inputs; explicit selection/application | No redirect-to-queue notices or automatic insertion in these flows; all pending/ready/error states are usable. |
| 3. Course drafting and readiness compatibility | Editable single outline; explicit quiz scope; staged lesson progress; text plus placeholders; partial-result recovery; compatible readiness/AI status/publication checks and learner rendering | Full course creation uses zero image provider calls/reservations. New optional-media drafts can complete Review and publish after actual content/review checks pass; existing cover requirements and invalid attached references remain enforced. Learners never see empty placeholders. |
| 4. Contextual media and style | One picker, library/upload/AI choices, style defaults/overrides, quote, image progress/result and use; durable paid-image storage and discovery in results/library | Working image generation in a real block with different styles. Closed and superseded paid images remain available under the retention policy; no charge merely from changing style or using a result; registry/access rules intact. |
| 5. Review and legacy cutover | Complete legacy brief migration and remaining seed-gate retirement; relocate legacy resolution links; retire old settings grid/actions UI | Existing drafts and published content work alongside new drafts, whose readiness compatibility already shipped in Phase 3. No blocker points to a removed screen. |
| 6. Release hardening | Usage reconciliation, cancellation, concurrency, worker outage, accessibility, supported hosted smoke checks | Acceptance matrix passes and telemetry confirms dispatch/completion behavior; rollout evidence recorded. |

Phase 3 implementation also carries audience, outcome and prerequisite progression
into the outline and uses bounded completed teaching in subsequent lesson requests.
Page types and block combinations follow teaching intent rather than repeated
scaffolds or mandatory variety quotas. The existing page/lesson limits and explicit
quiz/cost scope remain unchanged. Contrasting deterministic compositions must
survive preview, saving and learner rendering; live model pedagogical quality
remains a separate evaluation requiring authorization for provider calls.
See [Phase 3 evidence](ai-authoring-phase-3.md) for local validation status.

Use the existing deployment/feature-availability mechanism if one exists; otherwise
add one scoped rollout switch for this experience. Keep old routes/assets readable
during transition. Do not expose half a new journey whose next step is still the
old queue notice or nonfunctional media tab. Roll out the first complete page
pilot behind the switch, then expand coverage; remove the old paths only after
their replacements meet the gate.

No delivery dates or live model prices are assumed here. Implementation can begin
with Phase 1 without further product clarification; subsequent phases depend on
its tested contracts.

## Existing content and in-flight work

- Preserve all current course/lesson IDs, authored content, published snapshots,
  media references, approvals, assets and usage history.
- Map legacy media briefs to their real target blocks/covers. Existing populated
  assets remain selected. Empty optional briefs become placeholders with no
  generation side effect. Keep provenance available to admins without exposing
  the old technical form to editors.
- Report ambiguous/unmapped legacy briefs for explicit resolution rather than
  guessing a placement or deleting them. Mapping must be idempotent and auditable.
- Version job behavior. Already-running work keeps its lease, accounting and
  result compatibility; surface its status in the new view. Expose queued legacy
  bulk-media work for explicit continuation/cancellation, with its reservation
  state, rather than silently starting a new batch during migration.
- Redirect old media/settings entry points to the corresponding course or block
  control. Keep non-media course settings, credits and the media library.
- Remove unused old AI components and obsolete form actions only after import,
  route, pending-job and backward-compatibility checks. Do not delete database
  history as UI cleanup.
- Rollback disables new starts while preserving/resuming accepted operations,
  settled usage and stored results. It must not restore public legacy media URLs
  or bypass draft/publication checks.

## Acceptance and release tests

| Scenario | Required evidence |
| --- | --- |
| Every entry point | Course, lesson expansion, page, quiz and image each cover setup, cost, starting, progress, ready/use, failure/retry and reconnect. No job IDs or worker terminology in ordinary UI. |
| Course economy | Provider spies prove zero image calls/reservations during outline/course/lesson/page/quiz generation; one outline by default; no hidden alternatives or unchecked quiz scope. |
| Visible progress | Stages correspond to persisted events. Healthy dispatch targets measured; stalled/unavailable workers show delay/error recovery. Completed work survives refresh. |
| Draft safety | Unsaved edits save before generation; failed saves stop generation. Double start/apply, stale revisions, changed/deleted targets and simultaneous tabs cannot overwrite or duplicate content. |
| Results and partial failure | Close, navigate, refresh and reopen through Courses/contextual AI results, including an outline with no course ID. Failed refinement preserves earlier versions. Job-log pruning does not remove candidates or receipts; results for deleted targets remain recoverable without resurrecting those targets. Retrying unfinished course work does not regenerate completed lessons. |
| Paid-image retention | Ready means the file is durably registered, not just a provider URL. Unused and earlier versions remain discoverable in the library/results without automatic expiry. Test storage failure/limits, explicit deletion, protected referenced assets and revoked access. No dismissal/deletion refund. |
| Application recovery | Close before Add/Use leaves the draft untouched. Navigate/refresh/lose the response during apply and recover Saved, confirmed Not saved, or Checking save. Concurrent/retried requests insert once with an atomic receipt. No stop/release call from closing a result or navigating during save. |
| Media choice | Library/upload use no AI credits. Placeholder targets, alt text, aspect ratio and selected versions persist. No fake URLs or empty placeholders reach learners. |
| Style | Presets/custom direction produce distinct prompt contracts; course defaults and overrides resolve correctly; a style change alone causes no provider call or existing-image replacement. Inspect representative real outputs with a capped, explicitly authorised test budget before release. |
| Review (Phase 3 gate) | A newly generated optional-media course completes Review and publishes without generating images or completing legacy seed batches; explicit review attribution remains required. Existing cover requirements and invalid attached references remain enforced, every blocker resolves in context, and learner rendering omits placeholders. Test mixed legacy/new drafts before enabling the journey; no generation auto-approves/publishes. |
| Metering | Quote changes/expiry, insufficient credits, revoked entitlement, cancel before/during execution, retry, lease expiry, uncertain provider outcome and reconciliation are covered without double reserve/charge. |
| Security | Tenant-scoped start/read/events/result lists/apply/receipts/stop/delete; permission revocation and outsider IDs rejected; worker secrets stay private; media reuse/withdrawal/revocation contracts preserved. |
| Accessibility/layout | Keyboard and screen-reader flow, meaningful live announcements, preserved focus, reduced motion, small screens, long content and errors do not obscure actions. |
| Migration | Existing populated and empty legacy slots, published snapshots, old active jobs and rollback tested without deleting user data. |

Use focused unit tests for generation/style/placeholder/quote state rules;
repository and pgTAP tests for leases, metering, permissions and atomic apply;
Playwright for every generation journey with deterministic provider/worker
fixtures, plus approved hosted smoke testing. Run typecheck, lint, build,
guardrails and relevant database/type-parity gates. Add durable contracts to the
existing CI suites, and update the CMS/P1.5 remediation evidence with actual
results. Local success alone is not hosted release evidence.

## Planning outcome

The product direction is settled. Implementation must verify the deployment’s
worker wake-up/streaming support, compatible schema changes and measured operation
estimates; these are engineering checks, not unresolved user-experience decisions.
This document authorises no provider spending, deployment or migration execution.
