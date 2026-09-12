# B2 semantic colour cutover — 2026-09-08

Subsequent integrated qualification: [B6 exact-source results](b6-qualification.md).
The dated implementation record below preserves what was known at that checkpoint.

Tracking: [#98](https://github.com/scothinks/project-ve/issues/98). Implementer:
Codex with scothinks. Implementation is uncommitted on the preserved B1 base
`59ea597af00e0f6a53f3018f18292d410f1be59e`. The user prohibited further commits
until the work is finished and deferred CI/E2E until #102 implementation is complete.

## Scope and source decisions

- `theme.css` defines literal light/dark semantic roles. It replaces the temporary
  `theme-legacy.css`; `theme-compat.css` contains only the 22 permitted neutral
  one-hop adapters, each with exact consumer IDs and B4/B5 ownership in the registry.
- All 72 G2 names are absent, including the previously undefined background token.
  Learner/dashboard colour declarations and forced light mode are removed.
  Atmospheric surfaces and fallback cover gradients now follow OS mode.
- Actions use aubergine with paired foregrounds; current selection, progress,
  completion/success, warning, danger, information and reward/category roles remain
  distinct. Shared buttons, quiz choices/results, mission proofs, XP badges,
  selected navigation, switches and body-portalled controls use the relevant pairs.
- Forced white action labels and hue shadows are removed. A root focus outline
  sits outside control fills with a visible gap. Meaningful form borders use a
  distinct opaque role; decorative separators retain their neutral treatment.
- Persisted presets, native colour-input defaults, third-party sign-in artwork,
  illustration samples and media scrims remain explicit source exceptions. Reward
  thumbnail fallback ink is fixed against its existing pale artwork. Browser icon
  and viewport colours remain owned by B5. No font/signature work is included.
- Tailwind source discovery is restricted to production app/component/feature/lib
  paths so historical class samples cannot keep retired utilities alive. The source
  parser now detects colour functions preceded by Tailwind underscores.

The current registry records each exact source occurrence, role/mode-pair reference
or exception, and owner. The G0/G1 source and evidence remain historical. Selecting
`G2` is a source-enforcement stage, not a claim that the visual gate has passed.

## Focused validation

- `node scripts/check-theme-contract.mjs`: passed; no unresolved dynamic use,
  no G2 token occurrences, no missing roles and no chained/scoped legacy adapters.
- 126 terminal source contrast pairs pass. [Measurements](b2-source-contrast.json)
  cover normal/hover/pressed/soft actions, state pairs, ordinary text, meaningful
  control boundaries and focus against the documented surrounding surfaces.
- `node --experimental-strip-types --test tests/unit/theme-contract.test.mjs`:
  14 passed, including literal-shadow detection and dark-primary contrast failure.
- `npm run typecheck`, `npm run lint`, `git diff --check`: passed.
- AST review of 161 changed TS/TSX production files found unchanged structure,
  identifiers, numeric values and JSX copy in 160. The sole structural exception
  is removal of the welcome carousel's private shadow-RGB presentation field;
  its effects, navigation and readiness behavior are unchanged.

No CI, E2E or production build was run. Source contrast cannot establish rendered
contrast over arbitrary images, layered surfaces or browser-dependent states.
Build/generated-CSS, the full rendered state matrix, workflow parity and visual
acceptance remain pending at the integrated qualification point after #102.

## Preservation and rollback

The uncommitted filesystem checkpoint is described in
`b2-checkpoint.json`. It contains the diff against B1 and new files, without a new
Git commit. Subsequent work must preserve the checkpoint for deferred B2 checks.

Restore the whole B1 application for rollback: tokens, imports, consumers and
source policy together. Never revert only the palette beneath migrated consumers.
This batch has no schema/data changes and does not authorise deployment.
