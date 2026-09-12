# Concept review verification

7 September 2026. This verifies the review board, not production authentication.

## Scope

New standalone concept files only: index.html, study.css, study.js, BRIEF.md,
ENTRY-PLAN.md and this record. No application source, dependency, DB, migration,
auth policy or theme file was changed. The blank scroll-craft fingerprint
registry is initialized but contains no shipped-build claim.

## Checks

- `node --check scrollcraft/builds/identity-entry/study.js`: pass.
- `git diff --check`: pass; new files separately checked for trailing whitespace.
- Installed Playwright with headless Chrome: four territories at 1280×900,
  390×844 and 360×640. All 12 combinations passed territory switching,
  document-width overflow checks, audience state, depth control, personal
  signup, organisation creation, returning login, invitation and back navigation.
- No page JavaScript errors or failed resource requests in that run.
- Reduced-motion check at 390px: depth control hidden, plane transforms
  removed, complete scene and actions retained. Initial keyboard tab reaches
  the header link. This is a focused keyboard check, not an accessibility audit.
- JavaScript-disabled check: explanatory fallback and written-document links.
  No real form submission or credential collection exists in the board.
- Final organisation-mark checks exercise a distinct fictional NC monogram,
  context label and restoration of the platform mark when returning to generic
  login. The separate result file records this final pass.
- Screenshots captured for every territory and viewport, including auth
  previews; detailed identity, welcome, invitation and depth endpoints also
  captured. Evidence lives under `output/playwright/identity-entry/` (local
  review output), in `results.json`, `final-checks.json`, `depth-final-checks.json` and PNG files.

Visual inspection covered the four-mark comparison, Aperture desktop wordmarks
and welcome, Assembly phone layout, Cadence phone auth, Continuum compact-phone
auth, and invitation context. The first review identified an overly generic
opening in Aperture and a scene caption too close to the artwork. The final
geometry uses a stepped cut; the redundant scene caption was removed after
its baseline overlapped the artwork at maximum depth. Organisation
invitation uses its own sample monogram instead of reusing the platform symbol.

The Playwright skill's npm wrapper could not expose its `playwright-cli` binary
after network access; verification used the already installed Playwright runtime.
The scroll-craft preflight found ffmpeg absent and KIE_AI_API_KEY unset. No video
or image generation was attempted; vector studies require neither.

## Limits

This is a selection board with responsive illustrations, not a full scroll page,
final vector asset package or connected authentication implementation. No claim
of scroll-craft's full scroll/feeling/fingerprint delivery gate is made. The
feeling curve is a design intention awaiting a selected connected prototype.

No real phone, assistive-technology audit, all-state auth browser run, contrast
audit over motion, production build, field Core Web Vitals, hosted rollout or
trademark clearance was performed. Font names describe directions; system fonts
are illustrative. Performance targets are proposed and not yet agreed. App
typecheck/lint/build and DB suites were not run because no app or DB code changed.

## Review and tracking

Both original issues are attached to the Identity and Entry Experience initiative;
their old Task Log entries are removed. Both stay open for design review. The
Wiki records confirmed decisions; issues record active scope and remaining work.
The application concept source remains local and uncommitted at this checkpoint.
