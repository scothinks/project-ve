# Organisation media and permitted Platform Catalog library

Status: accepted product contract; implemented and locally validated. The user reports migrations through `20260905180000` pushed. The linked-database media privacy cutover is complete against the local Project VE app on port 3001; [the cutover report](media-cutover-evidence-2026-09-05.md) records file, access and exact-revision evidence. Hosted deployment and the remaining migration/cache evidence limits are explicit in that report.

## Product agreement

Organisation-owned media is private to its owning organisation and reusable
across that organisation's courses. Organisations may also browse and reuse
Platform Catalog media explicitly permitted for them. There is no org-to-org
library sharing. Platform ownership and organisation ownership remain distinct.

This is a bounded extension of existing product capabilities. Delivery requires
a cross-cutting media ownership and access migration, including existing
published content. It touches storage, publication snapshots, duplication,
deletion and every media consumer; it is not simply a picker improvement.
It does not reopen P1.5 or authorise P2.

## Pre-change implementation findings

These findings describe the baseline before the media implementation. The
implementation and rollout record below describes the local changes.

- Course and lesson loaders populated the picker with course-filtered
  `learning_media_assets`; the new-course screen supplied an empty library.
- `MediaPickerProvider` opened an `AdminDrawer`; that interaction is preserved.
- Media records required a course or lesson parent, with cascading deletion.
  They combined generation work, editorial placement and stored-file identity.
- Uploads and AI generation wrote public storage URLs. Course duplication and
  asset reuse could copy a URL/storage path into another row, requiring a
  shared-reference audit for deletion.
- Picker results contained URLs rather than durable media identifiers. Published
  snapshots and other content fields therefore needed migration too.
- RLS permitted resource editors and platform oversight, but did not implement
  a stock-media permission model for organisation editors.

These findings are from repository code and migrations. Deployed schema,
storage configuration and data still require inspection before rollout.

## Accepted product rules

| Concern | Accepted behaviour |
| --- | --- |
| Organisation library | Current organisation's assets; existing content-editor roles control browsing and reuse. Course/lesson are optional filters, not ownership boundaries. |
| Platform library | Only platform assets approved for reuse and permitted for the current organisation. Viewing a catalog course does not grant stock-library access. |
| Platform permission | Default off. Platform Catalog owners/admins can permit all organisations or selected organisations. Reuse existing workspace roles; do not add a parallel role system. |
| Asset approval | Editorial approval and permission to offer an asset for reuse are separate. Admit only rights profiles the release can enforce, as defined below. |
| Using stock | Authorisation attaches to a successfully saved placement and exact asset version; picker selection reserves nothing. Do not transfer ownership or copy storage bytes for ordinary reuse. |
| Local presentation | Caption, alt text, crop and focal point can vary per placement without changing the shared original. |
| Derived files | A permitted edited/generated derivative is a new org-owned asset with source provenance; derivation must respect the original's reuse rights. |
| Replacement | New original bytes create a new immutable version for both org and platform assets. Existing placements stay pinned until explicitly updated. |
| Withdrawal | Ordinary withdrawal prevents new uses; saved placements can still publish. Emergency revocation blocks the affected media and flags containing content for review. |
| Organisation permission removal | Removing a selected organisation or changing all organisations to selected organisations prevents new placements in each excluded organisation. Previously authorised placements follow ordinary withdrawal rules; stopping their delivery requires explicit revocation. |
| Deletion | Removing a placement does not delete a library asset. Block physical deletion while drafts, published snapshots or other supported content still reference it. |
| Quotas | Referencing platform stock does not count as new org storage or AI generation. New org uploads/derivatives retain existing storage, content and AI limits. |

The decisions below are the accepted product contract.

## Accepted implementation decisions

### 1. Authorisation begins at a saved placement

A successful server-side save atomically records the placement,
owning workspace, containing content, exact asset version and permitted use.
The server validates current permission in that transaction. A failed save or
picker selection creates no authorisation. Concurrent withdrawal and save must
have a deterministic transactional ordering, not a check-then-write race.

| Event after ordinary withdrawal or organisation permission removal | Accepted outcome |
| --- | --- |
| Asset selected but never saved | Save is rejected; select a permitted replacement. |
| Saved draft, never published | That saved placement can still be edited and published. |
| Caption, alt text or crop adjustment | Same placement/version; existing authorisation continues. |
| Duplicate course, lesson, page or block | New placements require current permission, even within the same org. Reject the duplication atomically with affected media identified if permission is absent. |
| Add another placement of an asset already used in the org | New use; requires current permission. |
| Change the asset version | New use; requires current permission for that version. |
| Revert to the same lesson's current published snapshot | Restore its server-recorded placement identities, versions and authorisations; ordinary withdrawal does not prevent this. |
| Reinsert a deleted draft-only placement or copy from historical content | New use; an old ID or authorisation cannot be replayed to bypass current permission. |

An authorisation belongs to a placement, not an org-wide unlimited reuse grant.
Removing an organisation's stock permission prevents new placements in that
organisation. Previously authorised placements continue under ordinary withdrawal
rules, including publication and trusted revert. This applies both to removing
an organisation from the selected audience and to switching from all organisations
to selected organisations. Blocking their continued delivery requires explicit
revocation; editing the permitted audience does not revoke saved authorisations.

The published snapshot retains its authorised placement even when its draft
counterpart is deleted. Revert means the existing revert-to-current-publication
operation; this release adds no arbitrary historical restore feature. Moving
content to another containing lesson/course or workspace creates a new use;
reordering it within the same container does not.

Publication verifies valid saved authorisations, current content audience rules
and emergency-revocation state; it does not require a withdrawn stock asset to
be newly selectable. Audience expansion is checked separately and cannot make
org-private media public. Revoked references may remain as unavailable entries
when reverting, but revert never restores their delivery permission.

### 2. Shared originals are versioned, never silently replaced

Changing original bytes creates a new immutable asset version,
including for organisation-owned assets. Existing draft and published placements
remain pinned to their authorised version. Updating them is an explicit editor
action; publishing follows the normal lesson lifecycle. No automatic bulk swap.

Typo corrections to a library title, description or search tags may update in
place. They do not overwrite placement-specific captions or alt text. Changes to
rights, attribution obligations, permitted uses or rights-holder identity are
not descriptive corrections: record a new rights revision and require fresh
approval for future use, even if the bytes are unchanged. Preserve the rights
record underlying existing authorisations. If that record was invalid, use
explicit revocation rather than silently rewriting past permissions.

### 3. Emergency revocation blocks media, not the entire lesson

Stop new preview/delivery authorisations for the revoked version
across libraries, drafts and published content. Show an accessible unavailable
state in its place and mark affected content as requiring editorial review.
The remaining lesson stays readable; publication is blocked while a draft still
contains revoked media. This action does not silently reset learner progress.

Use existing in-app notification mechanisms to alert affected workspace
owners/admins, with links to affected content and replacement actions. Register
review flags durably even if notification delivery fails. Cover known derived
assets in the impact report; any revocation of those versions is explicit.
Revocation can target a version or all versions of an asset. Already issued
signed links may work until expiry; downloaded copies cannot be recalled.

### 4. Separate asset management from course editing

Accepted role mapping, applied within the owning workspace:

| Action | Org library | Platform Catalog library |
| --- | --- | --- |
| Browse/reuse and upload a new asset | Owner, admin, programme manager, content editor | Same existing Catalog workspace roles |
| Change placement caption/crop/alt text | Editor authorised for the containing content and permitted asset | Same resource-scoped rule |
| Edit shared descriptive metadata or add a replacement version | Org owner/admin | Catalog owner/admin |
| Change recorded rights or approve stock sharing | Org owner/admin for rights; org-to-org sharing unavailable | Catalog owner/admin |
| Withdraw, emergency-revoke or physically delete an unused asset | Org owner/admin | Catalog owner/admin |

Platform Admin retains existing audited oversight. Other roles gain no new
asset-management capability. A course-specific edit permission alone does not
grant organisation-wide library management. Uploaders provide source/rights
information and attest to the supported rights profile, validated on creation;
qualifying org uploads become available to org editors without a new manual
approval workflow. Changing that rights record later requires owner/admin
authority. Platform sharing always needs separate Catalog owner/admin approval.
An org editor's upload before course creation belongs to the selected workspace
and remains in its library if course creation is cancelled.

### 5. Admit only rights the first release supports

The supported stock profile requires permission for in-project reuse, display,
cropping and derivation, including continued use of saved placements after
ordinary withdrawal, with no mandatory attribution or additional downstream
conditions. Org-owned uploads must support their intended in-project uses too.
Store provenance and evidence of those permissions; a free-text notes field is
not an enforceable licence policy.

Assets requiring attribution, prohibiting derivation, imposing use expiry or
carrying other unsupported restrictions are ineligible for stock approval in
this release. Do not expose them with merely a warning label. Support for such
profiles requires a separate reviewed extension covering rendering locations,
every consumer and server-enforced restrictions. Existing restricted assets are
reported during inventory and need an explicit migration disposition; this
contract does not grant rights to them or authorise their deletion.

Decision dependency: saved-placement authorisation and revert govern versioning, withdrawal, duplication and publication.

## Accepted implementation and release sequence

This sequence records the agreed design and rollout order. Local implementation
is recorded below; hosted release steps remain pending.

### 1. Establish durable ownership and usage

Introduce a focused canonical media registry with explicit platform/org ownership,
private storage identity, media type, provenance, rights and lifecycle state.
An org-owned record must have an organisation ID; platform-owned records must
not acquire org ownership merely because an org uses them.

Keep existing `learning_media_assets` as generation/editorial placement records
and connect them to the registry, avoiding a rewrite of the AI workflow.
Represent course, lesson, page and block uses with durable asset references;
preserve per-placement presentation fields. Inventory all other consumers before
finalising the reference schema, including rich text, covers, previews and
published lesson snapshots.

Backfill ownership from trusted parent-course scope. Reconcile duplicated rows
that share a storage object; do not infer ownership from a copied row or URL
alone. Produce a report for ambiguous ownership, missing objects and external
URLs rather than silently publishing or discarding them.

### 2. Enforce library and reuse permissions

Add focused RLS/RPC boundaries for library listing, stock permission management,
asset selection and usage registration. Validate both the asset and destination
workspace on the server; never trust a client-supplied org ID or storage path.

Persist placement/version authorisations atomically with content saves. Check
current stock permission for new placements, duplication and version changes;
verify existing saved authorisations for unchanged placements and publication.
Enforce revocation in either case. Restore trusted authorisations only through
the defined revert operation, never through client-supplied identifiers.

Scope every listing to the selected workspace, including for platform admins
and users with access to multiple organisations. Return only picker metadata;
do not expose platform generation prompts, scripts or unrelated draft content.
Preserve explicit platform-admin oversight without aggregating private org
assets into the Platform Catalog library.

### 3. Deliver private media through authorised content

Move application-owned media to private storage and replace persisted public URLs
with stable references. Resolve temporary delivery URLs at read time after
checking one of the applicable permissions: library preview, editor preview or
access to the containing published content. Batch resolution and keep private
results out of shared caches.

Learner checks must follow the existing public, org and programme content-access
rules. An asset ID alone is insufficient. Media intentionally used in a public
catalog lesson remains viewable in that public context; draft/unpublished media
does not become public. Org-private media must not be attached to public content
through a forged reference or an audience change.

Never persist expiring signed URLs inside drafts or publication snapshots. Cover
image transformations, image caches, audio/video range requests, signed URL
expiry/refresh and long-lived reader pages are part of delivery validation.
Signed links remain usable until expiry; use a short bounded lifetime and make
that limitation explicit for emergency revocation.

Externally hosted links cannot acquire org privacy through our library. Inventory
them and propose authorised import/replacement for private uploads; do not
silently download external files or claim to control their access.

### 4. Update the picker and platform controls

Keep the existing drawer, with two sources inside the library:
**Organisation media** and **Platform media**. Include media-type filtering,
search, pagination, source labels and optional course/lesson filters.
Load a small projection through an explicit picker request; do not preload the
full organisation library on every editor page or issue per-asset queries.

Allow library access and org-owned uploads before a course is saved, using
validated workspace context and existing quota enforcement. Cancelling course
creation leaves an uploaded library asset available for later reuse.

Return asset identity plus presentation metadata from selection and integrate
the same boundary into covers, lesson blocks and existing AI/media workflows.
Do not add new AI-generation capabilities as part of this change.

Add owner/admin controls for shared metadata, version creation, rights approval,
withdrawal, revocation and deletion; Catalog controls also choose the permitted
org audience. Enforce the supported rights profile at approval. Display usage
impact before revocation/deletion. Use established CMS components and permission
patterns.

### 5. Migrate and release safely

1. Inspect hosted state and produce a read-only inventory of objects, references,
   ownership conflicts, published usage and external links.
2. Add registry, reference and permission structures; backfill and verify them.
   Existing platform assets default to unavailable for stock browsing.
3. Deploy compatible writers and readers, including upload, AI generation,
   duplication, draft save/publish/revert and asset deletion.
4. Verify draft and published content resolves through the authorised path,
   then close public storage access in a coordinated cutover. Remove legacy
   public copies and address CDN/image cache retention as applicable.
5. Run hosted permission and playback checks before declaring privacy complete.

Do not flip the bucket to private while published content still depends on its
public URLs. Prefer rollback to the compatible application version with private
delivery intact; do not use reopening public access as the normal rollback.
Previously downloaded files cannot be recalled by changing storage permissions.

## Verification and definition of done

- Database tests: org A cannot list, use, sign or mutate org B assets; platform
  stock defaults to unavailable; all-org and selected-org grants work; forged
  destination/asset IDs fail; withdrawal, revocation and referenced deletion obey
  their separate rules. Include multi-org users and platform oversight.
- Cover every saved-placement decision above, including concurrent save versus
  withdrawal, failed saves, draft-only uses, duplication, ID replay and revert.
  Check version pinning, management-role denials and unsupported-rights rejection.
- Repository tests: bounded paginated reads, safe projections, batched media
  delivery, stable references, ownership backfill, shared-object deletion and
  storage/AI entitlement behaviour.
- Browser tests: reuse across two courses in one org; new-course upload; permitted
  platform selection; denied stock hidden/rejected; org switching; editor state
  retained when closing the drawer; learner media after publish/revert; public
  catalog media and restricted org/programme media.
- Verify revoked media shows an accessible unavailable state, flags containing
  content, blocks affected draft publication and queues deduplicated in-app
  notifications without blocking the rest of an existing published lesson.
- Direct delivery checks: guessed URLs, legacy public paths, cached derivatives,
  expired links, unpublished content and unauthorised users cannot expose private
  media. Valid image/audio/video playback survives the cutover.
- Preserve the updated drawer navigation test and its documentation.
- Run relevant pgTAP/repository/browser suites, guardrails, database type parity,
  typecheck, lint and build; wire durable checks into existing CI gates.
- Update engineering, product, P1.5 and RPC security documentation with actual
  validation results and any hosted rollout gaps.

Done means org libraries are private and reusable across courses, permitted
platform assets are reusable without any org-to-org sharing, existing published
media still works, and both metadata access and file delivery enforce the model.

## Implementation and rollout record, 2026-09-05

The implementation uses eight focused forward migrations, `20260905100000`
through `20260905170000`. Registry, immutable versions, permissions, placements,
review flags and notification outbox records live in the private schema. API
roles have no direct access to those tables. Public RPCs are explicitly classified
in the existing RPC-security inventory.

Stable `/api/media/<version-id>` references work in existing image/media fields,
including published snapshots and rich-text media. Selection alone grants
nothing. Database triggers atomically authorise saved placements across legacy
and current authoring paths; trusted revert uses a private transaction marker.
Generation rows retain their editorial purpose and no longer own registered
storage paths. Removing a generation row does not remove a shared file.

Both picker implementations use the paginated workspace library. The main drawer
remains in place. The new-course flow supports org-owned image uploads; direct
uploads continue to support the existing PNG/JPEG/WebP formats. Existing audio
and video references use the same delivery and permission boundaries; this work
does not add new audio/video generation or upload capabilities.

`/admin/media` provides owner/admin controls for descriptive metadata, permission
audiences, new image versions, withdrawal, per-version or all-existing-version
revocation, and unused-version deletion. Organisation audience selection uses
names. Impact summaries report affected organisations and placement/course
counts; private cross-org course titles are not exposed to Catalog managers.
Affected workspace managers receive deduplicated in-app notifications through
existing notification primitives. Review flags persist if notification dispatch
fails, and the outbox can be retried through its authorised RPC.

The delivery endpoint checks the caller's permissions before server-side signing
and streams the storage response with `private, no-store`. It supports range
requests and does not expose the signed capability URL to the browser. Managed
images bypass Next's shared image optimiser; image/audio/video controls provide
unavailable states. Already downloaded bytes and pre-existing CDN copies remain
outside the reach of a database revocation.

### Release procedure

This is a coordinated release. Pause CMS/media writes and AI media workers while
applying/backfilling the migrations and switching writers; old writers must not
create new public URLs during the transition. Preserve a database/storage backup
and the compatible app build. Do not reset the database.

1. Review hosted schema and storage state before scheduling the release. Apply
   the forward migrations with the matching app build; inventory and repair any
   failed/ambiguous backfill before opening writes again.
2. Run the read-only inventory against the target environment:
   `node scripts/media-storage-release.mjs --inventory`. Supply the target URL
   and service-role key through the environment, never command-line literals.
   For the local stack use `--local --inventory`.
3. Review `private.media_migration_issues`. Cross-owner objects are quarantined
   rather than assigned to an arbitrary org. External/untracked URLs require an
   explicit disposition. Imported rights remain unverified and unavailable as
   platform stock until a reviewed new version is created. Missing files and CDN
   cache behaviour require hosted storage checks; SQL metadata alone cannot
   establish that the bytes exist or cached public copies have expired.
   Historical generator `metadata.previousUrl` fields can also retain obsolete
   public URLs. Inspect `scripts/media-repair-legacy-provenance.mjs --out <file>`
   with the target environment, then use `--apply` for the scoped provenance
   repair when applicable. It preserves bucket/path identity without granting a
   new placement or guessing a version; the closure guard remains unchanged.
4. Verify covers, lesson media, rich text, AI media, drafts, publication/revert
   and duplication through the new application. The same physical path in two
   different buckets is treated as two different objects.
5. Run `node scripts/media-storage-release.mjs --close-legacy-buckets` only after
   compatibility checks. The service-only operation refuses unresolved inventory
   issues and scans public tables for remaining managed public-object URLs before
   closing the relevant buckets. This is an explicit release operation, not an
   automatic side effect of schema deployment.
6. Verify direct legacy public URLs are denied and authorised private delivery
   still works on the hosted target. Handle CDN/image cache invalidation and
   residual public copies as part of that release. Resume writes/workers only
   with the private writers in place.

The release command is intentionally manual and is not a CI deployment step.
Normal CI includes the new database, unit/guardrail, repository-concurrency and
browser tests through the existing suite entry points. The initial implementation
performed no hosted changes. The subsequent authorised cutover and provenance
repair are recorded in [the cutover report](media-cutover-evidence-2026-09-05.md).

### Recorded local validation

- Full database suite: 41 files, 994 assertions passed (48 media assertions).
- Unit suite: 166 tests passed; guardrail suite: 20 tests passed.
- Demo/live repository and lesson-publication contracts passed. The new media
  contract passed three concurrent save-versus-withdrawal rounds and verified
  that later copies remain denied.
- Production build and three Playwright checks passed: real-file org privacy and
  permitted platform access; drawer/editor state retention; publication/revert
  and stale-tab rejection.
- Typecheck, lint and local database-type parity passed. Generated browser output
  is excluded from lint to avoid racing Playwright's output cleanup.
- Scoped whitespace checks passed. The unrelated pre-existing trailing blank
  line in `features/learning/admin/planner-commands.ts:450` remains unchanged.

The migrations were applied and recorded in the local migration ledger. No clean
reset/replay of the entire historical migration chain was performed in this turn;
existing local data was preserved. Hosted inventory, storage existence/CDN checks
and coordinated deployment remain outstanding release validation.

### Critical behaviour evidence and release checks

The [release evidence report](media-release-evidence-2026-09-05.md) supersedes the
initial coverage-gap table. It maps the accepted rules to database, handler,
concurrency and real-file browser cases, records fixes found during validation,
and links revision manifests and actual command results. The historical suite
counts above remain the original implementation run.

Organisation audience removal and all→selected changes follow ordinary withdrawal.
New references still need current permission; saved references may continue,
publish and revert until explicitly revoked. Version replacement, rights,
management denials, quota races, private ownership, atomic duplication, surviving
references, revocation, notification retry and byte-range cases now have focused
regression coverage. See the report for passing results versus remaining checks.

The user reports the prior migrations deployed. The linked read-only inventory
shows 16 unverified versions and a still-public `learning-media` bucket. A clean
issue table does not establish object existence, migrated-reference correctness
or CDN privacy. The staging designation, deployed app identity, hosted migration
ledger and a forward-migration rehearsal against a pre-change copy of the target
remain required evidence. Do not infer those results from local tests or reset
local data to manufacture a clean migration history.
