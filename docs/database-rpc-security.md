# Database RPC Security

Project Ve treats Supabase RPCs as hostile browser entry points unless a function is explicitly classified and granted.

The authoritative machine-readable registry is:

```sql
private.rpc_security_classifications
```

Every `public.SECURITY DEFINER` function must have one row in that table. DB tests fail when a new `SECURITY DEFINER` function exists without a classification row.

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
