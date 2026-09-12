# Identity adoption: contract and evidence

Tracking: [B0 / #96](https://github.com/scothinks/project-ve/issues/96), in the existing [Identity and Entry Experience initiative](https://github.com/users/scothinks/projects/3). Implementer: Codex, working with scothinks. The [approved migration plan](../identity-adoption/2026-09-07/theme-adoption-migration-2026-09-07.md) controls B0–B6. Hosted rollout remains a separate release step. #91 connected entry was subsequently authorised; see current qualification below.

## Current qualification

The user approved B0–B6 and the final welcome/account direction and copy, and
explicitly authorised real auth/XP integration, final CI, commit and push on
2026-09-12. This supersedes the temporary deferred-check/no-commit instructions.
See [connected entry qualification](entry-integration.md) for the current source,
checks and release boundary. Prior G0/B1/B6 captures remain historical evidence.

[B1 extraction evidence](b1-extraction.md) records the verbatim move.
[B2 cutover evidence](b2-cutover.md) records the uncommitted semantic-colour
implementation. [B3 typography evidence](b3-typography.md) records shared signatures,
font coverage and the fixed payload budget. [B4 learning/tenant evidence](b4-learning-and-tenants.md) records scoped neutral retirement
and tenant identity. [B5 operational/browser evidence](b5-operational-and-browser.md) records
zero legacy use, compatibility deletion and dimension-checked A.2 assets.
The registry’s `G5` value selects source-contract enforcement;
it does not assert that rendered qualification has passed.

## Source contract

`g0-source-inventory.json` records the pre-cleanup source SHA, hashes and local/package import edges. The scanner walks production directories from the filesystem (including untracked files), follows local imports beyond those roots and rejects unresolved imports, production symlinks and imports into test/tool/documentation directories. Binary assets are hashed; TS/JS literals are decoded through TypeScript's AST, CSS declarations through PostCSS. Dependencies are not rescanned as first-party code; the installed lockfile and generated CSS accompany build evidence.

`registry.json` owns each occurrence by file, source context and ordinal, with line numbers for navigation. Its identity excludes line numbers so deleting earlier dead declarations does not create false moves. Moving a token to another component, selector or expression changes its identity even if the total count stays constant. B2 replaces the unresolved G0 occurrence rows with current exact source records: terminal role and mode-pair references, neutral adapter ownership, and explicit artwork/data/browser-asset exceptions. The historical G0 source and registry remain in the preserved G0 revision. No current occurrence retains `classify-before-G2`. The [role dictionary](roles.md) documents the active B2 literals. Source pair checks supplement the deferred rendered foreground/background and focus checks.

The 22 neutral adapter mappings are a maximum. They are not active in G0. Direct colour retirement is due at G2, fonts at G3, learner/organisation adapter consumers at G4 and all remaining legacy use at G5. The checker rejects cycles at every gate, nonterminal semantic aliases, unregistered literals/legacy consumers, missing definitions and expired uses. G2 adds exact one-hop root compatibility declarations, mode-value and role-dictionary checks. G5 now enforces empty legacy/temporary allowances and absent compatibility files/imports; all 108 legacy names are retired. Generated CSS is checked with `--generated` after production build and is now wired into CI; integrated results are recorded in [B6](b6-qualification.md).

Two G0 defects/exceptions were exact, not wildcard allowances; both are resolved in B2:

- `--ve-soft`: two undefined organisation-admin backgrounds, recorded with source occurrence IDs and a G2 deadline. B2 rewrites both backgrounds directly to `--ui-surface-soft`; no compatibility definition is introduced.
- Welcome carousel shadow interpolation: two expressions draw from a private, static three-item slide array. The registry lists all three RGB token inputs and pins the whole source-file hash. B2 replaces both constructed shadows with a complete static semantic-shadow expression and removes the obsolete private RGB field and allowance. No CSSOM writes were found. New CSSOM construction or partial/interpolated token names fail until explicitly resolved.

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

Before deleting definitions, use `THEME_EVIDENCE_DIR=/absolute/before npm run test:e2e -- tests/e2e/theme-adoption.spec.ts`. After rebuilding the candidate, use `THEME_EVIDENCE_DIR=/absolute/after THEME_COMPARE_DIR=/absolute/before npm run test:e2e -- tests/e2e/theme-adoption.spec.ts`. Without an explicit directory the normal browser suite writes smoke-test evidence to `test-results/theme-adoption`; only an explicit comparison closes parity. Each capture writes a PNG, computed styles and source/browser/hash metadata. Comparison requires exact computed-style parity. The decoded PNG comparison permits only existing-edge antialiasing variation of at most 2/255 per channel, with unchanged alpha and a maximum of 0.05% of pixels; flat-field changes, geometry changes and larger deltas fail. Every comparison records its measured difference counts. This bound was added after inspecting 59 rounded-edge pixels with 1–2 level browser rasterization differences; there is no automatic snapshot update mode. A changed expectation requires review, never a blanket refresh.

Run `npm run test:theme-contract -- --generated .next-e2e/static/css` after the production build. Capture SHA/build IDs and validation results in this directory before moving #96 to Review. Gate acceptance and later batch activation stay explicit. Roll back B0 as one change set; it has no schema/data changes.

Status: B0 evidence remains immutable. B1 parity and integrated B2–B6 local qualification are recorded in [B6](b6-qualification.md), with 140 final-build captures and whole-build rollback. Current B2–B6 and #91 qualification is recorded in the linked entry integration evidence; no hosted release is claimed.

B2 explicitly scopes Tailwind sources to app, components, features and lib. Archived documentation and test samples cannot preserve retired utility classes. Generated-CSS expiry checks remain mandatory at integrated qualification.
