# Guided AI course creation — implementation evidence

The user approved implementation of the four tracked blocks in order on
2026-09-07 and explicitly requested tests at the end of the integrated batch.
The branch is `codex/ai-course-guided-journey`, based on `origin/main` at
`0a1d7b9fb5c698d99b6cb098d575d1c16a5d3317`.
Scope: [approved plan](ai-course-journey-improvement-plan.md), AI Authoring
[#104](https://github.com/scothinks/project-ve/issues/104)–
[#107](https://github.com/scothinks/project-ve/issues/107).
Durable product guidance lives in the [Wiki](https://github.com/scothinks/project-ve/wiki/AI-Authoring).
Issue labels and Project columns hold live status.

## Delivered behavior

1. **Discovery:** a rough topic, problem or bundled starting point leads to an
   editable goal and learner description. Guided questions offer suggestions,
   free text and “Not sure yet”; direct brief entry avoids the conversation.
   Suggested fields are labelled, author corrections take precedence, and late
   responses cannot overwrite newer edits. Tone and lesson count are secondary
   options. In-flow Back preserves state; setup is not persisted across reloads.
   Changing the topic or choosing another starter retains an author-written
   learner description and prompts them to review its relevance. The header has
   course navigation only; the secondary “Resume earlier work” link sits beneath
   the journey rather than competing with creation as an AI-results tab.
2. **Price and availability:** authenticated price reads create no result, job,
   reservation or provider request. Metered actions display their charge beside
   Generate; the later draft charge is disclosed before requesting an outline.
   Catalog actions say “0 credits,” without a repeated pricing explanation. Pilot, plan and missing-provider
   availability have explicit reasons and manual/saved-result links.
3. **Workspace:** Shape your idea → Outline → Draft → Review. One explicit priced
   action quotes and starts each generation. Changed prices stop at a retained
   review state; double clicks share one intent and lost Start responses reconnect
   to that result. Outline edits/reordering, revision conflict recovery, quiz
   scope, completed lesson previews, unfinished-only retry, uncertain save and
   existing editorial review/publication remain supported.
   Reopened root-outline requests offer Edit brief, including after expiry;
   leaving that request prevents late reads from restoring it over new edits.
4. **Validation:** unit/route contracts, database/security/accounting checks and
   production browser journeys cover the integrated change. The enlarged-text
   check found a shared top-bar nowrap constraint; the bounded CSS correction
   allows wrapping and the course progress grid adapts to available space.
   Guidance moves keyboard focus to the next question or summary.

## Engineering and economic boundaries

Two forward migrations add the included-guidance allowance and read-only price
preview. Both were applied locally without a reset. The generated public types
include the new authenticated RPCs; private calculators/counters stay private.

`admin_preview_ai_course_price` and retained course quotes share the same private
calculator: outline 57; draft/retry `100 + unfinished lessons × (35 + 6 × questions)`.
Retry scope comes from the authorized retained result. The preview and quote
include workspace and metering context. Client comparison checks kind, price,
lesson/quiz scope and workspace before Start. Existing authoritative Start,
settlement, revision, lease, entitlement and RLS checks remain intact. Price
requests are debounced by scope, abort superseded reads and use no shared cache.

`AI_AUTHORING_GUIDANCE_ENABLED` defaults off. Enabling it also requires existing
pilot/provider availability and workspace entitlement. No provider spending or
hosted activation was performed. The implemented candidate allowance is:

- At most three clarification answers after the initial request, with four
  attempts per session, 12 per actor in 24 hours, 60 per workspace in 24 hours
  and 200 globally in 24 hours. Catalog shares one workspace bucket.
- A serialized authenticated reservation is required before each provider call;
  repeated request IDs cannot authorize another call. Failed/uncertain attempts
  retain their slot. No organisation credits or generation jobs are created.
- Seed ≤1,200 characters; up to three bounded answers; total structured context
  ≤7,000 characters; 1,800 output tokens; 25-second provider timeout; strict
  validated output. User text is data, and model output is always a suggestion.
- Private allowance metadata contains request/session IDs, actor, workspace and
  timestamp only. No conversation text is stored. Metadata follows actor/workspace
  deletion through cascading foreign keys; there is no scheduled time-based
  deletion or claim of server-resumable discovery.

These technical ceilings are not a monetary approval. The funding/model-cost
ceiling and capped real-model evaluation remain in #104 before live enablement.
Bundled starters do not call the provider; unavailable/exhausted/failed guidance
returns an editable fallback. The local browser harness enables guidance only for
route-intercepted fixtures; those responses establish interaction contracts, not
model relevance or teaching quality.

## Validation record

| Check | Result |
| --- | --- |
| `npm run test:unit` | 246 passed, including discovery/provider and authenticated route contracts |
| `npm run test:guardrails` | 40 passed; new read-only price/availability and bounded guidance route contract included |
| `npm run test:release-readiness` | Passed |
| `npm run test:db` | 49 files, 1,450 assertions passed |
| Focused course/guidance/RPC pgTAP | 167 assertions passed before the full database run |
| `npm run db:types:local:check` | Passed against both locally applied migrations |
| `npm run test:organization-ai-concurrency:local` | Passed |
| `npm run test:economic-integrity:local` | Passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Zero errors; three existing warnings in unrelated untracked `scrollcraft/` work |
| `git diff --check` | Passed after normalizing the generated type file's trailing newline |
| Production browser harness | Eight distinct affected journeys passed across reruns; final discovery suite 4/4 passed, remaining creation/recovery/CMS cases passed in the preceding run |

Browser files: `tests/e2e/ai-course-authoring.spec.ts`,
`tests/e2e/ai-course-discovery.spec.ts`, `tests/e2e/ai-authoring-release.spec.ts`,
and the existing “admin CMS workspace covers…” case in
`tests/e2e/remediation-flows.spec.ts`. The existing CI remediation job discovers
these tests; no paid calls are used. Production builds run through the existing
isolated `.next-e2e` harness with `PROJECT_VE_E2E_KEEP_BUILD_CACHE=1` during reruns.
Affected checks were rerun after fixes; earlier valid accounting evidence was reused.

Local failure fixes included a duplicate referral-code fixture, a metered fixture
with no credit allocation, an ambiguous Next route-announcer selector and the
200% text-size layout. Historical Phase 3 screenshots are no longer overwritten
by the updated course browser test. New inspected captures and source hashes are
under [evidence/ai-course-guided-journey](evidence/ai-course-guided-journey).

## Remaining acceptance and release limits

Automated journeys do not replace novice/experienced-author sessions. Participant
usability findings and an approved capped real-model evaluation remain open in
#104/#107. Final shared-identity integration follows #98/#99; this change uses
the current shared components and theme. No model relevance or future identity
acceptance is claimed from fixture screenshots.

Unsaved state survives in-flow Back; before-unload and ordinary in-app links warn
before discarding edits. Browser-history SPA navigation is not a durable draft
store. Generated result IDs/checkpoints/receipts provide reload recovery after
generation is requested. Discovery does not add browser transcript persistence.

An automatic Vercel PR preview was created; both new migrations remain unapplied
remotely, and this branch has not received hosted qualification. Historical
[qualification run 34071919696](https://github.com/scothinks/project-ve/actions/runs/34071919696)
passes for `292e65a8f7784df31591e94abe65fec47ddd23b6`, Preview deployment
`6299858025`; it does not qualify this branch. Its artifact verifies 221/221
migration parity and service-only recovery ACLs at that earlier revision. Run
34069618360 failed and is superseded. Engineering/product/Phase 6 summaries now
reflect that distinction. Activation and representative paid text/image,
streaming and reconciliation review remain in #63/#71. Engineering P2 is unchanged.

## Recovered pre-change baseline

The agreed baseline was missed before the original layout edit. On 2026-09-07,
the original source at `0a1d7b9fb5c698d99b6cb098d575d1c16a5d3317` was built in an
isolated detached checkout. [Before captures](evidence/ai-course-guided-journey/before)
record 1440px and 390px light/dark authoring views and computed field, heading,
button and body styles. These are explicitly **before** screenshots, not the delivered assisted journey.
They are a reconstruction, not contemporaneous evidence
and not an exact reconstruction of the user's unidentified hosted environment.
No generation was requested. The current local database supplied authentication;
the screenshot uses a disposable Catalog administrator and the original form.

This closes the missing authoring comparison evidence. It does not claim the
application-wide #96 theme inventory/scanner gate is complete. #97–#99 remain
separate Identity & Entry implementation, in their established dependency order;
they are not prerequisites for local authoring behavior. Final appearance after
their shared styles land still needs comparison against this evidence.

The floating robot in the supplied image was not found in the application source
or local renders (searched app/components/features for floating/chatbot/widget/
robot). Its origin remains unidentified. No replacement widget or guessed overlay
was added to manufacture an overlap result.

## Follow-up validation

After all gap fixes were integrated, typecheck, lint (zero errors; the same three
unrelated warnings), 40 guardrails and diff checks passed. The affected production
browser batch passed seven of eight cases initially. The new expiry/reopen test
held its first reload response accidentally; after correcting the fixture to hold
only a subsequent read, its focused rerun passed. All eight affected cases now
have passing evidence, including full create/review/publish, partial retry/save,
discovery/corrections, zero-question complete advice, expiry/refresh/reopened edit,
late advice, priced consent/lost Start and plan-unavailable entry.

Commands: `npm run test:e2e -- tests/e2e/ai-course-discovery.spec.ts
tests/e2e/ai-course-authoring.spec.ts`, then the discovery file with
`--grep 'reopened expired'`. Both used `PROJECT_VE_E2E_KEEP_BUILD_CACHE=1` and
rebuilt the changed inputs. The earlier database/accounting and route results
remain valid: these follow-up changes touch client state and browser coverage.
An initial invocation used the nonexistent `test:e2e:local` script; no tests ran
from that invocation. The correct repository harness above supplied the results.

The existing current-theme screenshots and manifest remain tied to `7638ad7`;
they were not relabelled as captures of these later state-recovery fixes. An
additional standalone capture-server request was declined. After the subsequent
journey review, the authorized browser suite captured the assisted steps described
below; it did not launch that declined standalone server. The reconstructed
baseline above was captured separately before that request. Production CI at `7638ad7` passed app, database-types and full local
remediation jobs. GitGuardian reported four high-entropy findings in the checksum
manifest; its 25 source and seven image values were verified as SHA-256 hashes.
The manifest now uses explicit `path`/`sha256` records and records its immutable
source commit. All 32 original hashes were reverified against `7638ad7`; none were
changed. The evidence-format regression check covers all repository JSON evidence
and is included in the existing unit/CI gate; it also checks the seven screenshot
files against their recorded digests. See [evidence checksum guidance](evidence/README.md).
Validation: all 248 unit tests passed, focused ESLint and `git diff --check`
passed, and restoring the original manifest caused the new format gate to fail
as expected. No application or database behavior changed in this follow-up.
GitGuardian incidents 37054300, 37054301, 37054299 and 37054298 still require an
authenticated false-positive disposition for the historical commit, followed by
a check rerun. Browser control was unavailable, so the dashboard action has been
requested from the user. No scanner exclusion or bypass was added.

## Assisted journey presentation correction

The recovered before images were shown during review without sufficiently clear
labelling; they were not the proposed UI. The creation header now removes the
AI-results tab and uses a secondary “Resume earlier work” link below the journey.
[Delivered assisted steps](evidence/ai-course-guided-journey/assisted-steps/README.md)
show the entry, direction question, learner help and assembled brief from the
current production build. These captures are separate from historical evidence.
The six discovery/recovery browser cases passed after this navigation correction.

## Lesson suggestion availability correction

The course's “Suggest lessons with AI” link previously checked only the
organisation plan, while its destination hid the start button when the pilot
flag was off. This produced a heading and recovery button with no explanation.
Both entry and destination now use the destination course's entitlement,
rollout flag and provider configuration. Unavailable states explain the reason,
retain manual editing and saved-result recovery, and offer a return to the course.
The lesson flow labels recovery “Resume earlier work” as a secondary action.
No pilot flag, provider credential, billing or authorization boundary changed.

Validation: 252 unit tests, 40 guardrails, typecheck, focused ESLint and diff
checks passed. All six affected production browser workflows passed across
`ai-assistance-authoring.spec.ts` and `ai-page-authoring.spec.ts`. The lesson case
now starts from the course's actual suggestion link and verifies recommendation,
separate drafting, refinement, recovery and explicit saving. Unit coverage checks
rollout off, missing provider, denied destination plan and direct-URL recovery.
The browser harness uses deterministic provider fixtures; this does not activate
or qualify hosted AI generation.

## Project-wide pricing copy

The user's follow-up makes compact pricing the project convention: `0 credits`
or `N credits`, with a short action such as Generate, Recommend, Create, Refine
or Retry. The course, page, lesson, quiz and image actions share the same pricing
formatter. Result/recovery and Catalog usage views also use `0 credits`.
Redundant pricing paragraphs and provider-cost implementation copy are removed.
Metered actions still disclose later drafting charges, and result/usage views
retain reserved, used and released amounts. XP/reward and currency pricing was
already expressed as concise amounts with its real units; those units remain.
The ad-rate field keeps its required minor units with a shorter example.
Preparation-only actions remain distinct from the billable action; no quoting,
reservation, pricing, entitlement or generation behavior changes.
Historical screenshot labels are superseded by this copy convention.

Validation after integration: typecheck, focused ESLint, four existing
pricing/discovery unit checks, diff checks, and all 15 affected production browser
workflows passed (course, discovery, page, lesson/quiz assistance and image files).
Existing DB/accounting evidence remains valid; this change alters presentation.
