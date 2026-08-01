# P0 Security Remediation Notes

The full backlog is saved in `docs/project-ve-engineering-remediation-plan.md`.

These notes track the implemented P0 database boundaries so follow-up tickets can build from the current state without relying on chat context.

## VE-SEC-001

`private.rpc_security_classifications` is the machine-readable registry for `public.SECURITY DEFINER` functions.

DB tests enforce:

- every public `SECURITY DEFINER` function has a classification;
- client role `EXECUTE` privileges match classification metadata;
- private implementation helpers are not directly executable by API roles;
- legacy public wrappers that are authenticated-reachable deny before privileged work.

## VE-NOTIF-001

Notification enqueueing now separates public RPC wrappers from private implementation helpers:

- `private.queue_user_notification(...)`
- `private.queue_push_deliveries_for_notification(...)`

Authenticated browser access reaches fail-closed denial wrappers for:

- `public.queue_user_notification(...)`
- `public.generate_continue_learning_reminders()`

Direct browser access remains denied for `public.queue_push_deliveries_for_notification(...)`.

`public.queue_broadcast_notification(...)` remains an admin-authenticated use case and must check:

```sql
auth.uid() is not null and public.current_user_is_admin()
```

The notification dispatch route may continue to call `generate_continue_learning_reminders()` through the Supabase service role.

## VE-XP-001

`public.xp_transactions` is the canonical ledger. `profiles.xp` and `profiles.xp_balance_cached` are cached balances.

New XP-producing code should use:

```sql
private.post_xp_transaction(...)
```

That helper:

- inserts the ledger row;
- applies the cached profile balance update only for a newly inserted transaction;
- treats earned XP with an `award_scope` as idempotent;
- is not directly executable by API roles.

The legacy `public.increment_profile_xp(uuid, integer)` helper remains only for trusted compatibility. It is authenticated-reachable only as a fail-closed wrapper: learner calls are denied before delegation. Service-role/trusted calls refuse to update profile balances unless a matching earn ledger row exists in the same transaction.

Generic browser-callable XP mutation primitives remain prohibited. Public XP operations must be use-case RPCs such as quiz answer, mission completion, reward redemption, or admin grant flows.

## VE-QUIZ-001

Learner-facing quiz reads use sanitized views instead of raw answer-key tables:

- `public.learner_quiz_questions`
- `public.learner_quiz_options`

The raw published-read RLS policies were removed from:

- `public.quiz_questions`
- `public.quiz_options`

Answer material is copied into:

```sql
private.quiz_answer_keys
```

That table stores `correct_option_ids` and `explanation`, is not readable by API roles, and is kept in sync by triggers on `quiz_questions` and `quiz_options`.

Admin authoring currently still uses the legacy raw columns under admin RLS. A later cleanup can move admin reads/writes fully onto explicit admin RPCs backed by `private.quiz_answer_keys`.

## VE-QUIZ-002

Learners no longer insert authoritative quiz attempt rows directly.

Removed learner insert policies:

- `public.quiz_attempts`
- `public.quiz_attempt_questions`

Quiz start now goes through:

```sql
public.start_quiz_attempt(p_quiz_id, p_lesson_id)
```

The RPC derives:

- `user_id` from `auth.uid()`;
- lesson eligibility and retry state from canonical lesson/progress tables;
- daily XP availability from XP settings and ledger rows;
- attempt mode from prior XP ledger awards;
- question snapshots and XP from canonical quiz configuration;
- sanitized option snapshots without correct-answer fields.

Quiz answers still go through:

```sql
public.answer_quiz_question(p_attempt_id, p_question_id, p_selected_option_ids)
```

The answer RPC now validates selected options against the server-created attempt snapshot and grades against `private.quiz_answer_keys`.

## Latest P0 Gate

The latest linked pgTAP database gate after `VE-AI-002` includes the AI worker
and progress security files and passes:

```text
ai_generation_worker.sql ... ok
notification_security.sql .. ok
p0_release_gate.sql ........ ok
progress_security.sql ...... ok
quiz_security.sql .......... ok
rpc_security.sql ........... ok
xp_ledger_security.sql ..... ok
All tests successful.
Files=7, Tests=140
Result: PASS
```

The second `VE-SEC-002` pass was applied by:

```text
supabase/migrations/20260801103000_review_remaining_rpc_classifications.sql
```

That migration corrects reviewed classifications/ACLs for:

- `public.find_existing_reward_inventory_values(text, text, jsonb)`;
- `public.refund_reward_redemption(uuid, text)`;
- `public.mission_proof_fields_satisfy(text[], text, uuid, text, text, text[])`.

Local and linked pgTAP validation after applying that migration pass all seven
database test files, now totaling 131 assertions.

The third `VE-SEC-002` pass was applied by:

```text
supabase/migrations/20260801110000_refine_public_rpc_classifications.sql
```

That migration refines the reviewed public/authenticated RPC classifications
without changing function grants. It adds explicit classification vocabulary for
public read helpers, public telemetry endpoints, authenticated read helpers,
and authenticated context-write helpers, then updates the reviewed ad/reward
rows. Local pgTAP validation after applying it passes all seven database test
files, now totaling 133 assertions. Linked pgTAP validation also passes with
`Files=7, Tests=133, Result: PASS`.

A follow-up test-only `VE-SEC-002` assertion was added to `rpc_security.sql`
proving that the supported mission completion/award path still works:

```text
complete_lesson_page(...)
award_valid_mission_xp(...)
```

Local and linked pgTAP validation pass all seven database test files, now
totaling 136 assertions.

The `VE-QUIZ-003` daily quiz XP serialization migration was then pushed to the
linked project:

```text
supabase/migrations/20260801113000_serialize_daily_quiz_xp_allocation.sql
```

Linked pgTAP validation remains green across all seven database test files:

```text
Files=7, Tests=136
Result: PASS
```

The `VE-AI-002` durable worker lease fencing cleanup is complete and was pushed
by:

```text
supabase/migrations/20260801132845_fence_ai_generation_worker_leases.sql
```

The migration adds fenced worker-id checks to AI job completion/failure paths,
keeps unfenced helper signatures non-executable by `service_role`, and adds
pgTAP coverage proving stale workers cannot fail or complete jobs after another
worker reclaims the lease. Local and linked pgTAP validation pass:

```text
Files=7, Tests=140
Result: PASS
```

The `VE-SEC-003` RPC governance cleanup is complete and linked validated. It
records `service_role` in the registry where actual ACLs already permit it for
`complete_lesson_page`, `mark_notification_read`, and
`mark_all_notifications_read`; pgTAP now compares declared roles against actual
ACLs for `anon`, `authenticated`, and `service_role`; and stale classification
rows fail the gate when they no longer resolve to a current public function
signature. The linked project has applied
`20260801172803_align_rpc_classification_service_role_acl.sql`, and linked pgTAP
passes:

```text
Files=7, Tests=147
Result: PASS
```

## Next Action Items

No VE-TEST-002 addendum closure items remain open. The local remediation gate
now includes real Playwright browser scenarios for signup, password login,
course progress, quiz XP, reward redemption/history, and admin course status
workflows, plus the local economic integrity regression for concurrent reward
redemption, duplicate mission awards, and ledger/cache consistency.

Latest local remediation validation passes:

```text
npm run test:remediation:local
pgTAP: Files=7, Tests=147
Economic integrity regression: PASS
Playwright: 5 passed
Result: PASS
```
