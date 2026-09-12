# B5 / #101 — operational/public and browser presentation

Subsequent integrated qualification: [B6 exact-source results](b6-qualification.md).
The dated implementation record below preserves what was known at that checkpoint.

Implemented by Codex for scothinks on 2026-09-09. Source implementation is ready
for Review; G5 rendered/build qualification remains pending the integrated #102
batch. No commit, push, CI, E2E, production build or deployment was performed.

## Source changes

- Migrated the remaining 2,125 neutral legacy references across admin, public,
  login, onboarding, welcome and shared/host presentation to terminal roles.
- Deleted `theme-compat.css` and its import. `theme-legacy.css` was already deleted
  in B2. The active registry now has zero token allowances, adapters, undefined
  defects or dynamic-use allowances. All 108 legacy names are retired. G5 rejects
  dormant compatibility files/imports as well as renamed files containing legacy
  tokens, including when checking compiled CSS.
- Admin labels/icons previously using border ink now use muted text ink. The
  support host card border uses a paired role. Third-party widget internals,
  Google/sponsor artwork and persisted artwork colour values are preserved.
- Retained the existing Radix, Tiptap and dnd-kit controls, content, disclosures,
  cost states, saves, publication lifecycle and request boundaries.

The [source evidence](b5-source-evidence.json) records 577 production files/assets,
6,820 occurrences, zero legacy references, 136 passing role contrast pairs and
25 unchanged protected context/repository/progress modules. Comparison against
the reconstructed, hash-verified B4 checkpoint proves 138 changed files contain
only the approved token/text-role, bounded copy, stylesheet-import or notification
asset-URL substitutions. Other changes are confined to browser metadata/renderers
and compatibility deletion. This comparison is source evidence, not UI evidence.

## Browser assets

The frozen A.2 path is exported on the light canvas in action ink with the approved
24-unit clear space. Actual PNGs are 32, 180, 192 and 512px. The notification badge
is a transparent 96px white A.2 silhouette. Export bytes, dimensions and hashes are
recorded in the source evidence. `node scripts/export-browser-icons.mjs` reproduces
the assets from the vector master using the existing Sharp installation.

The manifest and root metadata point to these version-named static assets.
Viewport chrome uses light `#f6f3ed` / dark `#201c23`; the static install manifest
uses the light canvas fallback. Canonical manifest name, short name, start URL and
application title remain Project VE, Project VE, `/` and Project VE respectively.

Next's metadata-image loader does not pass query parameters to `icon.tsx`.
Replacing that handler with the explicit `/icon` GET route preserves old URLs
and makes `?size=32`, `?size=192` and `?size=512` return the actual requested size.
Missing/unsupported sizes fall back to 512 rather than allowing arbitrary work.
`/apple-icon` still returns 180px. Both handlers use the same frozen A.2 renderer.
Unit tests invoke the real renderer and decode its PNG response; production HTTP
delivery and install/notification appearance still require #102 qualification.
The service worker changes only the two asset URLs, with no cache/click changes.

## Bounded copy and identifiers

| Location | Before | After |
|---|---|---|
| Login eyebrow | Project VE: Values Education | Learning, with purpose |
| Login introduction | An incentivized learning space focused on teaching and rewarding good values. | Build knowledge, put it into practice, and earn rewards as you learn. |
| Manifest description | Project VE values education and rewards app. | Project VE learning and rewards app. |

No global rename was used. Auth destinations, recovery/invitation context,
localStorage keys, database fields, stored notification content, legal/course text
and AI prompts are unchanged. The separate #91 entry journey remains unimplemented
by this batch. Original immutable fonts and prior checkpoint assets are retained.

## Validation and remaining qualification

- `node scripts/check-theme-contract.mjs`: G5 source contract passes; all 136
  light/dark contrast pairs pass.
- Node 22.17.1 with `NODE_OPTIONS=--preserve-symlinks`, `node --test` over
  `theme-contract`, `brand-signature`, `learning-presentation`, `browser-assets`
  and `evidence-checksums` unit files: 35 tests pass. Negative cases reject empty
  dormant compatibility files/imports, temporary allowances and generated legacy
  tokens. Asset checks cover exact master geometry, pixels, PNG sizes and MIME.
- `NODE_OPTIONS=--preserve-symlinks /opt/homebrew/opt/node@22/bin/node
  scripts/test-performance-guardrails.mjs`: all 40 checks pass. The first invocation
  used the shell's Node 22.14, which lacks `registerHooks`; rerunning the same
  guardrail entry point with 22.17.1 resolves that environment mismatch.
- `npm run typecheck`, `npm run lint` and `git diff --check`: pass.

No planned browser check is reported as passed. After #102 implementation, qualify
the exact integrated build and generated CSS, real icon/manifest HTTP delivery,
admin selection/portals/focus/drag/editor/media/lesson workflows, auth return paths,
AI/pending/destructive states, tenant context and the approved responsive/mode,
zoom/reduced-motion/fallback-font matrix. Release remains separately authorised.

## Checkpoint and rollback

[B5 checkpoint manifest](b5-checkpoint.json) describes the cumulative uncommitted
patch and new-file archive against B1 HEAD. For rollback use the entire
[B4 checkpoint](b4-checkpoint.json), including its compatibility stylesheet and
matching consumers, in an isolated checkout. Never restore only old tokens or
combine old JavaScript with a new stylesheet. Prior archives remain immutable.
