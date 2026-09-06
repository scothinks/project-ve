# Media privacy cutover and video frame — 2026-09-05

Status: cutover completed for the linked database and the local Project VE app.
The user confirmed a local app target. Process inspection found another project
on port 3000; Project VE is running on **http://localhost:3001**. That server was
verified without interrupting the other project. This is not a hosted app deployment.

## Cutover result

The service-only closure operation made `learning-media` private. The subsequent
inventory reports **zero public media buckets**, 16 retained versions and zero
recorded migration issues. Imported rights remain unverified for all 16 versions;
no stock permissions or rights approvals were added.

The initial closure correctly refused historical public URLs in 13
`learning_media_assets.metadata.previousUrl` fields. The explicit repair retained
each original bucket/path in `metadata.previousStorageObject`, then removed the
obsolete public link. Compare-and-swap updates protected concurrent metadata
changes. Active URLs, asset versions, placement permissions and stored files were
unchanged. The same unmodified closure guard then passed its scan of public tables.

Before and after closure, all 16 distinct migrated generation-media URLs matched
the anonymous database delivery decision. Permitted responses returned HTTP 206
with the same first 64 bytes as signed storage delivery; denied responses returned
empty HTTP 404s. All 16 listed legacy storage files still exist and respond to
signed HEAD requests. After closure, all 16 original public URLs returned a 4xx
denial from the tested location. Private application delivery remained intact.

Evidence: [before](evidence/media-cutover-2026-09-05/before.json),
[initial guard refusal](evidence/media-cutover-2026-09-05/initial-closure-refusal.json),
[provenance repair](evidence/media-cutover-2026-09-05/provenance-repair.json),
[successful closure](evidence/media-cutover-2026-09-05/closure.json),
[after](evidence/media-cutover-2026-09-05/after.json), and
[bucket inventory](evidence/media-cutover-2026-09-05/revision/inventory.json).

## Video sizing and validation

The shared video player now fills the content width with a 16:9 frame, black
background and `object-fit: contain`, preserving the complete picture. Empty
editor video blocks and learner video placeholders use the same aspect ratio.
Audio sizing is unchanged.

The production browser regression uses a real square WebM to prove the frame is
independent of the source dimensions. It verifies a 16:9 rendered rectangle and
contained image in the lesson reader, draft preview and editor, each at 1280px
and 390px viewport widths. Playback, seeking, ranges, replacement permissions and
revocation states also pass in the same three-case suite.

Exact tested production build: `eF6NvU_AOrTJkq6G7Vr6D`.
Base commit: `ffcbffb80dd03dfd494619f5b7e3d2366cff31e9`.
Application source SHA-256:
`daf35fe897e5247247b58657d42b56edd846343637b8de991b0db64ab784a54a`.
Validation source SHA-256:
`fb0e3b7f0140a8104524e3c465b286b50521ffbaf92810df0c13c1e4e1b32ae8`.
The dirty checkout is identified by the file hashes, not by the base commit alone.
The production regression uses an app on port 3100 backed by local Supabase; the cutover smoke
checks use the linked database through the development app on port 3001. The
production build ID is not presented as the running development server's ID.

- `PROJECT_VE_E2E_KEEP_BUILD_CACHE=1 npm run test:e2e -- tests/e2e/media-release.spec.ts`: production build and 3 browser cases passed.
- `npm run typecheck`, `npm run lint`: passed.
- `npm run test:guardrails`: 20 passed.
- Scoped whitespace check passed; the pre-existing planner trailing blank line was left untouched.

[Source manifest](evidence/media-cutover-2026-09-05/revision/source-manifest.json)
and [validation logs/hashes](evidence/media-cutover-2026-09-05/validation-results.json)
record this revision. The earlier broader database/unit/repository results remain
historical evidence in [the regression report](media-release-evidence-2026-09-05.md).
No database schema or permission logic changed in this follow-up.

## Remaining evidence limits

The user reports pushing the duplication migration. Hosted migration-ledger
parity remains independently unverified: CLI authentication and a database
connection are unavailable. No pre-migration target snapshot was available for
forward-replay evidence. Storage listing plus HEAD checks are not a join against
every private registry/reference row. Anonymous smoke checks do not exercise
hosted editor/org sessions. These limits do not change the observed successful
bucket closure and delivery results.

Public URL denial was checked at one location/time. Previously downloaded browser
copies and every CDN edge's cache state cannot be proven absent by that check.
No database reset, object deletion, org-to-org sharing, or public fallback was used.
