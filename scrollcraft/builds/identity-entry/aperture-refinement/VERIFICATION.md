# Aperture refinement verification

7 September 2026. Standalone design prototype for issue #95, not application code.

## Final local checks

- JavaScript syntax: `node --check` passed for refinement.js.
- New source files: trailing-whitespace check passed.
- Installed Playwright and headless Chrome: 4 geometries × 3 widths (1280, 390,
  360px). All 12 combinations passed geometry propagation to mark/wordmark,
  shared learner/organisation item selection, monochrome Current labels,
  separate organisation identity changes and document-overflow checks.
- Black/white inversion and initially hidden rationale/reveal checked at each
  width. Both naked and inverse screenshots captured.
- Reduced-motion context: content and selection work without movement.
  Initial keyboard tab reaches the header link. No native pointer capture/lock
  used. No page JavaScript errors in the full run.
- Final screenshots inspected: naked marks, desktop learner/organisation pair,
  compact-phone pair, monochrome pair, optical sizes/wordmark, and co-branding.

The first geometry pass produced an angular-C association for Offset. Its outer
shape was changed to an asymmetric lozenge with new 16/24px optical variants.
The full 12-combination pass was rerun after that change. Current screenshots and
`output/playwright/aperture-refinement/checks.json` describe that later pass.

## What the system demonstration establishes

The same sample item remains Current across learner and organisation contexts.
It retains explicit labelling and emphasis in monochrome. Changing the sample
organisation changes only its own name, monogram and accent; Project VE geometry
is unaffected. The larger system uses open-edge/clear-space/focus relationships
instead of copying the logo shape onto every UI element.

These are implemented review-board behaviours, not measurements of brand
recognition. Visual similarity and first-read risks remain visible in the board.
No final mark is declared ownable, cleared or selected.

## Limits

No external participant association study, trademark search, real-phone test,
screen-reader audit, motion/scroll delivery, production auth or performance
measurement was conducted. Proposed product surfaces use explicitly labelled
sample items and fictional organisations. Observation notes are unsaved and not
transmitted. No real credentials, tenant data or account operations are involved.

No app/DB code or dependency changed; production typecheck, lint, build, RLS/RPC,
auth and E2E suites were not required for this local concept update. The existing
entry plan's production acceptance gates remain pending. Source and screenshots
remain local; Wiki decisions and issue tracking are published separately.

A final Counterform correction opens a real gap at each opposing edge; the earlier
paths met at the outer boundary. Its full and optical paths were retested at all
three widths in `counterform-final-checks.json`. Updated naked screenshots reflect
that correction. Other geometries retain their prior passing results.
