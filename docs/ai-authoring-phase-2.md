# AI authoring Phase 2 — quiz and lesson assistance

Date: 2026-09-06. Status: implementation complete and locally validated.

## Delivered behavior

Quiz authoring starts with one single-choice question and optional direction/count
(up to three). It uses saved teaching excerpts and existing prompts. Editors see
answer options, the correct answer and explanation, then explicitly add selected
questions. A lesson without a quiz can create its first quiz through this same
application boundary. Questions retain the existing 10 XP and attempt rules.

Additional lessons start with one suggestion, with optional focus/audience and up
to three suggestions. Each selected suggestion has a separate draft quote. The
editor previews its one-to-four pages, can refine while retaining earlier
versions, and explicitly adds the draft. Each suggestion can be drafted separately.
Neither planning nor generation inserts or publishes content automatically.

Both flows use the existing durable jobs, leases, reservations and checkpoints.
Immediate dispatch and cron recognize `authoring_assistance_v2`; old in-flight
handlers remain available. Closing retains results. The Courses AI results panel
and course/lesson filters expose result type, recovery links, stop and deletion.
Results have no automatic expiry.

Unsaved quiz inputs remain in the editor when AI opens or closes. Quoting,
starting and adding explain that changes must be saved first. Saved context is
checked again at the database boundary. React refresh preserves existing question
fields and an open new-question form; only saving that new question closes it.
An application persists selected indexes before the atomic content transaction.
Concurrent requests reuse that selection and the same receipt. Lost responses
remain uncertain until reconciliation; a confirmed database failure rolls back
all inserts and retains an actionable failure and candidate.

## Inline media clarification

The user explicitly confirmed that image, video and audio inside content blocks
are at the editor's discretion. Missing inline media never blocks review or
publishing, including legacy `required:true` blocks or old required inline seeds.
There is no replacement semantic gate for text that mentions missing media.
Existing cover/thumbnail requirements remain; no new cover quota was introduced.
Actual attached assets retain ownership, placement, revocation and publication
integrity checks. Empty placeholders remain absent from learner rendering.

Text generation creates only optional intent placeholders; it neither creates
media files nor reserves image credits. Purpose and editable contextual briefs
survive application. Assistant-created lessons use explicit text/quiz/media review
without the obsolete image-seed workflow. Review is revision checked, records the
reviewer, and leaves publication as a separate action.

## Boundaries and implementation

- Focused provider/schema/validation/worker modules live in
  `features/ai-generation/authoring/assistance-*.ts`.
- A private locked source fingerprint covers course/lesson teaching and quiz
  content, including concurrent block/option updates and child inserts. Quote,
  start and application reject changed or moved targets rather than overwrite.
- Teaching context is bounded and private to the worker. Status/list reads are
  authenticated, paginated and `private, no-store`; they do not start work.
- Page quote/prepare/apply reject non-page candidates. Operation-specific
  validation runs at checkpoint and again at application.
- Quote/start uses the existing metering formulas: quiz 20 per question, lesson
  suggestions 35 + 12 per requested suggestion, selected lesson draft 135.
  Application and receipt replay do not charge again.
- The provider keeps `OPENAI_TEXT_MODEL`, strict JSON schemas, `store:false`, a
  120-second timeout and a single request. Refusal/incomplete/invalid output fails
  through the existing started-work settlement policy. No automatic paid retry.
  The request shape follows the official
  [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs).

## Local migrations

Apply in order after Phase 1, without a reset:

1. `20260906090000_ai_assistance_lifecycle.sql`
2. `20260906100000_ai_assistance_application.sql`
3. `20260906110000_ai_assistance_boundary_closure.sql`
4. `20260906120000_inline_media_editor_discretion.sql`
5. `20260906130000_ai_assistance_retry_context.sql`
6. `20260906140000_ai_assistance_cover_review.sql`

These have been applied locally. The initial handoff migrations were already
applied locally; corrections therefore use forward migrations. Generated database
types include the new RPCs and course-filtered result read signature.

## Validation

This task follows the [canonical testing cadence](codex/skills/project-ve-guardrails/SKILL.md). Its acceptance checks cover saved teaching context, explicit selective application, retained versions, idempotent recovery, credits, editorial review/publication and Phase 1/media regressions.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed; final production build also passed type and lint checks |
| `npm run lint` | Passed without warnings |
| `npm run test:unit` | 205 passed |
| `npm run test:guardrails` | 28 passed |
| `npm run test:db` | 44 files / 1,198 assertions passed; the final Phase 2 file also passes 60 assertions, including 7 additional failure/tenant contracts |
| `npm run db:types:local:check` | Passed |
| Production Playwright | Build passed; 10 browser scenarios passed |
| `git diff --check` | Passed |

The final browser command was:

```bash
PROJECT_VE_E2E_KEEP_BUILD_CACHE=1 npm run test:e2e -- tests/e2e/ai-assistance-authoring.spec.ts tests/e2e/ai-page-authoring.spec.ts tests/e2e/lesson-publication.spec.ts tests/e2e/media-release.spec.ts
```

The final additional database command was:

```bash
node scripts/supabase-cli.mjs test db supabase/tests/database/ai_authoring_assistance.sql
```

The first browser pass caught a test selector collision between retained quiz/page
results sharing a title. Result rows now expose their operation identity for
precise recovery selection; the full final browser pass succeeds. This preserves
retention instead of deleting unrelated results to make tests pass.

The browser suite exercises real local authentication/RPCs/checkpoints and
application, with only provider dispatch replaced by fixtures. It covers selection,
separate quotes, refinements, navigation/lost-response recovery, concurrent saves,
manual input preservation, empty-quiz creation, desktop/mobile previews and review
through publication. Phase 1, lesson publication and attached-media regressions
are included. New tests are automatically included in the existing unit, database,
Playwright and remediation CI gates; no separate test command is required.

## Rollout limits

This closes the local Phase 2 product implementation. It does not authorize engineering P2 query/index tuning or redesign Phases
3–6. The single `AI_AUTHORING_PAGE_PILOT_ENABLED` switch remains default off.
No hosted migration, deployment, database reset or paid provider call was made.
Hosted migration replay, live model quality/latency, immediate-dispatch behavior and
outage telemetry must be checked before hosted activation. Those are rollout
checks, not evidence supplied by local fixture generation.
