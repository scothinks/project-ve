# Identity and connected entry qualification — 12 September 2026

Scope: #91 and the integrated #96–#102 identity adoption in PR #111. The user
accepted the final design/copy and explicitly confirmed real auth and XP
integration before final checks, commit and push. Earlier standalone-only notes
and the temporary no-CI/no-commit instruction are superseded.

## Result

- The root always offers the approved immersive welcome, with a readable short
  lesson before its question. Correct answers reveal XP and the account action
  with automatic scroll and keyboard focus. Repeated visits remain available.
- The compact login/signup switch retains the reference circle sweep and delayed
  crossfade; mobile has a vertical composition. Reduced motion bypasses animation.
  The welcome card stack expands/contracts on scroll, with a static no-JS/mobile
  fallback and optional fine-pointer photo depth.
- Existing Supabase login, signup/CAPTCHA, Google preparation, confirmation,
  referrals and organisation destinations are retained. Recovery keeps its return
  destination. Session-only login stays session-only when server cookies refresh.
- An HttpOnly HMAC-signed guest receipt lasts 30 days. The server grades the three
  fixed samples; the client cannot choose an amount or claimant. Claims require a
  confirmed authenticated account and a same-origin POST. A receipt has one owner;
  each topic earns 10 XP once per account through private.post_xp_transaction.
  Replaying requests or creating a new receipt cannot duplicate an award.
- Real saved XP leads to the existing rewards store. No reward is granted merely
  by signing up, and existing reward eligibility and redemption rules remain.
- Theme adoption includes terminal semantic roles, shared Source typography,
  frozen platform signatures, tenant identity and browser assets. New entry roles
  are classified and covered by source contrast checks in both colour schemes.
- The approved static prototype remains in scrollcraft/builds/learning-in-motion
  as isolated design/copy evidence; it does not send credentials or award live XP.

## Validation

Node 22.17.1 with the existing lockfile and local Supabase:

- `npm run ci`: PASS — typecheck, lint, source theme contract, 45 guardrails,
  release-readiness checks, 297 unit tests and the production build.
  Lint has 12 existing unused-variable warnings in retained prototype/lab code;
  no lint errors or warnings in the new connected entry modules.
- `npm run test:theme-contract -- --generated .next-e2e/static/css`: PASS.
- `node scripts/supabase-cli.mjs test db supabase/tests/database`: PASS —
  50 files, 1,463 assertions, including 13 new welcome ledger/security assertions.
- `npm run test:e2e`: 53 browser cases pass across the initial suite and
  affected reruns. The final 14-case run passes welcome/auth/recovery, visual
  contracts, signup, lesson/quiz XP, reward redemption, CMS and institutional
  workflows. Earlier still-valid passes cover the remaining AI/media/route cases.
- `npm run db:types:local:check` and `git diff --check`: PASS.
- Production source SHA-256: `28bb191674462569c21e93347414f5567bef4fbcce5bf379cca346f39b79482d`.
- Sealed build ID: `oxcJLvjD9hgnuqzwBtOlQ`.

[Checksummed logs, selected screenshots and per-case results](entry/qualification.json)
record the local qualification. Desktop/mobile screenshots were visually inspected.
After the final build, changes update test selectors, evidence/documentation and
remove trailing whitespace from one blank source line and font licence text.
The fingerprint above identifies the exact built candidate before that whitespace cleanup.

The first integration browser pass exposed an internal-host origin comparison
and focus returning while the switch container was still inert. Both were fixed
before the final build. The first database pass exposed a fixture referral-code
collision and an omitted RPC inventory entry; both were corrected without
broadening permissions or weakening assertions. Further browser corrections
covered desktop header contrast, clearing recovery state, and waiting for the
reference transition before filling controlled fields. The retained dashboard
capture now targets the continuation card instead of its removed decorative
class. Stable-frame capture uses the existing strict edge-only 2/255 raster
comparison; its geometry and flat-field rejection rules are unchanged.

## Original qualification release boundary (superseded for migration status)

This change set is intended for review on the existing identity branch and PR.
At the original qualification, no hosted migration or production deployment had
been performed. The later hosted migration follow-up below supersedes that status.
The original release requirement was to apply
`20260912150000_welcome_progress_claim.sql` before deploying the connected entry
routes. The existing required `OAUTH_SIGNUP_PROOF_SECRET` signs domain-separated
welcome receipts; no new secret is introduced. Hosted Google configuration,
CAPTCHA, email delivery and confirmation/recovery redirect allowlists require the
normal environment qualification. Local tests do not claim a real Google login
or external email delivery. The older B6 rollback experiment qualifies only its
recorded build; release rollback must treat these entry routes and their new
migration as one versioned change set. The additive ledger migration must not be
rolled back by deleting XP history.


## Welcome reward card hierarchy follow-up

12 September 2026. User-requested presentation correction on the connected
React welcome card. The first successful answer leads with “You’ve put a new
idea to the test.”, then one “+10 XP earned” chip and “Lessons and missions earn
XP you can use for rewards.” The Save my progress action and exact 30-day
fine print remain. Lesson XP, Ready to save, the duplicate balance and the
account explanation beneath the button are removed. Repeated samples retain
the existing repeat heading and an “XP already earned” chip; previously saved
samples still lead to rewards without claiming a new award. No API, database,
receipt-signing, claim or authentication behavior changes.

Validation on the changed source:

- `npm run typecheck`, `npm run lint` and `git diff --check`: pass. Lint retains
  the 12 pre-existing prototype warnings; no new warnings.
- `npm run test:theme-contract` and the generated `.next-e2e/static/css` check:
  pass in both colour modes.
- `node --experimental-strip-types --test tests/unit/welcome-progress.test.mjs`:
  5 pass. Guardrails pass all 45 checks with Node 22.17.1 via
  `/opt/homebrew/opt/node@22/bin/node scripts/test-performance-guardrails.mjs`.
  The first guardrail run used Node 22.14 and failed on missing `registerHooks`;
  the supported-runtime rerun resolves that tooling failure.
- `npm run test:e2e -- tests/e2e/welcome-entry.spec.ts --grep 'welcome lesson, server-graded'`:
  fresh production build and the existing full local lesson → signup → saved
  XP → rewards case pass, including replay and already-saved behavior.
- Headless Chrome captures inspected at 1440px, 1280px, 390px and 320px, plus
  dark desktop. The heading is largest (28px desktop / 24px mobile); the chip
  is 16px. Supporting copy stays on one line at both desktop widths at 16px
  and wraps naturally at 15px on mobile. One XP value only, correct DOM order,
  focus, save-to-auth destination and repeated-answer state verified; no
  horizontal overflow or page errors. Local captures and measurements are in
  `output/xp-card/`. The pre-existing development server timed out; successful
  captures use the fresh production build on port 3101.

This follow-up is locally verified and uncommitted. No hosted deployment,
physical-device qualification or wider application regression run is claimed.


## Background sample XP and hosted migration follow-up

User-approved scope: apply the missing welcome migration and remove the saving
screen from login/signup. Existing and new confirmed users earn 10 XP once per
fixed sample topic (30 XP maximum), with ledger and notification updates in the
background. This supersedes the earlier account → saving screen → rewards path.

Implementation:

- A root client worker performs a same-origin authenticated POST only when a
  readable pending hint differs from its acknowledgement. The signed HttpOnly
  receipt remains authoritative; neither hint nor client totals can mint XP.
- Login, signup and OAuth callbacks preserve normal destinations, including new
  learner assessment, recovery and organisation context. Legacy `/welcome/save`
  links redirect immediately; no saving/retry/success page is shown.
- Network/server failures retain progress, retry with bounded delays, and wake on
  browser visibility, connectivity or navigation. Closing the browser does not
  guarantee immediate delivery; the 30-day receipt allows retry on return.
- Acknowledgements identify the claimed snapshot and do not delete a newer signed
  receipt. A new completion after acknowledgement receives a fresh receipt while
  retaining the lesson-read state. Cross-account receipt reuse remains denied.
- Correct answers by signed-in users trigger a claim without a save click. Guest
  “Save my progress” enters authentication with its normal dashboard/assessment
  destination. Successful claims update the card's rewards action without moving
  focus, scrolling or refreshing the open lesson/assessment.
- `20260912160000` adds preference-aware `welcome_xp_earned` notifications only
  for new ledger awards, reports `awardedXp` for conditional balance refresh, and
  retains all existing service-role/private primitive boundaries. Existing
  first-XP notifications are retained. Push-permission prompts are suppressed on
  welcome, login and onboarding.

Hosted database evidence (12 September 2026):

- Before application, the linked ProjectVE migration ledger stopped at
  `20260907110000`; REST schema inspection found no welcome claim RPC.
- Applied `20260912150000_welcome_progress_claim.sql`; the REST schema now exposes
  `service_claim_welcome_progress` with the expected three arguments.
- Applied the locally tested `20260912160000_welcome_progress_notifications.sql`.
  Both dry runs contained only their respective migration, no roles or seeds.
  The final linked dry run reports `upToDate: true` with no pending migrations.
- Native Supabase CLI used the existing active login. The repository wrapper's
  isolated HOME is for local tooling and did not contain that hosted login.

Validation on Node 22.17.1 and local Supabase:

- Typecheck, lint and source/generated theme checks pass. Lint retains only the
  12 previously documented prototype warnings.
- `npm run test:guardrails`: 53 assertions pass, including route-level signed
  receipt/identity/origin checks, retry and acknowledgement behavior, preserved
  open-lesson state, auth fail-soft context, and no XP mutation from rendering/GET.
- `node scripts/supabase-cli.mjs test db supabase/tests/database`: all 50 files /
  1,469 assertions pass. Welcome coverage includes 19 ledger, role, ownership,
  duplicate/replay, existing-user and notification-preference assertions.
- `PROJECT_VE_E2E_KEEP_BUILD_CACHE=1 npm run test:e2e -- tests/e2e/welcome-entry.spec.ts`:
  fresh production build and all five browser cases pass. Tests hold XP requests
  at 503, prove signup still reaches assessment, then allow retry and verify the
  real balance/notification while the assessment remains unchanged. They also
  cover signed-in automatic awards, existing-account login with guest progress,
  replay, legacy links, three account-switch widths and session-only recovery.
- The first browser pass identified focus scheduled before result DOM commit on
  a later lesson. Moving that focus operation into a committed effect fixed it;
  the final full five-case rerun passes.

Release state: both database migrations are live. The reward-card and background
application changes remain local/uncommitted in the identity worktree and need
application rollout before production loses the saving screen. No production
account or XP transaction was created as a test. Hosted OAuth/email delivery is
not claimed by the local browser suite. Preserve the ledger during any rollback.
