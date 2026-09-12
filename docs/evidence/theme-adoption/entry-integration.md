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

## Release boundary

This change set is intended for review on the existing identity branch and PR.
No hosted database migration or production deployment is performed here. Apply
`20260912150000_welcome_progress_claim.sql` before deploying the connected entry
routes. The existing required `OAUTH_SIGNUP_PROOF_SECRET` signs domain-separated
welcome receipts; no new secret is introduced. Hosted Google configuration,
CAPTCHA, email delivery and confirmation/recovery redirect allowlists require the
normal environment qualification. Local tests do not claim a real Google login
or external email delivery. The older B6 rollback experiment qualifies only its
recorded build; release rollback must treat these entry routes and their new
migration as one versioned change set. The additive ledger migration must not be
rolled back by deleting XP history.
