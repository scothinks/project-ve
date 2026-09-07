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
   learner description and prompts them to review its relevance.
2. **Price and availability:** authenticated price reads create no result, job,
   reservation or provider request. Metered actions display their charge beside
   Generate; the later draft charge is disclosed before requesting an outline.
   Catalog actions say “No organisation credits.” Pilot, plan and missing-provider
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
button and body styles. They are a reconstruction, not contemporaneous evidence
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
additional local capture-server request was declined, so no follow-up screenshots
are claimed. The reconstructed baseline above was captured separately before
that request. Production CI at `7638ad7` passed app, database-types and full local
remediation jobs. GitGuardian reported four high-entropy findings in the checksum
manifest; its 25 source and seven image values were verified as SHA-256 hashes.
Dashboard sign-in could not be completed in this session, so those findings remain
unresolved and no security suppression or bypass was added.
