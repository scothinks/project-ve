# B1 stylesheet extraction — 2026-09-08

Tracking: [#97](https://github.com/scothinks/project-ve/issues/97). Implementer:
Codex, working with scothinks. Parent revision:
`27f1d9a12366b467500c8a275320290e1c9a9864` (the preserved G0 implementation).

## Implementation

Moved the 153-line root light/dark block, including its comments and
`color-scheme` declarations, verbatim from `app/globals.css` to
`app/styles/theme-legacy.css`. The local import follows the existing Tailwind
import, precedes all other rules and adds no cascade layer. Scoped learner and
dashboard overrides retain their original order. This temporary file expires
in B2 when the approved semantic colour cutover replaces it.

The occurrence registry moves only the 264 parsed occurrences in that extracted
block to the new path and adjusts navigation line numbers for remaining live
globals occurrences. Ownership, dispositions, values and source contexts stay
unchanged. Retired G0 records and archived G0 evidence are retained. `G1` selects
the current source-contract policy; visual acceptance is still pending.

## Focused source evidence

- A byte comparison during extraction confirmed that replacing the new import
  with the extracted contents reconstructs the original `globals.css` exactly.
- `node scripts/check-theme-contract.mjs` passed: 550 production files/assets,
  7,037 occurrences; no unclassified additions or unresolved dynamic theme use.
- `git diff --check` passed.

No CI or E2E run was started for B1. No build, generated-CSS or browser parity
result is claimed. Source equivalence does not prove bundler or browser parity.

## Deferred qualification and rollback

The user's 2026-09-08 instruction batches CI and E2E until #102's implementation
is complete. At that integration point, qualify this preserved B1 revision
against G0 with the production build, generated-CSS contract and existing
computed-style/screenshot matrix, including root, learner/dashboard overrides
and body portals. Qualify later intentional visual changes against their own
approved scope. Do not substitute the final palette's screenshots for B1 parity
or accept unexplained differences. Record results before closing the gate.

Keep B1 as a local commit so this source can be rebuilt later. Do not push before
the integration point because the branch triggers CI automatically. This does
not authorise deployment. Roll back the extraction, its import and registry
relocation together; no schema, data or server behavior changes are involved.
