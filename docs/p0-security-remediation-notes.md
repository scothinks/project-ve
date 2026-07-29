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

The linked pgTAP P0 database gate passed:

```text
notification_security.sql .. ok
p0_release_gate.sql ........ ok
quiz_security.sql .......... ok
rpc_security.sql ........... ok
xp_ledger_security.sql ..... ok
All tests successful.
Files=5, Tests=89
Result: PASS
```

## Next Action Items

Proceed to Phase 1A in the main remediation plan:

- `VE-TEST-001`: broaden automated coverage around admin, reward, redemption, mission, notification, and XP workflows.
- `VE-AUTH-001`: enforce required security secrets and harden auth/session behavior.
- `VE-NOTIF-002`: reduce learner notification mutations to explicit scoped use cases.

Then continue with Phase 1B:

- `VE-PROGRESS-001`
- `VE-DATA-001`
- `VE-API-001`
- `VE-OBS-001`
- `VE-DB-001`
