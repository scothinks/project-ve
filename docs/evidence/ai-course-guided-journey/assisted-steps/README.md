# Delivered assisted journey

These are **after** captures from the local production build at `1ec111c`.
The later copy-only refinement shortens Catalog pricing to “0 credits” and removes
the repeated explanation; these screenshots retain their original wording. They show the existing shared theme, not the separate
future identity migration. The contrasting `../before/` directory is explicitly
a reconstruction of the original form at `0a1d7b9`.

1. `assist-start.png`: begin with a rough idea, choose a starting point, or use a
   complete brief. There is no required audience field or AI-results tab here.
2. `assist-direction.png`: choose a useful learning direction.
3. `assist-learners.png`: describe the learners with setting choices, free text
   or “Not sure yet.”
4. `guided-1440.png`: edit the assembled brief and choose the priced Generate
   outline action. This Catalog fixture uses no organisation credits; the
   metered action and its separate draft charge have browser coverage.

The remaining captures cover 390px, 320px, dark/reduced-motion and 200% text.
They come from the uncertain-author browser journey in
`tests/e2e/ai-course-discovery.spec.ts`. That journey uses bundled suggestions and
intercepted guidance, never a paid provider call. These images establish UI
behavior and layout, not real-model quality or participant usability findings.

Full-page capture resets scroll position so a previously focused field does not
place the sticky header at an artificial offset in the exported image.
