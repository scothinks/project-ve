# B3 typography and shared signatures — 2026-09-08

Subsequent integrated qualification: [B6 exact-source results](b6-qualification.md).
The dated implementation record below preserves what was known at that checkpoint.

Tracking: [#99](https://github.com/scothinks/project-ve/issues/99). Implementer:
Codex with scothinks. Uncommitted on B1 `59ea597af00e0f6a53f3018f18292d410f1be59e`,
preserving the B2 cutover. CI/E2E, production build and rendered qualification
remain deferred until #102 implementation is complete. No push or deployment.

## Implementation

- Source Sans 3 is the product/signature family. Source Serif 4 replaces Georgia
  only in the existing expressive Orgs heading; its loader is scoped to that route.
  Both retain full upstream character sets, variable weights 200–900 and genuine
  italics. Serif retains its optical-size axis. Synthetic faces are disabled;
  seven previous CSS weight-950 declarations now request the supported 900.
- Root and learner rules consume `--ui-font-body` directly; the expressive heading
  consumes `--ui-font-display`. Both are terminal `next/font/local` outputs. The
  two legacy font names are absent, and G3 source enforcement is active.
- `BrandSignature` implements the frozen Open recipe: lowercase letters at 600,
  native U+002F slash at 500 with .035em side space, .22em word gap, -.018em
  tracking, 16px-at-default-root text, 24px default mark and 7px mark gap.
  Horizontal is used in headers; compact keeps equal-sized words on two lines
  next to one mark. Collapsed slots support a mark-only variant. No slash drawing,
  rotation, new palette or Aperture geometry changes.
- The single canonical A.2 vector supplies the CSS mask with inherited semantic
  ink. The frozen export is retained for path comparison. Mask ink preserves the
  surrounding forced-colour foreground. Signature CSS resets inherited uppercase
  and tracking; the old broad circular-span selector now targets only explicit
  logo/fallback slots.
- Each signature exposes one canonical accessible name, `Project VE`; internal
  fragments are decorative. `PlatformEndorsement` exposes `Learning on Project VE`.
  Its tenant placement/hierarchy remains B4. No new route, effect, identity lookup,
  data loader, authorization, CMS workflow or entry-readiness logic is introduced.

## Placement inventory

| Surface | Adoption |
| --- | --- |
| Learner top chrome | Horizontal shared signature |
| Public information and advertising footers | Horizontal shared signature |
| Personal workspace row | Shared signature; tenant rows unchanged |
| Organisation desktop platform link | Shared signature; tenant hierarchy remains B4 |
| Admin platform/organisation navigation | Horizontal or mark-only within existing slots |
| Admin collapsed platform context | Named mark-only signature; tenant initials retained |
| Login desktop identity slot | Shared signature with 32px mark |
| Welcome mobile/desktop header | Horizontal signature beside existing Skip action |
| Invite header | Horizontal shared signature |
| Neutral tenant attribution | Component defined; integration belongs to B4 |

Ordinary product sentences, workspace selection labels, copyright, persisted
identifiers and metadata remain text. Existing browser/install `VE` artwork remains
B5-owned. Remaining `Project Ve` prose is not a separate visual signature and was
not globally rewritten. No compact signature is squeezed into a standard header.

## Font budget, provenance and coverage

Before integration, the budget was fixed at **1.1 MiB (1,153,433 bytes)** of WOFF2
assets, **180 KiB** for normal body and **320 KiB** for Sans normal plus italic.
[The measured manifest](b3-font-payload.json) pins file sizes, SHA-256 checksums,
source versions, provenance, full-glyph compression and fallback coverage.

| Family/face | WOFF2 bytes |
| --- | ---: |
| Source Sans 3 normal | 169,624 |
| Source Sans 3 italic | 138,272 |
| Source Serif 4 normal | 427,784 |
| Source Serif 4 italic | 346,612 |
| Four restricted coverage faces together | 12,976 |
| **Total** | **1,095,268** |

Regular faces are extracted from the approved study with matching original
checksums. Official Google Fonts italics match the regular family versions
(Sans 3.052, Serif 4.004). Source faces use full-glyph WOFF2 compression, preserving
all 1,615 Sans and 918 Serif codepoints. Licences accompany the assets.

Compared with the previous Geist's 728 codepoints, Source Sans omits 46. The
renamed `Project VE Coverage` fallback preserves those characters at the original
four weights, using CSS unicode ranges so ordinary text cannot trigger it. It is
subset from the existing Geist faces, has its own OFL, and uses 12,976 bytes within
the already fixed budget. Original Geist assets remain intact for older builds.

No face is preloaded. Expected font delivery is one normal Sans request for a
plain screen, an extra italic request when used, and Serif only on its scoped
route when painted. The current Orgs emphasis is italic, so expected font bytes
there are 516,236 before rare-character fallback. These are source predictions;
actual built files, preload links, cached/cold route requests and transfer bytes
must be recorded at the integrated qualification point. The root imports no Serif
loader. Native control labels and existing tabular-number utilities are preserved.

## Focused validation and outstanding qualification

Passed: typecheck, lint, `git diff --check`, G3 source contract (569 production
files/assets, 6,883 occurrences), all 126 source contrast pairs, and 24 targeted
unit/evidence checks. Six new brand tests cover accessible markup, both layouts,
16/20/24/32px mark sizes, frozen path comparison, Open typography, payload/checksums,
coverage restrictions and genuine italic/no-global-Serif loading. They join the
existing unit glob, so no independent CI workflow is added.

Commands: `npm run typecheck`; `npm run lint`; `git diff --check`;
`node scripts/check-theme-contract.mjs`; and Node 22.17.1 with
`NODE_OPTIONS=--preserve-symlinks --experimental-strip-types --test` for
`tests/unit/brand-signature.test.mjs`, `theme-contract.test.mjs`, and
`evidence-checksums.test.mjs`.

No CI, E2E, browser capture or production build ran. These source/render-to-string
checks do not prove fitting or browser typography. After #102, qualify mobile,
compact and collapsed variants, 200% text zoom, long tenant names, buttons,
dense admin tables/numbers, editor italics, fallback glyphs, forced colours,
light/dark and favicon-scale geometry. Check actual font requests and built bytes,
generated CSS, workflow parity and the complete visual matrix before closing G3.

## Preservation and rollback

`b3-checkpoint.json` records the complete uncommitted patch and new-file archive
against B1. The B2 checkpoint is preserved separately. Roll back B3 to the entire
B2 filesystem artifact, including its fonts, markup, selectors and source policy;
do not restore only the old font underneath the new signature. No schema/data
rollback is involved. This source implementation does not claim hosted rollout.
