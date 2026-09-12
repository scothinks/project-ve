# Aperture A convergence verification

7 September 2026. Standalone identity board only.

## Checks performed

- `node --check` passes for geometry.js and convergence.js.
- Headless installed Chrome via playwright-core: 1280, 390 and 360px wide,
  two colour hypotheses, four modes and two signature families. 48 combinations
  have no document overflow and no page JavaScript errors.
- Fonts loaded from local files; both families confirmed through FontFaceSet.
- Naked inversion and geometry-note reveal/hide work.
- Every full signature retains exactly A.2's path through type/colour changes.
- Shared Current control updates the identical learning item across learner,
  organisation and tenant views. Three tenant switches preserve this state.
- 360px context uses reduced motion. Initial keyboard focus is visible on the
  first navigation link. All controls use native buttons/selects with focus CSS.
- Computed semantic text/action pairs pass 4.5:1 in all eight palette/mode
  combinations: ink/canvas, ink/surface, muted/surface, muted/current-field,
  on-primary/primary, ink/current-field, ink/support, primary/surface and the
  default tenant text/background. Raw ratios: output/playwright/aperture-convergence/checks.json.
- Native SVG and JSON tokens generated from the same geometry/palette source.
- Exported HTML verified directly from disk: embedded fonts, dark mode, tenant
  switch and shared Current state pass. The initial relative JSON download did
  not fire in file mode; the package now embeds the JSON payload in a data URL.
  The corrected download was captured and its version parsed successfully.
  The 21-file ZIP passes archive integrity checks. Local preview returns HTTP 200.

## Pixels inspected

Naked A → A.1 → A.2 at desktop; actual-size 16/24/32/64 optical proof in black
and inverse; lead signature at desktop and 360px; alternate serif signature;
learner/organisation pair at 390px; desktop dark and inverse pairs; Fieldwork
tenant sample. Current content stays readable and uncut. No extra logo concepts
were introduced. Earlier rounds are retained as historical records.

A.2 softens the regular diamond and breaks the matching terminal rhythm.
Inspection still leaves a broken-link/rounded-bracket association possible.
The identity's human tone comes from type/colour; that does not prove symbol
ownability. Geometry remains provisional.

## Limits

No external first-association study, trademark clearance, physical print test,
real-phone test, screen-reader audit or production accessibility certification.
The 16/24px forms are optical studies, not final hinting or export masters.
Contrast results cover the declared pairs, not arbitrary tenant palettes.
Fonts are full bundled variable TTFs for offline review, not a production font
loading budget or language-subsetting decision. No application/theme/auth/DB
source changed, so application build, DB suites and remediation gates were not
run. No release or deployment is claimed.
