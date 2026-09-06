# Database RPC Security

Project Ve treats Supabase RPCs as hostile browser entry points unless a function is explicitly classified and granted.

The authoritative machine-readable registry is:

```sql
private.rpc_security_classifications
```

Every `public.SECURITY DEFINER` function must have one row in that table. DB tests fail when a new `SECURITY DEFINER` function exists without a classification row.

The release gate now checks every declared API role in `execute_roles` against
the actual function ACL for `anon`, `authenticated`, and `service_role`. It also
fails when a classification row no longer resolves to a current function
signature. This keeps the registry from drifting when overloads are replaced or
when Supabase role inheritance makes `service_role` callable even though only
`authenticated` was granted directly.

## Classifications

| Classification | Intended callers | Authorization rule | Roles with EXECUTE |
| --- | --- | --- | --- |
| `PUBLIC_ANON` | Anonymous and authenticated public use cases | Function must constrain input and must not expose privileged state. | `anon`, `authenticated`, `service_role` |
| `PUBLIC_ANON_READ` | Anonymous and authenticated public read helpers | Function must only expose non-privileged public or current-caller-safe data. | `anon`, `authenticated`, `service_role` |
| `PUBLIC_ANON_TELEMETRY` | Anonymous and authenticated telemetry or inquiry writes | Function must validate constrained inputs and must not trust caller identity for privileged state. | `anon`, `authenticated`, `service_role` |
| `PUBLIC_AUTHENTICATED_SELF` | Signed-in learner use cases | Function must derive user identity from `auth.uid()` and operate only on that user or public data. | `authenticated`, `service_role` |
| `PUBLIC_AUTHENTICATED_READ` | Signed-in read helpers for public or aggregate application state | Function must be read-only and must not expose privileged user data outside the current caller/session context. | `authenticated`, `service_role` |
| `PUBLIC_AUTHENTICATED_CONTEXT_WRITE` | Signed-in context write use cases | Function must validate caller-supplied context against `auth.uid()` when user identity is present and constrain writes to the intended domain record. | `authenticated`, `service_role` |
| `ADMIN_AUTHENTICATED` | Admin screens and admin server actions | Function must fail unless `auth.uid()` is present and `public.current_user_is_admin()` returns true. | `authenticated`, `service_role` |
| `SERVICE_ROLE_ONLY` | Server-side jobs using the Supabase service role | Browser roles must not be able to perform the operation. A public wrapper may be authenticated-reachable only when it fails closed before doing work. | `service_role`, or `authenticated` plus `service_role` for deny-on-entry wrappers |
| `INTERNAL_HELPER` | Trusted database implementation helpers | Helpers are called by trusted definer functions. A legacy public wrapper may be authenticated-reachable only when it denies before delegation. | `service_role`, none, or `authenticated` plus `service_role` for deny-on-entry wrappers |
| `TRIGGER_ONLY` | Database triggers | No client role should execute directly. | none |

## P0 Remediation Baseline

| Function | Classification | Intended callers | Authorization rule | Roles with EXECUTE |
| --- | --- | --- | --- | --- |
| `public.increment_profile_xp(uuid, integer)` | `INTERNAL_HELPER` | Trusted XP workflows and service maintenance; authenticated clients may only reach the deny-on-entry wrapper. | Authenticated callers are denied before delegation. Service-role/trusted callers require a matching same-transaction ledger row. | `authenticated`, `service_role` |
| `public.apply_native_reward_effect(uuid, uuid, text, jsonb)` | `INTERNAL_HELPER` | Trusted reward redemption workflows and service maintenance only. | Browser callers must not choose reward effect data. | `service_role` |
| `public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text)` | `INTERNAL_HELPER` | Trusted domain workflows and service maintenance; authenticated clients may only reach the deny-on-entry wrapper. | Authenticated callers are denied before delegation. Trusted internal callers use `private.queue_user_notification(...)`. | `authenticated`, `service_role` |
| `public.queue_push_deliveries_for_notification(uuid)` | `INTERNAL_HELPER` | Trusted notification workflows and service maintenance only. | Browser callers must not enqueue push deliveries. | `service_role` |
| `public.generate_continue_learning_reminders()` | `SERVICE_ROLE_ONLY` | Notification dispatch job; authenticated clients may only reach the deny-on-entry wrapper. | Authenticated callers are denied before reminder generation. Service-role dispatch runs with no user JWT subject. | `authenticated`, `service_role` |
| `public.refresh_reward_item_inventory_counts(text)` | `INTERNAL_HELPER` | Trusted inventory workflows and service maintenance only. | Browser callers must not mutate inventory counters. | `service_role` |
| `public.admin_reset_ai_course_tree(text, text)` | `ADMIN_AUTHENTICATED` | Admin AI course workflows. | Requires `auth.uid()` and `public.current_user_is_admin()`. | `authenticated`, `service_role` |
| `public.admin_reset_ai_course_media(text, text, text)` | `ADMIN_AUTHENTICATED` | Admin AI media workflows. | Requires `auth.uid()` and `public.current_user_is_admin()`. | `authenticated`, `service_role` |
| `public.materialize_ai_course_text_job(..., p_worker_id text)` | `SERVICE_ROLE_ONLY` | AI generation worker endpoint. | Requires the supplied worker id to match `ai_generation_jobs.locked_by` for the running job before materialization can complete. | `service_role` |
| `public.replace_ai_course_text_job(..., p_worker_id text)` | `SERVICE_ROLE_ONLY` | AI generation worker endpoint. | Requires the supplied worker id to match `ai_generation_jobs.locked_by` for the running job before revision replacement can complete. | `service_role` |
| `public.complete_ai_generation_job(uuid, text, text, text, jsonb, text)` | `SERVICE_ROLE_ONLY` | AI generation worker endpoint. | Requires the supplied worker id to match `ai_generation_jobs.locked_by` for the running job before non-materialization jobs can complete or fail. | `service_role` |
| `public.fail_ai_generation_job(uuid, text, text, text, jsonb, boolean)` | `SERVICE_ROLE_ONLY` | AI generation worker endpoint. | Requires the supplied worker id to match `ai_generation_jobs.locked_by` for the running job before it can be failed or requeued. | `service_role` |
| `public.find_existing_reward_inventory_values(text, text, jsonb)` | `ADMIN_AUTHENTICATED` | Admin inventory import workflow. | Requires `auth.uid()` and `public.current_user_is_admin()`. | `authenticated`, `service_role` |
| `public.admin_reward_assignment_counts(text[])` | `ADMIN_AUTHENTICATED` | Admin reward inventory screens. | Requires `auth.uid()` and `public.current_user_is_admin()`. | `authenticated`, `service_role` |
| `public.admin_perk_prize_assignment_counts(uuid[])` | `ADMIN_AUTHENTICATED` | Admin perk prize inventory screens. | Requires `auth.uid()` and `public.current_user_is_admin()`. | `authenticated`, `service_role` |
| `public.queue_broadcast_notification(text, text, text, text, text, text, jsonb, text)` | `ADMIN_AUTHENTICATED` | Admin/domain broadcast workflows. | Requires `auth.uid()` and `public.current_user_is_admin()` for direct authenticated calls. | `authenticated`, `service_role` |
| `public.start_quiz_attempt(text, text)` | `PUBLIC_AUTHENTICATED_SELF` | Authenticated learners starting their own quiz attempts. | Derives user, eligibility, attempt mode, question snapshots and XP from canonical database state. | `authenticated`, `service_role` |
| `public.answer_quiz_question(uuid, text, text[])` | `PUBLIC_AUTHENTICATED_SELF` | Authenticated learners answering questions in their own attempts. | Validates selected options against server-created snapshots and grades against private answer keys. | `authenticated`, `service_role` |
| `public.complete_lesson_page(text, text)` | `PUBLIC_AUTHENTICATED_SELF` | Authenticated learners and trusted service-role maintenance calls scoped to the current auth context. | Uses `auth.uid()` as the only user identity source and only records a completion for the current user when the target page belongs to a published lesson/course. | `authenticated`, `service_role` |
| `public.mark_notification_read(uuid)` | `PUBLIC_AUTHENTICATED_SELF` | Authenticated learners and trusted service-role maintenance calls scoped to the current auth context. | Uses `auth.uid()` as the only user identity source and only updates `read_at` for a notification owned by the current user. | `authenticated`, `service_role` |
| `public.mark_all_notifications_read()` | `PUBLIC_AUTHENTICATED_SELF` | Authenticated learners and trusted service-role maintenance calls scoped to the current auth context. | Uses `auth.uid()` as the only user identity source and only updates `read_at` on unread notifications owned by the current user. | `authenticated`, `service_role` |

Private implementation helpers:

| Function | Intended callers | Authorization rule |
| --- | --- | --- |
| `private.queue_user_notification(...)` | Trusted database notification workflows. | No API role receives direct `EXECUTE`. |
| `private.queue_push_deliveries_for_notification(uuid)` | Trusted database notification workflows. | No API role receives direct `EXECUTE`. |
| `private.post_xp_transaction(...)` | Trusted database XP workflows. | No API role receives direct `EXECUTE`; public use cases must call domain RPCs. |
| `private.quiz_answer_keys` | Trusted quiz grading/admin workflows. | No API role receives direct table access; learner reads use sanitized public views. |

## Operational Rules

For every new privileged function:

```sql
revoke execute on function public.some_function(...) from public, anon, authenticated;
```

Then grant only the intended role:

```sql
grant execute on function public.some_function(...) to authenticated;
```

Admin-callable functions must perform the check before any privileged read or write:

```sql
if auth.uid() is null or not public.current_user_is_admin() then
  raise exception 'Admin access required.';
end if;
```

When a function is an implementation primitive, prefer moving it behind a business use-case RPC in a later migration. Until then, it must not be executable by `anon`. If it is executable by `authenticated`, it must fail closed before privileged reads, writes, or delegation.

## Lesson publication and reader boundary (2026-09-05)

| Function | Classification | Intended callers | Authorization rule | Roles with EXECUTE |
| --- | --- | --- | --- | --- |
| `public.admin_publish_lesson(text)` | `ADMIN_AUTHENTICATED` | Lesson Editor publication after app readiness checks | Requires a user actor and `current_user_can_edit_course` on the lesson's trusted course; preserves the existing database AI approval guard. | `authenticated`, `service_role` |
| `public.admin_revert_lesson_to_published(text)` | `ADMIN_AUTHENTICATED` | Lesson Editor restore after confirmation | Same course-scoped authorization; rejects IDs now owned by another lesson. | `authenticated`, `service_role` |
| `public.admin_delete_lesson_page(text, text)` | `ADMIN_AUTHENTICATED` | Draft page deletion | Same course-scoped authorization; page must belong to the lesson and one page must remain. | `authenticated`, `service_role` |

The private SQL invoker helper `private.lesson_draft_snapshot(text)` has no API-role
EXECUTE grant. These CMS classifications use the accepted resource-scoped editor
boundary, including Platform Catalog and organisation editors, rather than the
older global-admin-only example. A service-role call still requires an authorized
user actor. Existing upsert/status RPCs remain compatible and do not automatically
capture snapshots; app publication entry points explicitly invoke publication.
The original publish/revert RPCs remain available to trusted automation, while
interactive editor routes use the checked forms below.

| Function | Classification | Authorization and behavior | Roles with EXECUTE |
| --- | --- | --- | --- |
| `public.admin_save_lesson_builder(text, bigint, jsonb, jsonb)` | `ADMIN_AUTHENTICATED` | Requires course edit access, actor and matching draft revision; saves the entire draft atomically and returns canonical saved fields. | `authenticated`, `service_role` |
| `public.admin_publish_lesson_checked(text, bigint)` | `ADMIN_AUTHENTICATED` | Same actor/course boundary and revision check; delegates publication and returns snapshot/revision. | `authenticated`, `service_role` |
| `public.admin_revert_lesson_checked(text, bigint)` | `ADMIN_AUTHENTICATED` | Same actor/course boundary and revision check; delegates restoration. | `authenticated`, `service_role` |
| `public.current_user_can_read_published_lesson(text)` | `PUBLIC_ANON_READ` | Requires a published lesson with a snapshot, a published course and existing tenant/course read authorization. | `anon`, `authenticated`, `service_role` |

Raw lesson/page/block SELECT policies now require editorial access. The security
barrier views `learner_lessons` and `learner_lesson_page_references` expose only
published content under the read predicate. Quiz learner views use that predicate
without exposing answer keys. Editor quiz/media policies are role-scoped so an
anonymous read cannot invoke an editor-only helper.

`private.lesson_page_identities` retains ordinary/programme completion references
across draft deletion. It and `private.published_lesson_pages` have no API-role
read grants. Revision-lock and revision/identity trigger helpers have no API-role
EXECUTE grants. Stale revisions use `PT409` so clients receive a conflict without
serialization retries. Completion, quiz eligibility and mission counts resolve
against published membership/settings while preserving existing XP/tenant rules.

## Media library extension, 2026-09-05

Media registry/version/permission/placement tables are private, with no API-role
table grants. `media_workspace_permissions`, `admin_media_library`,
`admin_manage_media`, `admin_remove_media_placement`,
`admin_apply_registered_media`, `admin_media_issues`,
`admin_media_permission_targets` and `admin_dispatch_media_notifications` are
explicitly authenticated boundaries. Owner/admin authority is required for shared
asset management; edit permission is sufficient for workspace discovery and new
uploads/reuse. Every source/destination scope is checked in the database.

`media_delivery` allows anonymous execution only so already-public Catalog content
can deliver its media. It returns storage identity only after verifying a
permitted editor preview or a saved use in accessible published content; revoked
versions return no delivery record. Storage signing follows that decision on the
server, and responses bypass shared caches.

`service_register_media`, `service_finish_media_deletion`,
`service_media_inventory` and `service_close_legacy_media_buckets` are service-only.
The last is an explicit, inventory-gated release action, not an app rendering
operation. Publication/revert wrappers retain their existing actor checks and add
saved-version/revocation validation. Private restore markers cannot be forged by
API callers. See `docs/org-media-platform-library-plan.md` for rollout limits.

The release regression follow-up adds `admin_duplicate_lesson(text,text)` in
`20260905180000_atomic_lesson_duplication.sql`. Only authenticated course editors
may call it; the source must belong to that course. Shell, pages, blocks and quiz
copy in one transaction, preserving media and entitlement triggers. A rejected
media use rolls back the whole copy. No service-role or anonymous EXECUTE grant
is added. This forward migration is applied locally; hosted deployment remains
to be verified separately from the previously reported media migrations.


## AI authoring assistance, 2026-09-06

`admin_quote_ai_assistance`, `admin_prepare_ai_assistance_apply`,
`admin_apply_ai_assistance` and `admin_review_ai_assistance_lesson` are authenticated
editor boundaries. Quotes capture private teaching context and source fingerprints;
prepare freezes selection; apply rechecks target/source and commits content plus a
receipt atomically. Review locks the expected revision and records attribution.
None publishes implicitly. `admin_read_ai_results` adds an optional course filter
and retains actor/workspace authorization on every detail/list read.

`admin_start_ai_page` and the existing service-only claim/checkpoint functions
support the additional operation kinds without another job or accounting system.
The original page apply is private (`ai_page_apply_v1`); its public wrapper rejects
other kinds. Source-lock and candidate-validation helpers remain inaccessible to
API roles. Public RPC classifications and generated types match these signatures.

Inline-media completeness is an editorial choice, not an authorization boundary.
The explicitly authorized removal of required-inline-media gates leaves attached
asset ownership, placement, revocation and protected publication checks intact.
See [Phase 2 evidence](ai-authoring-phase-2.md) for local tests and rollout limits.

## AI course authoring Phase 3

Course candidates extend the private authoring-result store and existing durable
jobs; no additional job platform or direct result-table access is introduced.
`admin_quote_ai_course` and `admin_save_ai_course_outline` require current workspace
editing access and bounded input; draft quotes bind the saved outline revision.
`admin_start_ai_page` routes these new operation kinds through the existing ledger
and idempotent start identity. Earlier operation kinds retain their handlers.

`service_ai_course_checkpoint` is service-only. It fences each provider start by
lease identity, rechecks the initiating editor and organisation entitlement, rejects
uncertain repeated calls and persists validated lesson checkpoints. Its private
settlement helper reuses the organisation ledger and releases never-started work.
The service-only begin response includes retained teaching checkpoints for course
progression, including retries; the worker sends bounded excerpts to the provider.
This adds no browser result fields, extra reads or provider reservations.
Retry quotes copy completed checkpoints; uncertain application must be reconciled
before starting a retry. Read/list/stream operations remain authenticated and
read-only, with no shared tenant cache or per-lesson listener.

`admin_prepare_ai_course_apply` persists application intent and
`admin_apply_ai_course` validates and saves a complete or explicitly chosen partial
candidate atomically with its receipt. The extracted
`private.materialize_ai_course_tree` is inaccessible to API roles and is shared
with the legacy guarded materializer. Receipt replay never regenerates or charges,
and still checks current access. Saved organisation courses remain private.

`admin_review_ai_authored_course` and `admin_publish_ai_authored_course` lock the
course graph and expected revisions. They preserve actual-content, cover and
attached-media checks; publication calls the established lesson snapshot boundary.
Review records an explicit reviewer and never publishes. Individual course-created
lessons also use the existing optional-media assistance-review action.
`admin_set_ai_course_artwork` checks current course permission and permitted registry
versions before an editor's placement, and resets review after changes. It makes no
provider call. All public additions are classified with narrow authenticated or
service-only grants and covered by the existing RPC security gate.

## AI authoring outage recovery (Phase 6)

`service_recover_ai_authoring_jobs(integer)` is classified `SERVICE_ROLE_ONLY`
and explicitly denies browser identities. The existing authenticated worker
endpoint invokes it before claiming work; result/status reads never reconcile
jobs. Each invocation locks at most 20 eligible jobs, then their retained result,
replacing an expired lease before settlement. It uses the existing fenced
checkpoint functions and credit ledger, never a provider call or new reservation.

Recovery can register an image already stored at its deterministic private result
path, including an older failed worker result. MIME/size validation and the
existing owned immutable-version registration boundary still apply. Per-item
exceptions roll back temporary leases and partial writes while preserving stored
bytes; the response reports deferred work for repair. Late worker writes are
rejected, and replay cannot duplicate a version or charge. The ACL registry and
27 focused pgTAP assertions cover this boundary. See
[Phase 6 evidence](ai-authoring-phase-6.md) for local and hosted release status.
