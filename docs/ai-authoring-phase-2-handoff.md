> Continuation status (2026-09-06): Phase 2 is implemented and locally validated;
> closure evidence is recorded in [Phase 2 evidence](ai-authoring-phase-2.md).
> This file is the historical starting checkpoint, not the current work list.
> The user subsequently confirmed all inline media is discretionary, including
> legacy required flags; cover and attached-asset security requirements remain.

# Phase 2 continuation handoff — 2026-09-06

The user requested: “Proceed with phase 2”, then “Let's continue phase 2 in a new chat. Start a new chat and continue there.”
Continue implementation from this checkpoint; the phase is NOT complete. The previous chat could not create a new chat because the thread-creation tool was unavailable and the computer-use service failed to start.

## First reads and boundaries

- Follow `AGENTS.md` and `docs/codex/skills/project-ve-guardrails/SKILL.md`.
- Authoritative scope: `docs/ai-authoring-experience-redesign-plan.md`, delivery Phase 2 and quiz/additional-lesson journeys.
- Read `docs/ai-authoring-phase-1.md`, product/engineering remediation plans and P1.5 guardrails.
- Phase 2 is **quiz AND additional lesson assistance**, not engineering P2 query tuning. This product implementation is explicitly authorized.
- Repository is very dirty with extensive user-authorized prior work. Preserve all unrelated changes. No commit, push, hosted migration, deployment or database reset requested.
- Do not spawn agents unless separately authorized. Current developer instructions prohibit proactive delegation.
- User prefers very concise UI copy and updates. AI is an assistant: infer useful defaults, make direction optional, don't ask editors to do all the thinking.
- Text generation may create purposeful optional media placeholders; it must not generate media or reserve image credits. Placeholder purpose and editable contextual media brief must survive application.
- Reuse durable jobs, leases, credit accounting, retained candidates, explicit application and receipts. No redirect-to-queue notice or automatic insertion.

## Work done in the Phase 2 turn

Only TWO new SQL migration files were added. No TS/UI/provider/tests/docs status edits were made yet (except this handoff). Both were successfully applied **locally**, without reset:

1. `supabase/migrations/20260906090000_ai_assistance_lifecycle.sql`
   - Generalizes private.ai_authoring_results: nullable lesson_id, kind page/quiz/lesson_plan/lesson_draft, requested_count 1–3, source_fingerprint, selected_items.
   - `private.lock_ai_authoring_source(course,lesson)` authorizes current course editor, locks course/lesson/page/quiz/question parents, computes private fingerprint of current graph for start/apply conflict detection.
   - `admin_quote_ai_assistance`: scoped private teaching excerpts, existing quiz prompts, optional focus/refinement; lesson_plan suggestions -> selected lesson_draft context. Defaults one item. Quiz count 1–3; plan count 1–3; lesson draft count one.
   - Estimates reuse existing formulas: quiz20/question; plan35+12/count; draft135 (one lesson, zero generated quiz questions).
   - Extends existing admin_start_ai_page to route non-page jobs as `authoring_assistance_v2`, preserving quote identity and original ledger operation types.
   - Extends service_ai_page_checkpoint to dispatch non-page candidate validation while keeping fenced begin/ready/failure and existing settlement.
   - Projection adds kind/count/selection and handles course-level result destination.
2. `supabase/migrations/20260906100000_ai_assistance_application.sql`
   - private validator for questions/lesson suggestions/lesson pages and strictly optional media placeholders.
   - `admin_prepare_ai_assistance_apply`: saves immutable explicit selected indexes before application for lost-response/navigation recovery.
   - `admin_apply_ai_assistance`: snapshot checked/idempotent; quiz inserts only selected questions (fixed10XP,2–4 distinct options,exactly1correct,explanation); creates quiz if missing; lesson creates draft lesson+1–4 pages+blocks+empty quiz. Never publishes. Invalidates prior AI text approval.
   - Saved receipt returns status,kind,lessonId,ids,savedAt.
   - Original page apply implementation moved to private.ai_page_apply_v1; public wrapper restricts kind=page so generic candidates cannot bypass validation.
   - Specific RPC grants/classifications added; private helpers revoked from API roles.

Command already succeeded:
`node scripts/supabase-cli.mjs migration up --local`
Applied exactly migrations 090000 and 100000. **No tests yet.** SQL parses, but function runtime paths need thorough pgTAP tests/review. Do not claim functional completion. Update via forward migrations if corrections needed in the already-applied local DB; files may also be corrected for fresh replay with matching forward fix.

## Important review points in this initial SQL

- Check JSON operator precedence in media validator (`block->'payload'-array[...]`, etc.); earlier Phase1 needed explicit parentheses. Validate actual placeholder case.
- Check fingerprint locking coverage, concurrent insertion/modification and deadlock ordering against manual save/quiz functions. It currently locks course first, then lessons/pages/quizzes/questions, but not individual blocks/options. Fingerprint covers all rows; ensure races after comparison cannot defeat guarantees. Avoid unnecessarily large full graph/metadata snapshots if a smaller revision-based snapshot proves same guard.
- Ensure page start retains original destination lesson/course/org guard. Current generalized start checks course/org after private.lock_lesson_revision; review moved-lesson case.
- Ensure page quote/refinement rejects non-page parents after generic table extension; page prepare also should reject non-page candidates even though public page apply does.
- Ensure prepare/apply unknown outcome can always settle saved/not_saved, including unexpected DB failure; selection replay remains exact. Receipt replay must not trigger another insertion/charge.
- Readiness: new AI lesson draft has ai_generated=true, ai_text_status=draft, ai_publish_status=not_ready and no old media seeds. Ensure normal Review works without obsolete seed gates (minimum compatibility needed for these drafts, don't defer broken journey).
- Existing quiz tables are not versioned with lesson published snapshot; retain existing behavior and history/XP/auth rules.
- Existing lesson plan costs used operation ai_planner_expand_course with course_text job; test existing organization metering supports this combination.
- Function classification check may see moved private.ai_page_apply_v1; verify rpc_security gate.
- Regenerate database types locally after finishing SQL. New RPCs not in types yet.

## Remaining implementation

1. Focused Phase2 candidate contracts, validation and provider module (avoid growing 1,200-line lib/ai-learning-generator.ts).
   - quiz: title/questions[{prompt,questionType:single_choice,explanation,xp:10,options:[{label,isCorrect}]}], exactly requested1–3. Ground in actual page teaching; avoid existing prompts; check explanations/answer keys; no media.
   - lesson_plan: title/suggestions[{title,description,reason}], up to requested1–3. Infer real course gaps; optional direction/audience; do not force repetitive lesson/page-type quota.
   - lesson_draft: title,description,pages[{title,subtitle,pageType:concept|scenario|reflection|summary,blocks}]. 1–4 purposeful pages,1–4 blocks/page; text/callout/table + optional image/audio/video intent placeholders, no URLs/assets/providers. Use selected plan context; previous result/refinement retained.
   - Reuse configured text model and existing Responses request pattern (store:false, strict JSON schema, bounded timeout) without paid test calls. Sanitize rich text and normalizeMediaPlaceholder before checkpoint.
2. Add worker handler for authoring_assistance_v2 to immediate dispatch and cron orchestration, using existing fenced service_claim_ai_page/service_ai_page_checkpoint lifecycle. No separate job or ledger system. Preserve old in-flight mode handlers.
3. API route quote/start/apply routing for new kinds. Shared auth/no-store/read/recovery/stop/delete. Validate bounded inputs server side. Generalize contracts/projection reads without breaking Phase1.
4. UI: reuse compact drawer, visible stage/error/reconnect/result/retry/close/stop/delete experience. Avoid giant universal component; share lifecycle pieces sensibly.
   - Quiz default one question, optional direction/count1–3 collapsed. Review options, correct answer/explanation, check/select questions, explicit Add selected. Refinement keeps earlier candidate. Show result and replay receipt on lost save response.
   - Lesson flow: suggest outlines with short optional direction, review/select which to draft (current SQL supports one selected lesson per draft operation; multiple suggestions can each be drafted), quote draft cost, watch completion, inspect pages, explicit Add lesson. No automatic insertion and no old queue redirect.
   - AI results shared list must understand all kinds, link to correct quiz/course destination, retain closed/unapplied candidates indefinitely until deleted, and recover from navigation during save. Current page result types/UI assume page only.
   - Preserve unsaved quiz inputs when opening/closing AI or applying a result. AssessmentBuilder uses controlled local question fields + server-action forms; do not indiscriminately router.refresh/remount or close unsaved new-question form when AI inserts. Need a deliberate save/preserve/reconcile approach.
   - Preserve focus/refinement drafts on errors and within drawer navigation. Before paid work current saved context must be accurate; don't silently discard manual edits.
5. Focused unit/route/worker tests; pgTAP auth/tenant/fingerprint/selection/idempotency/no-assets/validation/receipts/stop tests; real production Playwright flow for quiz and lesson suggestions/draft/application plus Phase1 regression.
6. Typecheck,lint,guardrails,unit,focused DB and browser. Update phase2/product/engineering/RPC docs and report local vs hosted rollout separately.

## Existing code map

### Shared Phase1
- `features/ai-generation/authoring/{contracts,availability,reads,page-assistant,worker}.ts`
- `app/api/admin/ai/authoring/route.ts`, `events/route.ts`
- `components/admin/ai/{AiPageAuthoring,AiPageResult,useAuthoringResult}.tsx` (hook .ts)
- `components/admin/LessonPageBuilder.tsx`: beforeAction saves/awaits autosave; source revision guard and applied receipt reconciliation.
- `app/admin/courses/ai-results/page.tsx`: currently renders AiPageAuthoring list only.
- `features/ai-generation/application/job-orchestration.ts`: recognizes authoring_page_v1; needs v2. `worker.ts` immediate dispatcher always calls processAuthoringPage currently.

### Quiz legacy UI/action
- `components/admin/AssessmentBuilder.tsx` ~850 lines. Bottom ~813 `<form action={generateAiQuizQuestion}>` then background/automatic insertion copy; replace new starts.
- QuestionCardFields ~170 uses local prompt,type,xp,explanation,options state and server action saveQuizQuestion. AssessmentBuilder effect ~570 currently closes showNewQuestion whenever question count increases; beware AI insertion losing draft.
- `app/admin/courses/lessons/[id]/quiz/page.tsx`: requireAdmin,getAdminLesson; quiz exists => AssessmentBuilder; else currently no creation UI. Has searchParams notice only; add aiResult recovery.
- `features/ai-generation/application/quiz-question-jobs.ts` old handler generates ONE from lesson title/description/existing prompts and materializes immediately. Keep old in-flight compatibility, replace new user-facing starts.
- `lib/ai-learning-generator.ts`: generateAiQuizQuestion, QUESTION_RESPONSE_SCHEMA. Existing generation lacks actual teaching context and timeout; new flow should use focused module.

### Lesson legacy
- `app/admin/courses/[id]/expand/page.tsx`: form with expansion goals, optional notes,3suggestions -> generateExpandBrief server action; currently plan then old expand-result workflow.
- `app/admin/courses/expand-actions.ts`: calls generateCourseExpansionPlanCommand then redirects expand-result.
- `features/learning/admin/planner-commands.ts`, `app/admin/courses/[id]/expand-result`, course-text-jobs/job-requests: read before rewiring. Preserve old saved plans/assets and in-flight jobs.
- Existing costs in features/ai-generation/application/organization-ai-metering.ts.

### Media compatibility
- `lib/media-intent.ts`: strict mediaIntent v1 kind/purpose/aspectRatio/required:false/style:inherit, empty src, no assets; normalizeMediaPlaceholder.
- `features/learning/admin/media-generation-brief.ts`: purpose + lesson title/description + page title/subtitle + teaching excerpts; saved payload.mediaBrief overrides, including intentionalemptystring.
- MediaPickerProvider/MediaPickerScreen preserve/edit/autosave brief; live AI media generation remains Phase4, not a fake button. Learners omit empty optional placeholders; editor/review shows them honestly.

## Local environment and testing

- `.env.local` points to HOSTED Supabase, pilot false. **Do not enable it against hosted.** No hosted Phase1 or Phase2 migrations made by this work.
- Local Supabase running; CLI wrapper needs appropriate escalation. Never reset database.
- Single rollout switch remains `AI_AUTHORING_PAGE_PILOT_ENABLED`; Phase2 can expand it compatibly rather than add fragmented switches.
- Local E2E runner sets local Supabase keys/environment, pilot true, dummy providerkey; tests intercept start dispatch with real RPCs and fenced checkpoints, no paid calls.
- Use only ONE typecheck/build process at a time (machine slows severely with concurrent TS compilers).
- `npm run db:types:local` for generated types.
- `node scripts/supabase-cli.mjs test db supabase/tests/database/ai_authoring_page_pilot.sql ...` for focusedDB; pgTAP like() not available, use ok(expr like pattern).
- `PROJECT_VE_E2E_KEEP_BUILD_CACHE=1 npm run test:e2e -- tests/e2e/ai-page-authoring.spec.ts` builds isolated `.next-e2e`, port3100. Do not stop user's 3000/3001devservers.
- `tests/support/media-browser.ts` localfixtureauth/browser helper; actual admin RPC writes, no privileged test-only production backdoors.
- `tests/e2e/ai-page-authoring.spec.ts`:3realRPC/fakeprovider tests, response-loss, optional media brief autosave/reload, no-page reviewquizrecommendation.
- `tests/unit/ai-authoring-worker.test.mjs`,routes,media-intent/media-brief,page-assistant; use registerHooks for aliases/server-only.
- Phase1 last full baseline:197unit,26guardrails,180focusedDB assertions,3productionbrowsercases passed; last copy-onlytrim typecheck/lint passed. Phase2 SQL has not yet been tested beyond successful local migration application.
- `/tmp/build-phase2.py` generated lifecycle migration from Phase1definitions; no need to rerun blindly (would overwrite edits). No active worker/test processes from Phase2 turn.
