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

The DB suite includes:

- `supabase/tests/database/rpc_security.sql`
- `supabase/tests/database/notification_security.sql`
- `supabase/tests/database/xp_ledger_security.sql`
- `supabase/tests/database/quiz_security.sql`
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
- client RPC privileges match classifications;
- sensitive public wrappers that are authenticated-reachable fail closed before reaching trusted primitives;
- private XP and notification implementation helpers are not directly executable by API roles;
- service role can run operational reminder generation;
- learners cannot directly insert quiz attempts or forged attempt questions;
- learner quiz reads use sanitized views without answer keys;
- private quiz answer keys are not client-readable;
- quiz start and answer are authenticated use-case RPCs;
- private XP posting is not directly executable by API roles.

## Latest Confirmed Result

Last confirmed linked DB gate:

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

The app-side checks were also confirmed during P0 remediation:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Next Action Items

With P0 complete, continue with Phase 1A from `docs/project-ve-engineering-remediation-plan.md`:

- `VE-TEST-001`: keep expanding automated security coverage beyond the P0 gate.
- `VE-AUTH-001`: harden auth/session and startup secret handling.
- `VE-NOTIF-002`: restrict learner notification mutations to explicit read/mark-read use cases.

Then move into Phase 1B:

- `VE-PROGRESS-001`
- `VE-DATA-001`
- `VE-API-001`
- `VE-OBS-001`
- `VE-DB-001`
