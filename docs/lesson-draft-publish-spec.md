# Lesson content: draft vs. published, and revert-to-published

Status: **database prerequisites and reader/editor cutover implemented together;
locally validated, 2026-09-05. Hosted cutover pending.** The user reported deploying
`20260904100000_lesson_draft_publish.sql`. The two subsequent migrations below
have been applied locally only. Claude completed the initial editor integration;
Codex completed the follow-up database and application work at the user's request.

## Codex implementation and integration notes

The migrations are authoritative. SQL sketches under “Original proposal” below
are historical design material, not deployable copies of the final functions.

- `20260904100000_lesson_draft_publish.sql` captures one published snapshot,
  backfills existing publications, and provides course-scoped publish, revert and
  page-delete RPCs. Publication retains the AI approval guard. Revert restores
  metadata/pages/blocks with stable IDs and safe positive temporary ordering;
  quiz content, tags and publication time retain their separate lifecycle.
- `20260904110000_lesson_published_read_boundary.sql` introduces durable page
  identities, published learner views and the coordinated RLS/completion/quiz/
  mission reader changes. It fills only missing legacy published snapshots.
- `20260904120000_atomic_lesson_builder.sql` introduces atomic builder saves and
  checked publish/revert RPCs. All content and metadata writes advance the
  server-owned draft revision; stale editor requests fail with HTTP 409.

## Follow-up: reader cutover and remaining release dependencies

Implementation status: **complete locally**. These are the decisions resolving
the four blockers identified in the handoff.

### Published completion and policy reads

Completion RPCs depend on page identity, membership and counts, not block text.
They now resolve those values from the published page set. Quiz-start RPCs also
need published lesson settings: retries, cooldown, reread, completion eligibility
and earning-attempt limits now come from snapshot metadata. Quiz questions and
answer keys retain their existing separate lifecycle and grading boundaries.

The learner detail/catalog readers decode snapshot pages and blocks. Course cards
read published lesson metadata and small page-reference projections without
loading snapshot bodies. Missions use published page IDs, and dashboard mission
counts exclude historical completions for pages absent from the current version.
A historical lesson completion timestamp alone cannot satisfy a changed page set,
including course-completion rollups and time-bounded mission awards.
Admin course and lesson previews continue to read drafts.

### Durable identities preserve completion history

Both ordinary and programme page-completion FKs now reference
`private.lesson_page_identities(lesson_id, id)`. Deleting a draft page removes its
editable content while retaining its identity and existing completions. Learners
can still complete that page while it belongs to the current publication; revert
can restore it. Page IDs cannot be reassigned to a different lesson. Historical
completions remain stored after later publications but only current published
pages count toward completion. Deleting the entire lesson retains the existing
cascade lifecycle. This cannot recover completions lost before this migration.

### Database draft-read boundary

Raw lessons, pages and blocks are readable only by authorized editors. Public
`learner_lessons` and `learner_lesson_page_references` views expose published
content under the existing course/tenant access boundary. Quiz projection access
uses the same publication predicate; private quiz answer fields remain excluded.
Anonymous reads cannot accidentally invoke editor-only permission helpers.

A published row without a snapshot is **excluded**, with no live-draft fallback.
The migration backfills legacy rows before this boundary takes effect. Later
legacy status-only writes therefore cannot expose draft content. This deliberately
replaces the proposed fallback: rendering mutable drafts would defeat isolation.

### Atomic saves and overlapping editors

The builder route makes one transactional RPC for its full page/block draft.
Page and block deletion is local until that save succeeds. Save, publish and
revert lock the same lesson row and check its expected revision; one stale tab
cannot overwrite another tab's saved content. The editor must reload after a
conflict. Metadata and legacy AI content writes also advance that revision.
Existing trusted automation can still call the original publish/revert RPCs;
they serialize with saves, while interactive editor routes use checked variants.

Publish flushes saving first, and publish/revert temporarily disable editing.
Saved IDs, ordering and sanitized fields are reconciled into the local editor,
while edits made during the request remain unsaved. Publication drift includes
all snapshot metadata, and a successful publish adopts the returned snapshot.
The surviving legacy `saveLesson` publication action also captures a snapshot.
Settings and cover forms stay separate; their saves update draft metadata.

### Definition of done and validation

The reader swap, draft preview, null-snapshot handling, completion/FK boundary,
RLS isolation, atomic save and editor conflict behavior are implemented. Coverage
is included in existing CI commands: database tests, repository contracts,
guardrails and Playwright. No additional CI command is needed.

Local validation (2026-09-05):

- Database: 40 files / 946 assertions, including 47 published-boundary and
  66 snapshot/revert assertions.
- Unit: 163 passed; guardrails: 17 passed.
- Repository contracts: demo, live and concurrent publication/isolation passed.
- Quiz XP concurrency and economic integrity regression passed.
- Focused browser workflow: save, published isolation, publish, revert,
  metadata-only drift and stale-tab HTTP 409 passed, including production build.
- Generated database-type parity, typecheck and lint passed. Full workspace
  whitespace checking still flags the pre-existing blank EOF line in
  `features/learning/admin/planner-commands.ts`; it is outside this change.

### Remaining release step

Deploy both new migrations and the matching application as a coordinated release:
the old learner code requires raw draft-table access that the new policies remove.
The new app also requires the published views and revision-aware RPCs. Do not
run either half alone as the completed feature. Hosted rollout and hosted smoke
checks have not been performed here. The migration rejects pre-existing
cross-lesson page-ID conflicts instead of silently corrupting ownership. No
local database reset or P2 work was performed.

## Original proposal

## Problem

Today there is no draft/published split for lesson content. `admin_upsert_lesson_page`
and `admin_upsert_lesson_block` (`supabase/migrations/20260514143000_admin_learning_content.sql:233-361`)
write directly into the same `lesson_pages`/`lesson_content_blocks` rows that the
learner-facing read path (`lib/supabase-learning.ts`) reads. `lessons.status` only
gates whether a lesson is visible at all — it does not separate "what's being edited"
from "what's live." So:

- Autosave on a currently-published lesson is immediately live for learners.
- There is nothing to "revert to" — the draft and the published version are the same row.
- There is no version history beyond a client-side `sessionStorage` crash-recovery
  snapshot in `components/admin/LessonPageBuilder.tsx`, which is wiped on save.

## Scope (v1)

**In scope**: everything editable inside the Lesson Editor screen — lesson pages,
content blocks, lesson-level metadata (title, description, cover image, estimated
minutes, retry policy, `quiz_requires_lesson_completion`, `max_earning_attempts`).

**Out of scope for v1** (call out explicitly, don't infer authorization to extend):
quiz content (`AssessmentBuilder.tsx`, its own screen/save flow) and content-value
tags. Both can follow the same pattern later if wanted, but folding them in now
roughly doubles this spec's surface area for a use case the user didn't ask for.

**Versioning depth**: single revert point — "the last published state," not a full
history list. `lesson_pages`/`lesson_content_blocks` continue to be edited freely as
the draft; one JSONB snapshot on `lessons` captures what's live. No new versions
table, no diff/history UI.

## Data model changes

```sql
alter table public.lessons
  add column if not exists published_snapshot jsonb,
  add column if not exists published_at timestamptz;
```

`published_snapshot` is `null` until the lesson is first published. Shape (snake_case
keys, matching existing row shapes in `lib/supabase-learning.ts` 1:1 so the read-path
change is a near-transliteration):

```json
{
  "lesson": {
    "title": "...",
    "description": "...",
    "cover_image": {},
    "estimated_minutes": 8,
    "retry_mode": "anytime",
    "retry_cooldown_seconds": null,
    "retry_requires_reread": true,
    "quiz_requires_lesson_completion": true,
    "max_earning_attempts": null
  },
  "pages": [
    { "id": "page-...", "page_number": 1, "title": "...", "subtitle": null, "page_type": "concept", "cover_image": {} }
  ],
  "blocks": [
    { "id": "...", "page_id": "page-...", "block_type": "text", "sort_order": 1, "payload": {} }
  ]
}
```

No `has_unpublished_changes` boolean column — deriving drift from a maintained flag
would mean touching `admin_upsert_lesson`, `admin_upsert_lesson_page`, and
`admin_upsert_lesson_block` (already-shipped, working RPCs) to keep it in sync. Instead
the app computes drift by comparing current draft state to the deserialized snapshot,
the same way `createBuilderSnapshotKey` already compares draft state to the last-saved
state (`features/learning/admin/lesson-page-builder-domain.ts`). Smaller migration,
zero changes to existing upsert RPCs.

## New RPCs

### `admin_publish_lesson`

Captures the current draft (`lessons` fields + `lesson_pages` + `lesson_content_blocks`)
into `published_snapshot`, flips status to `published`. App-side readiness checks
(`assertLessonPublishAllowed` in `app/admin/courses/actions.ts:76`, and course-readiness
checks) run **before** calling this, exactly as they gate `admin_upsert_lesson` today —
this RPC does not re-implement AI-approval/readiness logic.

```sql
create or replace function public.admin_publish_lesson(
  p_lesson_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_snapshot jsonb;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can publish a lesson.';
  end if;

  if not exists(select 1 from public.lessons where id = p_lesson_id) then
    raise exception 'Lesson not found.';
  end if;

  select jsonb_build_object(
    'lesson', jsonb_build_object(
      'title', l.title,
      'description', l.description,
      'cover_image', coalesce(l.cover_image, '{}'::jsonb),
      'estimated_minutes', l.estimated_minutes,
      'retry_mode', l.retry_mode,
      'retry_cooldown_seconds', l.retry_cooldown_seconds,
      'retry_requires_reread', l.retry_requires_reread,
      'quiz_requires_lesson_completion', l.quiz_requires_lesson_completion,
      'max_earning_attempts', l.max_earning_attempts
    ),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'page_number', p.page_number,
        'title', p.title,
        'subtitle', p.subtitle,
        'page_type', p.page_type,
        'cover_image', coalesce(p.cover_image, '{}'::jsonb)
      ) order by p.page_number)
      from public.lesson_pages p
      where p.lesson_id = p_lesson_id
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'page_id', b.page_id,
        'block_type', b.block_type,
        'sort_order', b.sort_order,
        'payload', b.payload
      ) order by b.page_id, b.sort_order)
      from public.lesson_content_blocks b
      join public.lesson_pages p on p.id = b.page_id
      where p.lesson_id = p_lesson_id
    ), '[]'::jsonb)
  )
  into v_snapshot
  from public.lessons l
  where l.id = p_lesson_id;

  update public.lessons
  set status = 'published',
      published_snapshot = v_snapshot,
      published_at = now(),
      updated_at = now()
  where id = p_lesson_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (v_actor_id, 'lesson_published', 'lesson', p_lesson_id, jsonb_build_object('pageCount', jsonb_array_length(v_snapshot->'pages')));

  return jsonb_build_object('lessonId', p_lesson_id, 'publishedAt', now());
end;
$$;

grant execute on function public.admin_publish_lesson(text) to authenticated;
```

### `admin_revert_lesson_to_published`

Restores `lessons` fields + `lesson_pages` + `lesson_content_blocks` to exactly match
`published_snapshot`. Raises if there's nothing to revert to. Uses the same two-phase
renumber trick the existing autosave route uses client-side
(`app/api/admin/learning/builder/route.ts:252-266,302-315`) to dodge the
`unique(lesson_id, page_number)` / `unique(page_id, sort_order)` constraints mid-update —
push everything to a high temp number first, then set final values from the snapshot.

```sql
create or replace function public.admin_revert_lesson_to_published(
  p_lesson_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_snapshot jsonb;
  v_lesson jsonb;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can revert lesson content.';
  end if;

  select published_snapshot into v_snapshot
  from public.lessons
  where id = p_lesson_id;

  if v_snapshot is null then
    raise exception 'This lesson has no published version to revert to.';
  end if;

  v_lesson := v_snapshot->'lesson';

  update public.lessons
  set title = v_lesson->>'title',
      description = v_lesson->>'description',
      cover_image = coalesce(v_lesson->'cover_image', '{}'::jsonb),
      estimated_minutes = (v_lesson->>'estimated_minutes')::integer,
      retry_mode = (v_lesson->>'retry_mode')::public.lesson_retry_mode,
      retry_cooldown_seconds = (v_lesson->>'retry_cooldown_seconds')::integer,
      retry_requires_reread = (v_lesson->>'retry_requires_reread')::boolean,
      quiz_requires_lesson_completion = (v_lesson->>'quiz_requires_lesson_completion')::boolean,
      max_earning_attempts = (v_lesson->>'max_earning_attempts')::integer,
      updated_at = now()
  where id = p_lesson_id;

  -- Phase 1: push every current draft page/block out of the way of unique constraints.
  update public.lesson_pages
  set page_number = page_number + 100000
  where lesson_id = p_lesson_id;

  update public.lesson_content_blocks b
  set sort_order = b.sort_order + 100000
  from public.lesson_pages p
  where b.page_id = p.id and p.lesson_id = p_lesson_id;

  -- Phase 2: drop draft-only pages (and their blocks, via on-delete-cascade) that
  -- aren't part of the published snapshot.
  delete from public.lesson_pages
  where lesson_id = p_lesson_id
    and id not in (select jsonb_array_elements(v_snapshot->'pages')->>'id');

  -- Phase 3: upsert every page from the snapshot back to its published shape.
  insert into public.lesson_pages (id, lesson_id, page_number, title, subtitle, page_type, cover_image)
  select
    page->>'id',
    p_lesson_id,
    (page->>'page_number')::integer,
    page->>'title',
    page->>'subtitle',
    (page->>'page_type')::public.lesson_page_type,
    coalesce(page->'cover_image', '{}'::jsonb)
  from jsonb_array_elements(v_snapshot->'pages') as page
  on conflict (id) do update
  set page_number = excluded.page_number,
      title = excluded.title,
      subtitle = excluded.subtitle,
      page_type = excluded.page_type,
      cover_image = excluded.cover_image,
      updated_at = now();

  -- Phase 4: drop draft-only blocks not part of the snapshot.
  delete from public.lesson_content_blocks b
  using public.lesson_pages p
  where b.page_id = p.id
    and p.lesson_id = p_lesson_id
    and b.id not in (select (jsonb_array_elements(v_snapshot->'blocks')->>'id')::uuid);

  -- Phase 5: upsert every block from the snapshot back to its published shape.
  insert into public.lesson_content_blocks (id, page_id, block_type, sort_order, payload)
  select
    (block->>'id')::uuid,
    block->>'page_id',
    (block->>'block_type')::public.lesson_content_block_type,
    (block->>'sort_order')::integer,
    coalesce(block->'payload', '{}'::jsonb)
  from jsonb_array_elements(v_snapshot->'blocks') as block
  on conflict (id) do update
  set page_id = excluded.page_id,
      block_type = excluded.block_type,
      sort_order = excluded.sort_order,
      payload = excluded.payload,
      updated_at = now();

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (v_actor_id, 'lesson_reverted_to_published', 'lesson', p_lesson_id, '{}'::jsonb);

  return jsonb_build_object('lessonId', p_lesson_id, 'status', 'reverted');
end;
$$;

grant execute on function public.admin_revert_lesson_to_published(text) to authenticated;
```

**Codex should verify** the cast expressions against the actual enum/type names for
`lesson_retry_mode`, `lesson_page_type`, and `lesson_content_block_type` (they should
match `admin_upsert_lesson`/`admin_upsert_lesson_page`/`admin_upsert_lesson_block`,
but re-check), and confirm `lesson_content_blocks.page_id references lesson_pages(id)
on delete cascade` still holds (it does as of `20260512170000_product_model.sql:225`,
so Phase 2's cascade delete is safe) before relying on it.

### `admin_delete_lesson_page` (already-outstanding gap, folding in here)

This one was already missing — the admin UI's "Delete page" action
(`app/api/admin/learning/pages/route.ts`) calls it today and fails until it exists.
Mirrors `admin_delete_lesson_block` (`supabase/migrations/20260514172000_learning_builder_delete_block.sql`)
exactly: page deletion, block cascade is automatic via the FK, then renumber the
remaining pages.

```sql
create or replace function public.admin_delete_lesson_page(
  p_lesson_id text,
  p_page_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_deleted_count integer := 0;
  v_remaining_count integer := 0;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can delete lesson pages.';
  end if;

  if not exists(select 1 from public.lessons where id = p_lesson_id) then
    raise exception 'Lesson not found.';
  end if;

  select count(*) into v_remaining_count from public.lesson_pages where lesson_id = p_lesson_id;
  if v_remaining_count <= 1 then
    raise exception 'A lesson needs at least one page.';
  end if;

  delete from public.lesson_pages
  where id = p_page_id
    and lesson_id = p_lesson_id;

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    raise exception 'Lesson page not found.';
  end if;

  with ordered as (
    select id, row_number() over (order by page_number, id) as next_number
    from public.lesson_pages
    where lesson_id = p_lesson_id
  )
  update public.lesson_pages page
  set page_number = -ordered.next_number,
      updated_at = now()
  from ordered
  where page.id = ordered.id;

  with ordered as (
    select id, row_number() over (order by page_number desc, id) as next_number
    from public.lesson_pages
    where lesson_id = p_lesson_id
  )
  update public.lesson_pages page
  set page_number = ordered.next_number,
      updated_at = now()
  from ordered
  where page.id = ordered.id;

  select count(*) into v_remaining_count from public.lesson_pages where lesson_id = p_lesson_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (v_actor_id, 'lesson_page_deleted', 'lesson_page', p_page_id, jsonb_build_object('lessonId', p_lesson_id, 'remainingPages', v_remaining_count));

  return jsonb_build_object('pageId', p_page_id, 'lessonId', p_lesson_id, 'remainingPages', v_remaining_count, 'status', 'deleted');
end;
$$;

grant execute on function public.admin_delete_lesson_page(text, text) to authenticated;
```

Note the "at least one page" guard is enforced server-side here too — the client
already disables the menu item when `pages.length <= 1`
(`features/learning/admin/lesson-page-builder-ui.tsx`), but the RPC shouldn't rely on
the client for that invariant.

## App-layer follow-up — completed 2026-09-05

- Settings and cover retain separate draft saves; metadata drift is included in
  publish/revert state. A layout redesign was not needed for publication safety.
- Publish and revert use the checked RPCs through the editor API routes.
- Learner readers use published projections; null snapshots never fall back to drafts.
- Page/block autosave and deletion share one atomic transaction and revision check.
- Admin previews continue reading editable drafts.

See the implementation and release notes at the top for current behavior and
validation. The SQL sketches above remain historical proposal material.
