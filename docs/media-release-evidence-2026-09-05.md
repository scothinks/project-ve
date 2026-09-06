# Media release regression and inventory evidence — 2026-09-05

Status at this earlier capture: listed local regression gaps closed; hosted evidence was incomplete.
The subsequent [cutover report](media-cutover-evidence-2026-09-05.md) records the
completed privacy cutover, video frame fix and updated source/build identity. The user
reports deploying the prior migrations. This report distinguishes that statement
from independently captured evidence. No hosted mutations, bucket closures or
historical database resets were performed in this follow-up.

## Revision identity

The checkout contains uncommitted implementation and other work. Its base commit
alone does not identify the tested app. The evidence bundles record that base
commit, a SHA-256 manifest of the exact application source/configuration/type
files, a separate validation-source manifest, and the local production build ID.
Generated `next-env.d.ts`, secrets, build output and documentation are excluded
from the application source digest. The manifests include file names and hashes,
not file contents or credentials.

- [Local revision and validation manifest](evidence/media-release-2026-09-05/local/source-manifest.json).
- [Local ledger and inventory](evidence/media-release-2026-09-05/local/inventory.json).
- [Linked-project inventory](evidence/media-release-2026-09-05/linked/inventory.json).

Tested local build: `BQ2MbyFaytImxw-1SzyQt`. Base commit:
`ffcbffb80dd03dfd494619f5b7e3d2366cff31e9`. Exact application source digest:
`61a9e313644f033dfd414c6a2be2cf2defb0b1b949d020651f568a69ab80024c`. Validation-source digest:
`1856e7207d1a947e5754393072cf122bb11a96da7c857575f86a37da3cea04c3`.

A local build ID or source digest is **not** evidence that the same revision is
running on the hosted app. The staging URL and deployed commit/build ID have not
been supplied or independently verified.

## Fixes found while closing coverage gaps

1. Lesson duplication previously issued separate shell/page/block/quiz requests.
   A denied media reference could leave a partial copy. The new authenticated
   `admin_duplicate_lesson` RPC performs the copy atomically, with existing
   course-editor, media and entitlement checks. The server action now calls it.
   Migration `20260905180000_atomic_lesson_duplication.sql` is new in this
   follow-up and applied locally; the user subsequently reported it pushed.
   Hosted ledger parity remains unverified, as the later cutover report explains.
2. Local storage returns an opaque 500 for an unsatisfiable byte range. On that
   error path only, private delivery checks the signed object's HEAD metadata
   and returns 416 with `Content-Range: bytes */<length>` if the range is provably
   unsatisfiable. Valid-range failures and metadata outages retain their original
   error. Normal playback does not gain an extra metadata request.
   The error body is drained instead of awaiting cancellation: cancellation of a
   fetch stream split by Next could stall the response. A split-stream handler
   test protects this case.
3. Native audio/video preload can fail before hydration attaches `onError`.
   The shared controls now replay an existing native error on mount/source
   changes. The browser case delays JavaScript deliberately, proves the native
   error occurred first, then checks the accessible unavailable states.

## Behaviour-to-evidence map

| Accepted rule | Regression evidence |
| --- | --- |
| Removed audience preserves saved uses but denies new placements | `media_release_regressions.sql`: selected removal and all→selected; hidden stock, successful existing save/publish/revert/delivery, new-placement denial, explicit revocation then denies delivery. |
| Versions and rights stay pinned | SQL: new version retains earlier evidence/references, no automatic placement swap, ownership mismatch denied, rights mutation rejected and new platform version starts without stock approval. Browser: actual old/new bytes and rights in org and Catalog; draft/publication stay pinned until explicit update. |
| Managers differ from editors; quotas remain enforced | SQL: each management action denied to content editors/programme managers; multi-org selected-workspace denial; exact registry quota and overflow. Browser: replacement and management denied to content editor. Repository: concurrent near-limit registrations allow one winner; deletion releases registered quota. |
| Private media cannot become another workspace's public media | SQL: forged Catalog destination, oversight actor's private-reference attempt, course audience/owner expansion and lesson parent move all rejected. Existing media suite covers private/draft anonymous denial and public Catalog delivery. |
| Duplication is a new use and is atomic | SQL: course/lesson copies work while permitted, reject after withdrawal without leftover shells, and preserve copied blocks/quiz answers. Cross-course org reuse succeeds on a plan permitting multiple courses. |
| Surviving references protect deletion | SQL: draft-only, published-only, second-course, generation and derivative references block deletion. Removing a generation placement preserves its version. Handler test: storage failure retains tombstone and retry completes cleanup. |
| Revocation blocks media/publication, retains lesson and review flags | SQL: all-version revocation, published-only protection, issue flags and publication denial. Browser: real media unavailable states in reader and draft preview, remaining text readable, publication blocked and affected course present in review results. |
| Notification failure/retry is recoverable | SQL: injected insert failure, persisted flag/pending outbox, retry creates exactly one affected-owner notification with review link, further dispatch creates none. Handler test: successful revocation reports pending notifications after dispatch failure. |
| Upload failure cleans only the new object | Handler test executes real upload code with failed registration and verifies removal of precisely the new unique path. Existing files are not overwritten. |
| Playback and byte ranges work | Browser: generated WAV/WebM, play and seek, real 206 response/body/Content-Range and invalid-range 416. Handler tests distinguish confirmed invalid ranges from storage outages. Hosted codecs, device/browser coverage, expiry and CDN checks remain separate. |

Test sources:
[database](../supabase/tests/database/media_release_regressions.sql),
[browser](../tests/e2e/media-release.spec.ts),
[handler failures](../tests/unit/media-route-failures.test.mjs),
[concurrency](../tests/integration/media-authorization.live.mjs).
These files run through existing database, browser, unit and repository CI entry
points. No new production test endpoint or weakened grant/policy was introduced.

## Recorded validation

| Command | Result |
| --- | --- |
| `node scripts/supabase-cli.mjs test db supabase/tests/database` | PASS: 42 files / 1,078 assertions, including 84 new release regressions. |
| `npm run test:unit` | PASS: 171 tests, including real handler failure/retry and range-error cases. |
| `npm run test:guardrails` | PASS: 20 tests. |
| `npm run test:repositories:local` | PASS: demo/live/publication contracts and media save/withdraw plus concurrent quota contracts. |
| `PROJECT_VE_E2E_KEEP_BUILD_CACHE=1 npm run test:e2e -- tests/e2e/media-release.spec.ts` | PASS: production build and all 3 browser cases, including deliberately delayed hydration. |
| `npm run db:types:local:check` | PASS: generated public types match local schema. |
| `npm run typecheck`, `npm run lint` | PASS: both checks on final source. |

[Command logs and result hashes](evidence/media-release-2026-09-05/local/validation-results.json)
are recorded with the source and build identifiers above. Local ledger checks
include all 12 September 4–5 migrations through `20260905180000`; none are missing
from the local ledger. After scoped fixture cleanup, local inventory has zero
registered media objects, missing objects, placements and pending notifications.
No user content or audit history was reset. These are local findings only.

The new database, unit and browser files are picked up by the existing suite
entry points. The existing repository runner executes the expanded media
concurrency file. Failed exploratory runs exposed fixture issues and the
implementation defects recorded above; only final passing results close a gate.

## Hosted inventory and migration limits

The configured linked project is `xmqkrsmuokmuzcyivgbi.supabase.co` (ProjectVE).
Its designation as staging has not been confirmed. Read-only API evidence found:

- 16 registered versions, all 16 with unverified rights.
- Zero recorded migration issues; this does not prove missing-object or reference
  reconciliation, which needs the database scan.
- `learning-media` remains public. No privacy cutover is claimed.

[The recorded ledger attempt](evidence/media-release-2026-09-05/linked/migration-ledger-attempt.json)
using `supabase migration list --linked` could not read the hosted ledger because a
Supabase CLI access token is not configured. The inventory RPC works through the
configured service credential, but that credential does not grant direct access
to the private registry or migration ledger. The report does not treat RPC
availability or the user's deployment statement as migration-parity evidence.

To finish staging evidence, provide/confirm the staging target and app URL/build
identity, authenticate the CLI or provision a read-only database connection via
`MEDIA_EVIDENCE_DB_URL`, and provide access to a staging copy/snapshot representing
the target's pre-migration state. Post-deployment inventory alone cannot prove
forward migration against that earlier state. The new duplication migration also
needs to be included in the staged revision before its hosted checks can pass.

The read-only capture command is:
`node --env-file=.env.local scripts/media-release-evidence.mjs --out <evidence-directory>`.
Use an environment file configured for the intended target; secrets stay outside
the artifact and command arguments. Use `--local` for the local database.
This remains a manual operational check because it requires target credentials
and an identified release environment; local regressions remain in CI.

Release gates still include forward migration on the target-state copy, object
existence/reference reconciliation, legacy public URL/cache behaviour, hosted
permissions/playback and deployment identity. Preserve local/hosted data; do not
substitute a full historical reset or reopening public storage for these checks.
