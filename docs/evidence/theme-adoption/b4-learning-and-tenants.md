# B4 learning presentation and tenant ownership — 2026-09-08

Subsequent integrated qualification: [B6 exact-source results](b6-qualification.md).
The dated implementation record below preserves what was known at that checkpoint.

Tracking: [#100](https://github.com/scothinks/project-ve/issues/100). Implementer:
Codex with scothinks. Source implementation is uncommitted on the preserved B1
base, together with B2/B3. The user's batch cadence defers CI/E2E and integrated
build/browser qualification until #102 is implemented. No push or deployment.

## Changes

- Organisation name and complete logo lead learner mobile/desktop chrome and
  organisation admin identity slots. `TenantIdentity` and `TenantLogo` consume
  existing authorised props, use contain-sized artwork without circular cropping
  or Aperture masks, and provide decorative initials when no URL exists. Names
  wrap, including long unbroken names; logo artwork retains its own colours.
- Neutral `Learning on project v/e` attribution sits on a separate line, below
  tenant identity. Points and the workspace control occupy separate slots. Admin
  identity keeps the existing role/lifecycle information and workspace selection
  behaviour. Mobile admin identity is shown once, and controls wrap below it.
  The platform-catalog pseudo-workspace keeps its existing platform presentation.
- Workspace switching and My Orgs use the same contain-style logo. Current
  workspace/navigation links expose `aria-current` from the existing active
  comparisons. Personal rendering does not inherit tenant props or CSS variables.
- Dashboard continuation, in-progress editorial learning and organisation
  continuation use the supported current field, a 16px released corner and 3px
  leading rail. Only a decorative pseudo-element is clipped; no content/control
  clipping is introduced. Existing flags determine styling. New, completed,
  selected and correct/wrong states retain their distinct semantics.
- Neutral references are migrated directly across B4 learner/navigation/org paths,
  the shared delivery renderer, reward learner UI, learner shell selectors, and
  the two tenant-admin functions. 562 legacy references are removed (2,687 →
  2,125). All 22 adapters still have live B5 consumers, so none is prematurely
  deleted. G4 rejects legacy use by structural scope even if a row claims B5.
- The hexadecimal scanner now handles Tailwind underscore separators. Previously
  missed reflection, quiz-track, unread-border and profile-error colours are
  replaced by existing semantic roles. The reward placeholder and lesson-menu
  shadow also consume their relevant roles. Stored presets, media/QR artwork,
  Points labels, grading and progress logic are unchanged.

## Evidence

[Source evidence](b4-source-evidence.json) records 572 production files/assets,
6,868 occurrences, current-background contrast checks and unchanged hashes for
protected context, repository and progress modules. Remaining compatibility
consumers have exact B5 ownership. No tenant reads, root overrides, cache changes,
new auth paths or changes to course/programme identity were introduced.

Focused validation passed:

- `npm run typecheck`, `npm run lint`, `git diff --check`.
- `node scripts/check-theme-contract.mjs`: G4 passes, including all 136 source
  contrast pairs (10 additional ordinary-text/action/focus pairs on current fields).
- 36 focused unit/evidence checks, with affected subsets rerun after changes:
  learning presentation, signature/fonts, theme contract, organisation identity,
  organisation transcript isolation, media placeholder rendering and checksums.
- The existing `test:guardrails` runner: 40 checks passed. It covers first-useful
  dashboard HTML, bounded workspace reads, projection/publication, auth and media
  boundaries. No independent CI workflow was added or run.

The six presentation tests render actual shared components to strings. They cover
long/missing/logo props, A → B → personal isolation, tenant-before-endorsement
order, Points, active navigation, new/in-progress/completed course distinctions,
resume URLs and the same course in two programmes with separate completion counts.
The exact existing **24px** lesson-preview browser assertion is unchanged. The
new parser fixture prevents hexadecimal literals from hiding behind underscores.
Tests use Node 22.17.1 with `NODE_OPTIONS=--preserve-symlinks` in this linked workspace.

This is source acceptance, not rendered G4 acceptance. After #102, qualify actual
mobile/desktop and light/dark layout, 320px and 200% text zoom, transparent/wide and
broken-logo cases, dense admin controls, portals/focus, current/completed states,
course deliveries, lesson preview/publication, missions and first-useful HTML.
Actual font delivery, visual clipping/contrast and browser interaction remain
unverified. No CI, E2E or production build was run for this issue.

## Checkpoint and rollback

`b4-checkpoint.json` records the cumulative patch and new-file archive against
B1 `59ea597af00e0f6a53f3018f18292d410f1be59e`; B2/B3 checkpoints remain intact.
Restore the complete G3 application to roll back B4, including its compatibility
consumer code and definitions. No data/schema rollback is involved.

A preservation defect discovered at B4 start is corrected: the generic `coverage`
ignore rule excluded B3's five production fallback-font/licence files from the
new-file archive. A narrow `.gitignore` exception now includes that exact directory.
The B4 archive includes the unchanged files. A separate `b3-font-retention.tar.gz`
supplement, recorded in the B4 checkpoint, restores those exact manifest-pinned
bytes alongside the original B3 checkpoint. Neither historical archive is rewritten.
Future checkpoints verify every production asset is tracked or included, so this
omission cannot silently recur. No extra font bytes or font design were added.
