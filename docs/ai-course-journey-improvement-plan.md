# AI course creation: guided discovery, journey and upfront pricing

Date: 2026-09-07. Implementation of the four blocks was explicitly authorized after tracking setup, in the recorded order. The user requested integrated testing at the end of those blocks.
Owner: @scothinks. Technical evidence and remaining release gates: [guided journey implementation](ai-course-guided-journey.md).
Initiative: [AI Authoring](https://github.com/users/scothinks/projects/1).
This is a bounded follow-up to the [existing experience plan](ai-authoring-experience-redesign-plan.md), under the [canonical guardrails](codex/skills/project-ve-guardrails/SKILL.md). It does not reopen engineering P2.

## Outcome

An editor can start with an uncertain idea, a problem they have noticed, or a clear brief. The product helps them choose a useful learning direction and describe the learners, then turns their confirmed intent into an editable outline and course draft with visible prices. Writing an effective prompt or knowing instructional-design terminology is not a prerequisite.

Keep two explicit course-generation spending decisions: outline and course draft. Keep saving, editorial approval and publication explicit. Existing generation tariffs remain unchanged unless separately approved. Adaptive discovery introduces provider usage before those actions; its proposed included allowance requires an explicit funding/limits decision below. Do not generate images implicitly or replace the existing job, metering, checkpoint, result and receipt systems.

## Evidence and gaps

Source inspected at local revision `292e65a8f7784df31591e94abe65fec47ddd23b6`, alongside the supplied screenshot and live GitHub issue/Project reads. The screenshot's exact deployment, workspace and runtime flag were not identified; its disabled message alone cannot distinguish those causes.

| Finding | Evidence | Consequence / required change |
| --- | --- | --- |
| Both the current form and the first version of this plan assume a defined topic and audience. | Required `CourseBrief.need` / `audience`; earlier proposed Brief stage | Make discovery a first-class capability. A rough phrase, a problem or “Help me choose” must be enough to enter. Helpful placeholders alone do not close this gap. |
| The legacy planner also requires audience, region and tone before offering options. | `features/learning/admin/planner-commands.ts`, `generateNewCoursePlanOptionsCommand` | Do not resurrect that screen as discovery. Audit reusable validation/provider infrastructure, but add a focused guidance contract instead of another required form. |
| The current provider contract accepts a completed brief and produces an outline. | `course-contracts.ts`, `course-teaching.ts` | Adaptive pre-generation guidance is additional application capability, not just new copy or a renamed button. Confirmed discovery must feed the existing generation context without losing the learner goal. |
| The brief is a flat form without visible stages or examples. | `components/admin/ai/AiCourseAuthoring.tsx` | Add a clear journey, examples and compact secondary options; give each stage one primary action. |
| Outline and draft both require a cost-check action before Generate. | Same component; `quoteDraft`, `refreshQuote`, quote-stage rendering | Show cost alongside Generate. A quote remains an internal consent/accounting boundary. |
| Quoting is a write, not a price lookup. | Current `admin_quote_ai_course` in `20260906210000_ai_course_recovery_consistency.sql` | Do not call it during render or on each input change. It creates private result records, although quote-stage records are already excluded from AI results. |
| Pricing is currently embedded in SQL and repeated in UI copy. | Course quote/checkpoint migrations and quote card | Provide one authoritative, read-only pricing contract; prevent UI/backend drift and enforce the accepted amount/scope. |
| Availability is lost behind a boolean. | `app/admin/courses/ai/brief/page.tsx` combines pilot switch and organisation notice; chooser always links to AI | Show a specific user-facing reason before setup. Preserve saved-result access and manual creation. Do not expose configuration secrets. |
| Provider configuration is checked only at Start. | `app/api/admin/ai/authoring/route.ts` | Resolve safe availability earlier where possible, while retaining authoritative checks at Start and in the worker. |
| Brief and outline edits are held in component state until explicitly persisted. | `AiCourseAuthoring` state, `saveOutline` calls | Preserve Back transitions and warn before discarding unsaved work; do not claim unsaved edits survive reload. Generated results already persist. |
| All completed lesson previews open at once. | `AiCoursePreview.tsx` | Use a scannable lesson summary and focused preview, retaining real checkpoint counts, recovery and keyboard access. |
| Cost presentation treats Catalog like a charged organisation until a secondary note. | Quote card and `metered` result field | Lead with “No organisation credits used” for Catalog; do not describe provider work as free. |
| Tests prove the current two-click sequence and recovery, not the proposed journey. | `tests/e2e/ai-course-authoring.spec.ts`, `remediation-flows.spec.ts` | Update interaction contracts and retain concurrency, lost-response, partial-save and publish coverage. Add visual/accessibility checks for the new composition. |
| Release summaries and live tracking contain superseded blocker lists. | Engineering/product summaries, Phase 6 evidence, #63 and #71 | Reconcile references to the latest successful run before execution planning; do not repeat completed release work. |

## What must come first

| Dependency | Verified state / decision | Blocks |
| --- | --- | --- |
| Course outline, drafting and recovery foundation | [#67](https://github.com/scothinks/project-ve/issues/67) and [#68](https://github.com/scothinks/project-ve/issues/68) are closed / Done in AI Authoring. | Nothing to rebuild. Preserve their contracts. |
| Current release baseline | Remote `main` is `0a1d7b9fb5c698d99b6cb098d575d1c16a5d3317` after PR #94; local branch is its earlier source revision. Use a fresh, current implementation branch after approval. | Starting implementation from an obsolete baseline. No checkout changes are part of this planning task. |
| Guided discovery contract and allowance | Newly identified essential gap. Define work package 0 before wiring the redesigned entry. | Acceptance of the complete journey. Static examples alone cannot stand in for the adaptive assistance. Funding/caps block live model-assisted discovery, not prototype or fixture work. |
| Authoritative price preview and consent | No separate course price-preview contract was found. Implement work package A below first. | Shipping the one-click priced action safely. Layout design can proceed independently. |
| Availability contract | Existing pilot, entitlement and provider checks need a consistent presentation. Implement in A. | A usable entry point; enabling the pilot is not needed for fixture-based development. |
| Identity migration baseline | [#96 / B0](https://github.com/scothinks/project-ve/issues/96) is Ready; [#97 / B1](https://github.com/scothinks/project-ve/issues/97) is Backlog, dependent on B0. | Recommended sequencing: capture their unchanged baseline and stylesheet parity before landing course layout changes. This is coordination, not an architectural dependency. |
| Shared colours and typography | [#98 / B2](https://github.com/scothinks/project-ve/issues/98) and [#99 / B3](https://github.com/scothinks/project-ve/issues/99) are planned in Identity & Entry. | Final visual acceptance on the new identity. Behaviour work can proceed using shared components; do not add a parallel palette or new legacy token consumers. |
| Hosted qualification / pilot | [#71](https://github.com/scothinks/project-ve/issues/71) remains In progress; [#63](https://github.com/scothinks/project-ve/issues/63) remains Backlog. Latest #71 comment identifies successful practical run [34071919696](https://github.com/scothinks/project-ve/actions/runs/34071919696), superseding earlier failed runs. | No blocker to UX implementation. Reuse release evidence, and keep capped provider checks and activation authorization in #63/#71. |
| Recovery scheduling | Phase 6 documents daily recovery as a limited fallback; faster scheduling is a wider unattended-rollout follow-up. | Wider unattended rollout, not this course UI change or its local acceptance. |

The older run `34069618360`, described as passing in the local Phase 6 document, actually has a failed GitHub conclusion. Use the replacement run and exact deployment evidence, not that stale summary. A passing release workflow is not proof that the screenshot's environment has generation enabled or that real output quality has been accepted.

No dependency on the welcome/login redesign (#91), Suggest next page (#88), rich-text toolbar (#81), media previews/GIF support (#85/#86), curriculum sections (#79), hosted audio/video (#77), stock-rights review (#80) or engineering query tuning (#66). Reuse the current optional-media and required-cover rules. The mandatory CMS libraries are already installed; this scope does not need another component, editor, grid or drag-and-drop system.

## Product references and design implications

Reviewed official product descriptions on 2026-09-07; these are documented patterns, not hands-on usability results or evidence of Project VE's implementation:

- [Articulate AI Course Drafts](https://www.articulate.com/lp/ai-course-drafts/) starts with a prompt or source documents, then follows up about audience, tone and learning objectives before drafting. The useful pattern is progressive clarification from incomplete input.
- [Gamma Create with Agent](https://help.gamma.app/en/articles/15002203-how-do-i-create-with-agent-in-gamma) describes brainstorming, questions and collaborative outline editing alongside its direct generator. The useful pattern is assistance proportional to uncertainty, with user control before generation.

Project VE should help users recognize a suitable direction, rather than require them to invent a complete answer. Offer a few meaningful choices plus free text, reflect back an editable interpretation, ask only what remains uncertain, and let confident users proceed directly. A long compulsory chat is also friction. Document upload, URL ingestion and web research are not prerequisites for this correction and are not promised by this plan; they require a separate ingestion/rights/security scope.

## Proposed interaction

Visible stages: **Shape your idea → Outline → Draft → Review**. Discovery happens inside the first stage; it is not another mandatory wizard. Stages describe progress, not permission to skip prerequisites.

1. **Shape your idea.** Start with “What would you like to help people do?” and a rough-input box accepting a topic, situation or problem. Give “Help me choose” equal visibility; a user may begin by choosing a theme such as respect, integrity or working together without typing. Do not make users choose a mode before they can enter text. Offer contextual directions, help describe the learners, and assemble an editable brief as specified below. Users with a clear brief can go straight to its summary. Tone and one-to-six lesson scope are editable defaults, not opening homework. Show what is included, what comes next and that full drafting costs extra. After the summary is ready, the primary action is **Generate outline · 57 credits** for a metered workspace at the current tariff. Loading, unavailable pricing and unavailable generation have explicit states.
2. **Outline.** Show course title/description and editable lesson cards. Keep existing add/remove/reorder and keyboard controls. Show saved/unsaved state and explicit quiz scope, defaulting to no quizzes. Primary action: **Generate course draft · N credits**; secondary action: **Save outline**. Back preserves the brief and explains that regenerating it creates a separately charged version. Refinement and unfinished-only retry also receive priced actions within this course journey.
3. **Draft.** Acknowledge immediately; show “Planning your course” or actual “2 of 6 lessons ready.” Use one existing stream with fallback polling. Make completed lessons easy to inspect without expanding the entire course. Keep honest delay/reconnect messaging, Stop, retained partial work, retry pricing and used/released credits. Never fabricate progress or silently regenerate.
4. **Review.** Clearly distinguish generated results from a saved course. Keep **Save course draft** (or explicit partial save), then link into the existing editor/Review for content, quizzes and required covers. Approval and Publish stay separate. A small readiness summary can explain those remaining steps; do not invent a second review engine or make optional inline media mandatory.

Use the existing shadcn/Radix CMS foundation and dnd-kit editor. Build a responsive stage header, grouped fields, compact scope summary and clear action area. On mobile keep cost and action together in normal flow unless a tested sticky treatment leaves all fields, errors and preview content reachable. Check the floating assistant/widget for overlap. Do not redesign the entire CMS or global identity in this task.

## 0 — Guided idea and audience discovery

This is core scope, not a later enhancement. Design the direct and assisted paths together before implementing the form replacement.

### Help users recognize what they want

- For no idea: start from a few concrete intentions such as handling disagreements, making fair decisions or building trust. Include “Something else” and free text; do not force values terminology or an exhaustive topic catalogue.
- For a vague topic: propose up to three distinct learning directions, each with a plain-language outcome and a short example of the situation it addresses. “Tolerance” might become respectful disagreement, working across differences or responding to exclusion. These are suggestions to choose/edit, not three separately generated course outlines.
- For a problem: reflect it as a possible learning goal. “Our team talks over each other” can become “Practise listening and disagreeing respectfully in team discussions.” Ask for correction rather than claiming to have diagnosed the team.
- For a complete brief: extract the goal and learners, show the summary immediately, and offer optional refinement. Never ask users to repeat details already supplied.

### Help users describe learners without writing a persona

Ask a concrete question such as “Where will they use this?” with relevant editable choices: at work, in education, in a community group, in everyday life. Offer “Not sure yet”; it leads to a visibly provisional broad-audience suggestion, not a validation dead end. Free text is always available.

Ask about role or starting knowledge only if it changes the course materially: for example, “People new to this, people who know the basics, or a mixed group?” Age is optional and only relevant where it changes examples/reading level; do not require demographic profiling or infer personal characteristics from workspace membership. Course audience describes teaching needs, not enrolment or access permissions.

Reflect the choices into a usable description, for example: “Young adults practising respectful disagreement in everyday group situations; no prior study needed.” Mark added context as a suggestion. Do not infer literacy, beliefs, vulnerability or expertise from “young adults.” Let the user edit, accept a reasonable broad default, or change one part. Only selected/confirmed context becomes generation input.

### A bounded conversation with a visible result

Show one short clarification at a time with two or three answer suggestions, free text and a route to continue with a stated default. Target zero questions for a complete brief and no more than three clarification turns for an uncertain one before offering an editable proposed brief. Additional refinement is user-initiated. Do not repeatedly ask variants of the same question or force a fixed questionnaire.

Keep a compact “Your course so far” summary visible: goal, learners, relevant starting level/context, proposed lesson count and tone. Separate user-provided facts from suggestions through plain labels such as “Suggested.” A missing demographic detail is not a reason to block Generate. User acceptance of the visible brief and priced Generate action is sufficient; avoid an extra confirmation modal for normal generation.

Example, illustrative rather than a fixed script:

1. User enters “Tolerance.”
2. The assistant offers three directions; the user chooses “Disagree respectfully.”
3. “Who might use this?” offers concrete groups and settings; the user chooses young adults and everyday group situations, or types their own answer.
4. Show the proposed goal, learner description and three-lesson scope. The user edits if needed and selects **Generate outline · 57 credits**.

The short route remains available: a complete brief can reach the same summary without this exchange. If the topic changes, mark affected learner/goal suggestions for review rather than retaining contradictory assumptions or discarding all previous choices.

### Technical and economic prerequisite

Add a focused discovery controller and structured provider output: proposed directions, one next question with suggested answers, a proposed brief and the provenance of confirmed versus suggested fields. Reuse established provider validation, identity, rate limiting and metering infrastructure; do not route chat turns through the outline job or revive the old three-outline planner. Discover reusable pieces before adding modules.

Keep `CourseBrief` compatibility initially by composing confirmed goal/context into bounded `need` and learner/starting-level details into bounded `audience`; preserve tone and lesson count. Keep structured guidance state separate. Reject overlong content with an editable explanation, not silent truncation. Verify that the accepted intent reaches both outline and lesson generation. Do not attach an unbounded conversation transcript to each generation request.

Recommendation for product approval: include a small, bounded guidance allowance in course setup, with no organisation-credit deduction per clarification. This is a proposed platform-funded allowance, not a claim that provider work is free or covered by today's 57-credit outline tariff. Set the monetary/token ceiling, turn limit and account/workspace rate limits before enabling it. An allowance exhaustion or provider failure preserves the summary and offers manual editing/curated choices; never starts paid generation, secretly charges credits or traps users behind a retry loop. Do not place “check cost” gates in front of every helpful question.

Opening setup and selecting bundled starter choices makes no provider request. Model assistance runs only on explicit user actions within the approved allowance, with visible loading and recoverable errors. Late responses must not overwrite more recent choices. Keep requests authenticated and tenant-scoped; avoid cross-user caches. Treat supplied context as data, never as instructions to bypass the generation contract.

Plan discovery persistence explicitly: preserve state across in-flow Back and mode changes. Reuse existing retained-draft facilities if suitable; do not assume the current generated-result record can hold pre-generation conversations. Do not store private transcripts in browser persistence by default or claim reload recovery unless implemented and tested. If server-resumable discovery is included during implementation scoping, define its minimal data, ACLs, retention/deletion and revision rules before migration. Full conversation history is not required to preserve a confirmed summary.

Acceptance: users can reach a useful brief from no topic, a vague topic or an uncertain audience without writing a polished prompt; guidance adapts to their supplied context; a complete brief avoids redundant questions; provisional assumptions stay visible/editable; model usage stays within the approved allowance; the confirmed learning goal and audience survive generation handoff. Static chips and example copy alone do not close adaptive-guidance acceptance.

## A — Pricing and availability foundation

Deliver before connecting the new primary buttons:

- Extract the existing course tariff into a focused private database calculator shared by the retained quote and a narrow authenticated, read-only preview RPC. Return bounded amounts/scope and metering context, with no job, result, credit reservation or provider call. Expose it through a focused server module/route using existing workspace identity. Use a forward migration, explicit RPC classification and least-privilege grants; no changes to existing RLS or worker permissions.
- Current amounts remain outline `57`; draft/retry `100 + unfinishedLessons × (35 + 6 × questionsPerLesson)`. A three-lesson course with no quizzes is `57` for the outline plus `205` for drafting, `262` total if both are requested. Distinguish already-spent credits from the next action's cost. Retry includes its existing new request base; do not describe it as charging only lesson units.
- For ordinary unsaved outline edits, preview uses validated bounded lesson/question counts; it must not save the outline. For retries, derive retained/unfinished scope from the authorized result rather than trusting a client-supplied completed count. Deduplicate unchanged inputs and discard stale responses. Text-only edits should not trigger new price reads.
- On Generate, freeze the submitted scope; save/reconcile outline edits when needed; create one retained quote; compare the returned amount, metering context and scope with what was accepted; retain the quote ID in the recoverable URL/state before Start. Start only that matching quote. A changed price/scope or stale revision returns an inline review state and requires a new explicit click. No automatic paid retry.
- Preserve quote expiry, revision fencing and idempotent Start. A dropped Start response reconnects to the same result before any retry; rapid clicks cannot create parallel intent chains. If quote creation has an uncertain response, no Start has yet occurred; handle recovery without pretending generation began. Back/navigation/reopening a quote must never auto-start work.
- Provide a focused availability result for chooser and brief: pilot unavailable, plan unavailable, provider temporarily unavailable or available, plus saved-results/manual links. Check existing budget capabilities before adding reads; any displayed balance is contextual/advisory, never a guarantee against concurrent reservations. Keep existing authoritative budget, role and entitlement enforcement at Start/worker.

Acceptance: initial render, price-relevant option changes and price preview perform zero mutations; user-visible amount matches the retained quote; stale prices/scopes cannot silently start; one generation intent creates at most one job/reservation; reasons are clear without exposing secrets or weakening access. Explicit discovery interactions follow the separate bounded allowance contract in work package 0.

## B — Guided course workspace

Implement the four-stage composition, direct/assisted discovery paths and all course-generation CTAs above. Split the current orchestration component into focused discovery, brief-summary, stage/action, quote/consent and preview components only where that reduces complexity. Keep the route thin. Preserve current version links and generated-result recovery. Use existing dialogs for destructive actions and unsaved-navigation confirmation; disclose that unsaved input is not durably retained rather than introducing browser storage for private course content.

Acceptance: an editor can complete outline generation and full-draft generation with one explicit priced action each, without a separate cost-check screen; previous input is retained during in-flow navigation; the second charge is clear before the first one; disabled and Catalog paths are understandable; each stage has an obvious next step.

Dependencies: 0 for useful assisted setup and A for live priced controls; coordinate identity B0/B1 baseline capture, then consume shared B2/B3 styles for final visual acceptance. No dependency on completing every identity-adoption batch.

## C — Recovery, integration and evidence

Extend existing tests instead of replacing their meaningful assertions:

- Discovery contracts: structured suggestions and confirmed-context mapping; no repeated known questions; unknown-audience defaults; contradictory/changed input; bounded turns/context; late response suppression; allowance/rate limits and no implicit organisation charge; provider failure with usable manual fallback. Add DB/security coverage if discovery persistence or metering adds a boundary.
- Discovery usability scenarios: “I don't know what to teach,” “Tolerance” with no audience, a workplace problem without a topic, a complete brief, and a user correcting a suggested audience. Exercise suggestions by keyboard and free-text alternatives. Have representative novice and experienced authors attempt these tasks without coaching; record where they hesitate, whether they understand the goal/audience summary and price, and whether the fast path actually avoids unnecessary work. Automated completion alone is not usability evidence. Real-model guidance quality requires capped evaluation under the approved provider budget; fixtures cannot prove relevance.
- Pure/route tests: preview bounds, price/scope comparison, stale response suppression, metered/Catalog copy, availability reasons and no mutation on reads.
- pgTAP: preview access/tenant isolation, no created results/jobs/reservations, preview/quote parity across one-to-six lessons and zero-to-three questions, retry calculation from retained state, expiry/revision/Start fencing and unchanged ACLs. Reuse affected course/RPC suites; run type parity after the forward migration.
- Browser: metered and Catalog paths; pilot-off and entitlement-denied entry; input validation; priced actions; unsaved Back; add/remove/reorder and quiz price changes; price mismatch/expiry; concurrent outline edits; double click; lost Start response; reload/resume; partial failure/unfinished-only retry; uncertain save; existing review/cover/publish path. No real provider calls for these tests.
- Visual/accessibility: inspect actual desktop and mobile renders at 1440px/390px, narrow 320px, 200% text zoom, light/dark, keyboard focus and reduced motion. Verify field labels, step announcements, select/dialog portals, action visibility, preview readability and assistant-widget overlap. After identity integration, follow its current theme contract and exact-source visual evidence requirements.

Commands follow the canonical smallest-sufficient cadence: focused unit tests and affected pgTAP first; then `npm run typecheck`, `npm run lint`, `npm run test:guardrails`, `npm run test:release-readiness`, `npm run db:types:local:check`, `git diff --check`, and the existing production E2E harness for `tests/e2e/ai-course-authoring.spec.ts` plus affected course entry/recovery cases. Reuse the harness build. Run organisation-AI concurrency/economic checks if accounting/start boundaries change. Existing CI must discover the new tests; run its applicable completion gates before Done. No production DB reset or paid output generation for implementation tests.

Acceptance: all changed interaction and security contracts pass, direct and assisted setup have usability evidence, screenshots have been inspected on the integrated identity, and release evidence distinguishes local fixtures from the deployed runtime and paid guidance/output quality.

## Tracking and documentation

Tracking was requested on 2026-09-07. The existing AI Authoring initiative is reused; #67/#68 remain completed foundations. The issues contain self-contained scope because this local technical plan has not been published:

- [#104 — Help authors discover a course idea and define its learners](https://github.com/scothinks/project-ve/issues/104): work package 0; includes the guidance allowance decision.
- [#105 — Show upfront course generation prices and clear availability](https://github.com/scothinks/project-ve/issues/105): work package A.
- [#106 — Build the guided AI course creation workspace](https://github.com/scothinks/project-ve/issues/106): work package B; integrates #104/#105.
- [#107 — Validate guided course discovery, recovery and usability](https://github.com/scothinks/project-ve/issues/107): work package C; integrated acceptance for #104–#106.

Live status belongs to those issues and the Project. Link shared identity dependencies rather than copying them. Reuse #63/#71 for activation/release work and reconcile superseded statements against current evidence as part of #107. Tracking setup made no hosted changes. Implementation approval followed; durable journey guidance belongs in the Wiki, with engineering contracts and validation evidence in this repository. Add implementation and validation evidence before Review/Done. Deployment, provider spending and pilot activation retain their existing authorization boundaries.

Recommended order: confirm baseline and reconcile evidence → 0 discovery prototype, contract and allowance decision alongside A pricing/availability and identity B0/B1 → B guided workspace → integrate shared B2/B3 appearance → C technical and usability acceptance → separately authorized hosted rollout/pilot work. Discovery is now a release requirement for this journey, not optional follow-on polish.
