# Identity adoption: G0 contract and evidence

Tracking: [B0 / #96](https://github.com/scothinks/project-ve/issues/96), in the existing [Identity and Entry Experience initiative](https://github.com/users/scothinks/projects/3). Implementer: Codex, working with scothinks. The [approved migration plan](../identity-adoption/2026-09-07/theme-adoption-migration-2026-09-07.md) controls B0–B6. This record does not approve an intermediate hosted release or the separate #91 entry-flow changes.

## Source contract

`g0-source-inventory.json` records the pre-cleanup source SHA, hashes and local/package import edges. The scanner walks production directories from the filesystem (including untracked files), follows local imports beyond those roots and rejects unresolved imports, production symlinks and imports into test/tool/documentation directories. Binary assets are hashed; TS/JS literals are decoded through TypeScript's AST, CSS declarations through PostCSS. Dependencies are not rescanned as first-party code; the installed lockfile and generated CSS accompany build evidence.

`registry.json` owns each occurrence by file, source context and ordinal, with line numbers for navigation. Its identity excludes line numbers so deleting earlier dead declarations does not create false moves. Moving a token to another component, selector or expression changes its identity even if the total count stays constant. Existing colours and mixed uses remain explicitly `classify-before-G2`; these rows block G2 until an implementer records the semantic decision. The [role dictionary](roles.md) is a proposed implementation contract for the frozen direction, not a runtime palette or a claim of rendered contrast acceptance. B2 must test actual foreground/background and focus pairs.

The 22 neutral adapter mappings are a maximum. They are not active in G0. Direct colour retirement is due at G2, fonts at G3, learner/organisation adapter consumers at G4 and all remaining legacy use at G5. The checker rejects cycles at every gate, nonterminal semantic aliases, unregistered literals/legacy consumers, missing definitions and expired uses. G2 adds exact one-hop root compatibility declarations, mode-value and role-dictionary checks. Generated CSS is checked separately with `--generated` after a production build.

Two baseline defects/exceptions are exact, not wildcard allowances:

- `--ve-soft`: two undefined organisation-admin backgrounds, recorded with source occurrence IDs and a G2 deadline. G0 does not define it.
- Welcome carousel shadow interpolation: two expressions draw from a private, static three-item slide array. The registry lists all three RGB token inputs and pins the whole source-file hash. Any edit invalidates that review. No CSSOM writes were found. New CSSOM construction or partial/interpolated token names fail until explicitly resolved.

The source parser is deliberately conservative. It proves source coverage and dependency constraints, not CSS cascade, token contrast or arbitrary runtime JavaScript evaluation. The browser checks supply the independent cascade and presentation evidence. No source scan alone closes a visual gate.

## Visual evidence matrix

The deterministic local harness runs a production build with the existing Supabase runner. It uses disposable test users and one organisation, with no hosted fixture writes or database reset. Screenshot captures wait for fonts, visible images and two identical painted frames, disable animation and include computed colour, font, boundary, shadow, focus and resolved active-token values. The 12 dead names are excluded from computed-token comparison because their absence is the intended change. Their aliases have no live consumers.

| G0 representative surface | Widths | Modes | State |
|---|---|---|---|
| Welcome | 390, 1440 | Light, dark | First slide, hydrated |
| Login | 390, 1440; additional 320 | Both; narrow dark | Focused email field |
| Personal dashboard | 390, 1440 | Light, dark | No active learning; learner/dashboard overrides |
| Platform course editor | 390, 1440 | Light, dark | Unsaved form |
| Platform select | 390, 1440 | Light, dark | Keyboard-opened, body portal |
| Platform media drawer | 390, 1440 | Light, dark | Open overlay and Escape dismissal |
| Organisation learner home | 390, 1440 | Light, dark | Empty organisation learning workspace |
| Organisation course editor | 390, 1440 | Light, dark | Organisation workspace |

These representative baselines exercise root, learner, dashboard, admin and body-portal inheritance. They do not claim the later full workflow/state matrix: two-tenant delivery identity, correct/wrong quiz states, 200% text zoom, fallback font payloads and browser icon exports remain required at the gates that change those surfaces. No visual change is permitted in B0 or B1; B2–B5 require the full approved state evidence relevant to their cutovers.

## Reproduction and acceptance

Run `node --experimental-strip-types --test tests/unit/theme-contract.test.mjs` and `npm run test:theme-contract`. CI runs the source contract before the existing guardrails; the negative fixtures run in the existing unit suite. All previous CI commands remain.

Before deleting definitions, use `THEME_EVIDENCE_DIR=/absolute/before npm run test:e2e -- tests/e2e/theme-adoption.spec.ts`. After rebuilding the candidate, use `THEME_EVIDENCE_DIR=/absolute/after THEME_COMPARE_DIR=/absolute/before npm run test:e2e -- tests/e2e/theme-adoption.spec.ts`. Without an explicit directory the normal browser suite writes smoke-test evidence to `test-results/theme-adoption`; only an explicit comparison closes parity. Each capture writes a PNG, computed styles and source/browser/hash metadata. Comparison requires exact computed-style and PNG-byte parity; there is no automatic snapshot update mode. A changed expectation requires review, never a blanket refresh.

Run `npm run test:theme-contract -- --generated .next-e2e/static/css` after the production build. Capture SHA/build IDs and validation results in this directory before moving #96 to Review. Gate acceptance and later batch activation stay explicit. Roll back B0 as one change set; it has no schema/data changes.

Status: baseline capture and retirement verification in progress. No hosted deployment.

The Tailwind build can discover class samples in documentation and tests. G0 keeps its source configuration unchanged. The later colour cutover must exclude archived samples from utility generation; generated-CSS expiry checks remain mandatory so historical evidence cannot preserve retired runtime classes.
