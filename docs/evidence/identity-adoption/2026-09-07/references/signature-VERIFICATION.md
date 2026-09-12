# Signature study verification

7 September 2026. Local signature exploration, no production changes.

- Syntax: `node --check study.js` passes.
- 18 combinations: 1280/390/360px, light/dark, three tenants. No page JavaScript
  errors or document overflow. All context signatures fit their parent bounds.
- All SVG paths are exactly Aperture A.2. SHA-256 checks confirm preceding
  geometry.js, convergence.css, convergence.js, identity-tokens.json and both
  font files are unchanged (fixed-source-manifest.json).
- Each current/proposed context pair has identical inner markup after signature
  content is removed. Learning content, Current state, programme/cohort and
  tenant identity hierarchy remain the same. Contexts use the previous CSS.
- Canonical accessible names remain Project VE for both visual signatures.
- Light/dark and three tenant switches work; 360px uses reduced motion.
  Initial keyboard focus reaches the first navigation link.
- Visual inspection: desktop typographic trials, actual-size 14/16/20/24/32px
  pairs, compact pair, dark phone learner pair and dark Fieldwork endorsements.
- Pixel inspection found large mobile specimens crossing their tile bounds
  despite no document overflow. Study framing now uses 38px specimens on phones;
  focused 390/360px checks confirm all four signatures fit, and screenshots were
  regenerated and inspected. Product signatures were not resized.

The strongest working treatment uses lowercase project v/e, Source Sans 3 at
600, native slash angle at 500, 0.035em slash side spacing and a 0.22em word gap.
The slash remains clear at 16px in headless screenshots; 14px remains a stress
test, not a recommended minimum. The desktop/mobile specimen sizes are review
framing, not a new product type scale.

Raw evidence: output/playwright/signature-study/checks.json and screenshots.
The self-contained export was also opened directly from disk at 360px: embedded
fonts, dark mode, tenant switching, canonical names and layout pass. The 19-file
ZIP passes archive integrity checks; the local review URL returns HTTP 200.
No new contrast calculations were needed: colour roles and type sizes in the
product contexts remain unchanged from the preceding validated study. This is
not a full accessibility audit, external naming/recognition study, print test
or real-device proof. App/DB suites were not run for isolated review files.

No final signature adoption, new type system, new palette, modified A.2 path,
redesigned product surface or production theme release is claimed.
