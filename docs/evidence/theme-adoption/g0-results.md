# G0 local verification — 8 September 2026

B0 / #96 is implemented and locally verified, awaiting G0 review. Implementer: Codex with scothinks. No hosted release is claimed; #97–#102 remain behind the approved migration gates.

The sole production-source change removes 24 declarations for the 12 approved dead tokens, including one dead alias edge. The refreshed scan covers 549 production files/assets and 7,037 remaining occurrences. Every occurrence has an owner/disposition. The undefined `--ve-soft` uses remain an exact G2 defect; the bounded welcome shadow interpolation is explicitly enumerated. See the [retirement proof](g0-retirement-proof.json), [source inventory](g0-source-inventory.json), [registry](registry.json) and [role dictionary](roles.md).

## Exact source and build

| Artifact | Source SHA | Next build ID |
|---|---|---|
| Pre-deletion reference | `9538a5be09cd7b1db235a383fc1bdffe359fccf5` | `m1sstmH820gGa5e3WFM7j` |
| Verified candidate | `fad782457bb8a5deab05358c5bf1fb39fcd91fca` | `pCLSERG5fWl2upr329ZP1` |

The reference adds only the corrected capture harness to `1c8c100`; its application source precedes all token deletions. The [Git bundle](g0-reference.bundle) preserves that exact reference with prerequisite `1c8c100`, which is in this PR's history. `git bundle verify` passed. Fetch its `codex/identity-g0-reference` ref into a disposable checkout to reproduce it. Later evidence/documentation commits do not change the tested production source.

The [capture manifest](g0-captures.json) records before/after source/build IDs, browser version, PNG hashes, compressed computed-style hashes and generated-CSS hashes. All 33 before/after pairs are retained under `captures/`; computed styles and generated CSS are gzip-compressed without content changes.

## Results

- 33/33 comparisons passed, covering welcome, login focus, personal dashboard, platform course form/select/drawer, organisation course form and organisation learner home at 390/1440px in both OS modes, plus 320px login.
- All computed colour, font, placeholder, focus and active-token values matched exactly.
- 29 PNG pairs were byte-identical. Four pairs contained only existing-edge antialiasing variation: 241 pixels total, at most 88 in one image, and at most 2/255 per channel. Zero disallowed pixels. The comparator rejects flat-field colour changes, alpha/geometry changes, larger deltas and edge variation exceeding 0.05% of an image. Its four focused negative/positive tests passed.
- Source and generated-CSS contracts passed. Twelve scanner tests cover both rejection cases and a valid terminal adapter in source/compiled CSS.
- 270 unit tests and 40 guardrail checks passed, followed by the focused archive-integrity check. Typecheck, lint and `git diff --check` passed. The production build used by the final browser run passed.

Local unit/guardrail runs used installed Node 22.17.1 with `NODE_OPTIONS=--preserve-symlinks` because this isolated checkout shares its existing `node_modules` directory. The older default Node 22.14 lacks the repository's existing `registerHooks` API. No dependency installation or refresh was performed. GitHub CI uses its ordinary Node 22 installation; CI results are separate from these local results.

Run the source/compiled contract with `npm run test:theme-contract -- --generated .next-e2e/static/css`. Reproduction commands and scope limits are in the [G0 guide](README.md). The browser harness uses only disposable local users and an organisation; no database reset, paid provider request or hosted write is part of this verification.

## Visual review samples

| Surface | Before | After |
|---|---|---|
| Welcome, mobile light | [PNG](captures/before/welcome-390-light.png) | [PNG](captures/after/welcome-390-light.png) |
| Login focus, narrow dark | [PNG](captures/before/login-focus-320-dark.png) | [PNG](captures/after/login-focus-320-dark.png) |
| Dashboard, desktop dark | [PNG](captures/before/dashboard-1440-dark.png) | [PNG](captures/after/dashboard-1440-dark.png) |
| Select portal, desktop light | [PNG](captures/before/admin-select-1440-light.png) | [PNG](captures/after/admin-select-1440-light.png) |
| Media drawer, mobile dark | [PNG](captures/before/admin-drawer-390-dark.png) | [PNG](captures/after/admin-drawer-390-dark.png) |
| Organisation learner, mobile dark | [PNG](captures/before/organization-learner-390-dark.png) | [PNG](captures/after/organization-learner-390-dark.png) |

The existing forced-light learner treatment and weak dark media-source foreground remain visible in the baseline. They belong to B2's atomic colour/state cutover. G0 does not claim accessibility remediation or the later full workflow matrix. Roll back this B0 change set as a unit; there is no data rollback.
