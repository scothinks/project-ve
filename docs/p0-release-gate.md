# P0 Release Gate

Run the P0 gate before considering the current security remediation complete:

```bash
npm run test:p0
```

This command runs:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run build`
4. `npm run test:db`

The broader local remediation gate is:

```bash
npm run test:remediation:local
```

That command resets/replays local migrations, checks local database type drift,
runs local pgTAP, repository contracts, the quiz XP concurrency regression, and
the current E2E command. GitHub Actions runs this as a merge-blocking job.

The DB suite includes:

- `supabase/tests/database/ai_generation_worker.sql`
- `supabase/tests/database/rpc_security.sql`
- `supabase/tests/database/notification_security.sql`
- `supabase/tests/database/xp_ledger_security.sql`
- `supabase/tests/database/quiz_security.sql`
- `supabase/tests/database/progress_security.sql`
- `supabase/tests/database/p0_release_gate.sql`

## Required Environment

DB tests require:

- Docker daemon running;
- Supabase CLI available through `npx supabase`;
- local Supabase database reachable by the CLI;
- npm registry access if the Supabase CLI is not already cached.

## Current P0 Assertions

The gate checks that:

- every public `SECURITY DEFINER` function has a classification;
- every public RPC classification resolves to a current function signature;
- `anon`, `authenticated`, and `service_role` RPC privileges match classifications;
- sensitive public wrappers that are authenticated-reachable fail closed before reaching trusted primitives;
- private XP and notification implementation helpers are not directly executable by API roles;
- service role can run operational reminder generation;
- learners cannot directly insert quiz attempts or forged attempt questions;
- learner quiz reads use sanitized views without answer keys;
- private quiz answer keys are not client-readable;
- quiz start and answer are authenticated use-case RPCs;
- private XP posting is not directly executable by API roles.

## Latest Confirmed Result

Last confirmed linked DB gate after `VE-SEC-003`:

```text
ai_generation_worker.sql ... ok
notification_security.sql .. ok
p0_release_gate.sql ........ ok
progress_security.sql ...... ok
quiz_security.sql .......... ok
rpc_security.sql ........... ok
xp_ledger_security.sql ..... ok
All tests successful.
Files=7, Tests=147
Result: PASS
```

A third `VE-SEC-002` classification refinement migration is pushed and linked
validated with `Files=7, Tests=133, Result: PASS`.

The follow-up test-only `VE-SEC-002` mission-flow acceptance assertion raises
the linked pgTAP suite to 136 assertions.

The `VE-QUIZ-003` daily quiz XP serialization migration is also pushed and
linked validated with `Files=7, Tests=136, Result: PASS`.

The `VE-AI-002` durable worker lease fencing migration is pushed and linked
validated with `Files=7, Tests=140, Result: PASS`.

The `VE-AI-003`, `VE-TEST-003`, and `VE-SEC-003` closure work raises the linked
pgTAP gate to 147 assertions. The `VE-SEC-003` migration
`20260801172803_align_rpc_classification_service_role_acl.sql` is pushed and
linked validated with `Files=7, Tests=147, Result: PASS`.

The app-side checks were also confirmed during P0 remediation:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Next Action Items

No VE-TEST-002 addendum closure items remain open. `npm run test:e2e` now runs
real Playwright browser coverage for the critical learner/admin remediation
flows against local Supabase, and `npm run test:remediation:local` includes
that suite plus the local economic integrity regression in the merge-blocking
local gate.

Latest local remediation validation:

```text
npm run test:remediation:local
Result: PASS
pgTAP: Files=7, Tests=147
Economic integrity regression: PASS
Playwright: 5 passed
```
