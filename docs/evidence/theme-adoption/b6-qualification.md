# B6 / #102 — integrated identity qualification

Implemented and qualified locally by Codex for scothinks on 2026-09-09. The user
explicitly batched CI/E2E until #102 implementation and required no commits before
completion. Qualification therefore identifies the uncommitted production source
by SHA-256 and the retained build by Next build ID. It does not misidentify the
unchanged Git HEAD as the integrated source. No commit, push or deployment was made.

## Exact candidate and boundaries

- Base commit: `59ea597af00e0f6a53f3018f18292d410f1be59e`.
- Production source SHA-256: `5a424a3fde4f1c476b7f6ef26988db7a21f4a654273a0eb1d1da0f60129c5a87`.
- Production build: `-IgIVfc-mbDPohrBnQ2Wk`.
- 577 production files/assets; 6,821 classified theme occurrences; all 108 legacy
  names retired. No compatibility stylesheet, aliases or temporary allowances.
- Node 22.17.1, Next 15.5.22, local production server and existing local Supabase.
  APP_MODE=live with local E2E safeguards. No DB reset, hosted writes, paid provider
  requests, schema/data migration or P2 tuning.
- Browser evidence uses `theme-candidate.mjs prepare` before serving the sealed
  build. `freeze` hashes production source; `seal` binds it to build bytes. Tests
  and evidence have separate hashes in the qualification manifest. `prepare`
  verifies all sealed source/build bytes, then preserves the previous disposable
  Next fetch cache under a separate name so fixture seeds cannot reuse deleted
  catalog rows. It does not reset data or change compiled assets.

G6 visual review found two bounded presentation corrections. First, the platform-catalog header:
its workspace record was being rendered as a tenant, showing a “PV” placeholder
and a self-endorsement. AdminShell now uses the canonical platform signature for
that existing workspace ID and retains tenant-owned identity for real tenants.
Workspace switching, labels, permissions and loaders are unchanged. The first
candidate's evidence is preserved; this correction received a new build and
source fingerprint. Second, at 320px with 200% root text sizing, the login footer
was clipped despite the page reporting no horizontal overflow. The footer now
wraps and the base horizontal form/field insets retain their normal pixel width
instead of doubling. New assertions check the actual Terms/Privacy/Support link
bounds. Auth controls, destinations and handlers are unchanged.

## Validation

`npm run ci` passes on the final production source: typecheck, lint, theme
contract, 40 performance/security guardrails, release-readiness checks, 292 unit
tests and production build. Generated CSS passes the G5 contract independently.
Subsequent evidence-helper/cache-preparation changes received focused typecheck,
lint and actual browser execution; the production fingerprint stayed unchanged.
The final focused theme/evidence contracts pass all 22 tests, including artifact
checksums and rejection of an empty flat-contrast evidence set. The temporary
Next-generated type reference was restored to its normal `.next` path after the
isolated build.
The same generated-CSS command is now wired after `npm run ci` in the existing
workflow. Database-type and remediation CI jobs remain intact; their final
GitHub runs await the user's commit/push decision. No manual DB suite was added
for a presentation-only change.

The initial broad browser run exercised all 47 tests: 43 passed and four failed.
The initial log, screenshots and traces remain retained. A subsequent 12-case
check had nine passes, one qualification-fixture failure and two dependent skips:
the one-page course was correctly classified as fully read in the library before
its quiz. A two-page fixture now creates a real partially-read state and finishes
reading through the actual progress API before taking the quiz. No application
completion rule was changed. Another isolated rerun exposed persisted Next public
read cache entries for a deleted fixture; the sealed-build harness now preserves
and replaces only that disposable cache before starting a new test server. The CMS duplication assertion was also aligned
with the two-page qualification fixture and verifies that every duplicated page
receives a new ID. These fixture/read-cache failures and their reruns are retained. Follow-up scope includes
the failed checks, the changed admin header, and expanded exact-build captures;
unchanged passing workflows were not repeated as a second full suite.

| Initial failure | Resolution and scope |
|---|---|
| Partial AI course recovery stayed queued in the fixture | Make both fixture variants exercise the existing fallback polling path by aborting the stream. Real checkpoint and partial retry assertions remain. |
| Tenant switch asserted against a whole header | Check the visible active tenant identity; the hidden switcher correctly retains the other tenant as a choice. |
| Catalog media replacement exceeded the 45-second test budget | Rerun with 180 seconds; keep the byte/rights/revocation assertions. |
| Institutional flow searched for the former Project Ve link | Use the approved accessible name “Learning on Project VE”; preserve the actual learner flow. |

A dependency-copy environment issue initially prevented ESLint from running with
symlink-preservation flags. An APFS copy of the existing installed dependencies,
with the same lockfile and versions, resolved it. No dependency upgrade was made.
Generated CSS initially exposed lossless minifier formatting (`#fff`, `.14`, RGB
comma spacing). Only generated-terminal comparison normalizes those forms;
source literals, aliases, changed channels/values and legacy tokens remain strict,
with positive and negative unit cases.

## B1 parity and matrix

The retained pre-extraction build is `m1sstmH820gGa5e3WFM7j` at
`9538a5be09cd7b1db235a383fc1bdffe359fccf5`. The isolated #97 build is
`uhG_Rv1oiWx0uM4RIq4f3` at `59ea597af00e0f6a53f3018f18292d410f1be59e`.
Original G0 evidence remains unchanged. The current local media catalog contains
two more items than the archived capture; a fresh paired reference was therefore
captured from the retained pre-adoption build against the same current data.
Paired runs exposed optional missions and advertisement sections arriving late,
and house-ad eligibility varying between sessions. For the four dashboard
comparisons only, the final parity harness preserves the settled reference DOM
(with scripts removed) and renders that same content under the #97 build's CSS.
It first verifies unchanged body typography classes. The other 29 surfaces use
live page content. This is a CSS-only parity proof, not a replacement for the
candidate's live dashboard/workflow checks. The two production builds and original
G0 artifacts remain unchanged; exact harness and frozen-content records are kept.
All 33 final comparisons pass with exact computed-style parity and the original
edge-antialiasing bound. No tolerance was relaxed or candidate image promoted to
a baseline. The initial data/timing failures remain in the logs.

The final exact-build matrix has **140 captures** on Chromium 151.0.7922.34.
Ten final-build cases passed across the scoped runs: three admin workspace cases,
identity/assets/fallback, display-italic delivery, lesson preview, personal
completion, CMS authoring, institutional delivery and the theme baseline. The two
AI course cases and catalog media replacement passed their affected reruns on the
preceding candidate; the later login spacing correction does not affect those
workflows. All other unchanged passes from the 47-case broad run are retained.

| Capture group | Count | Coverage |
|---|---:|---|
| Public, login, dashboard, admin and portals | 33 | 390/1440, both modes; additional 320 login; select/drawer focus and dismissal |
| Tenant identity and narrow typography | 19 | Two tenants then personal; long name/no logo; 320/200% root text size; fresh-context font blocking; four mark sizes and real Sans italic specimens |
| Organisation entry display typography | 4 | 390/1440, both modes; actual Source Serif italic and no font preload |
| Lesson and quiz preview | 40 | Five page layouts; retained error, disabled, selected, wrong and correct states |
| Admin dashboard, collapse, tables and settings | 20 | 390/1440, both modes; dense labels/numbers, scrollable tables and operational hierarchy |
| Personal current/completed learning | 16 | Dashboard/library continuation, actual reading/quiz completion, results and completed library |
| Institutional learning | 8 | Two programme delivery contexts and completed tenant Points result |

The 33 G1 comparisons have 186 differing pixels, all within the original edge-only
antialiasing allowance, and zero disallowed pixels. Their computed styles match
exactly. G6 has 6,276 rendered text records: **6,014 flat pairs pass, zero flat
pairs fail**, and 262 records require complex-background review or are disabled.
These are observations across the matrix, not 6,276 distinct semantic pairs.

Manual visual review covered long tenant names, mobile/dark headers, mark scales,
real italics and multilingual specimen text, photo-backed learning/welcome labels,
selected/wrong/correct feedback, portal chrome, current/completed course treatment,
Points units, dense tables, collapsed navigation and the corrected 200% footer.
Mobile tables retain their existing internal horizontal scroll container. Fixed
mobile bars appear at the viewport boundary in full-page captures; those images
do not imply content is permanently obscured while scrolling.

Login/admin request 169,624 encoded bytes for the normal Sans face. The real Sans
italic specimen adds 138,272 bytes. The expressive organisation route requests
346,612 bytes for the real Serif italic, on demand. No captured route has a font
preload; the blocked-font context has no loaded font faces. The complete shipped
font budget remains 1,095,268 bytes within the predetermined 1.1 MiB limit.

Useful retained images: [tenant identity](g6/candidate/tenant-b-long-name-no-logo-390-dark.png),
[current library](g6/candidate/learning-current-library-390-dark.png),
[tenant result](g6/candidate/tenant-points-completed-390-light.png),
[collapsed admin](g6/candidate/platform-collapsed-sidebar-1440-light.png),
[200% text before](g6/before-zoom/entry-320-text200-dark.png) and
[after](g6/candidate/entry-320-text200-dark.png).

Rendered evidence records screenshots, computed roles/styles, browser version,
source/build identity, actual font requests/encoded bytes and loaded font styles.
Flat text/background pairs are measured using ancestor alpha compositing;
an opaque descendant surface correctly obscures an ancestor gradient. The first
contrast pass conservatively marked every body-gradient descendant as complex;
that classification was corrected. A second correction identifies photographic
siblings overlapping text: these require visual review instead of comparing the
text against an unrelated ancestor fill. The affected current-learning and welcome
captures were rerun. Both helper versions and their scope are retained; no
production palette was changed to satisfy the checker.
Normal text requires 4.5:1 and large text 3:1. Disabled controls are exempt and
image/gradient/pseudo-element/opacity backgrounds are flagged for visual review,
not counted as automatic passes. The B5 role-pair contract separately verifies
136 declared foreground/background pairs.

The extra typography specimen uses cloned built signature markup at the four
approved 16/20/24/32px mark sizes. It is explicitly a specimen, not a product
page. Real route captures remain separate. A fresh browser context blocks font
requests for fallback testing so a warm font cache cannot create false evidence.

## Whole-build rollback

The final rehearsal served the preserved previous and candidate builds behind a
local switch. Previous → candidate → previous passed, restored the previous font,
background and navigation, and produced zero missing-asset responses. All 16 prior
immutable asset URLs still resolved after promotion; candidate assets also resolved
after rollback. An already-open previous page remained usable and reloaded.

The rehearsal proxy explicitly retains both immutable asset sets. This verifies
the procedure, not a hosting provider's retention guarantee. Before promotion,
record explicit release authorization and independently prove the host retains
prior assets through its cache window. Roll back the complete application build;
never swap only tokens, CSS, icons or fonts against incompatible consumers.

[The qualification manifest](g6-artifacts.json) hashes every retained capture,
compressed computed-style/contrast record, log, build manifest and historical
parity harness. [The B6 checkpoint](b6-checkpoint.json) hashes cumulative source
and complete previous/candidate application archives. These local build archives
are outside Git; their paths and restoration steps are explicit. Keep them until
an authorised host has durable immutable deployments and retention evidence.

Reproduce against an already running local Supabase with the repository's local
credentials in the environment (never copy credentials into evidence). Use Node
22.17.1 and the pinned lockfile. Set `PROJECT_VE_LOCAL_E2E=1` when building for the
local harness, plus the existing local runner's live-mode configuration.

```sh
export THEME_CANDIDATE_MANIFEST=/absolute/candidate.json
node scripts/theme-candidate.mjs freeze
npm run ci
node scripts/theme-candidate.mjs seal
npm run test:theme-contract -- --generated .next-e2e/static/css
THEME_EVIDENCE_DIR=/absolute/captures npm run test:e2e -- tests/e2e/theme-adoption.spec.ts tests/e2e/identity-release.spec.ts tests/e2e/identity-typography.spec.ts tests/e2e/lesson-preview.spec.ts tests/e2e/admin-workspace-release.spec.ts
node scripts/theme-candidate.mjs verify
```

The retained logs give the broad-run and scoped rerun results, including the
selected `remediation-flows` cases. For rollback, set `THEME_PRIOR_BUILD_ROOT` to
the preserved previous application, `THEME_ROLLBACK_OUTPUT` to an external output
directory, and run `node scripts/rehearse-theme-rollback.mjs` from the preserved
candidate with the same local runtime environment. This manual gate needs two
immutable application artifacts; it is not an ordinary per-commit CI job.
The GitHub workflow separately checks its normal `.next/static/css` output.

## Acceptance limits

Local evidence does not substitute for green required GitHub jobs on the final
committed revision. Keep #102 in Review while those jobs, hosted release approval
and hosted rollout evidence are outstanding. No hosted success is claimed.
The separate #91 entry journey, existing AI/provider release conditions, and
closed P1.5/P2 boundaries are unchanged. An optional dashboard missions dependency
logged a fail-soft 503 during qualification; successful UI checks do not imply
that every optional dependency request was error-free.
