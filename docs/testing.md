# Testing

Primary commands:

```bash
npm run ci
npm run test:unit
npm run test:db
npm run test:db:linked
npm run test:integration
npm run db:verify:local
npm run test:e2e
npm run db:types:check
```

`npm run ci` is the app-side CI gate and runs typecheck, lint, unit tests, and
build.

`npm run db:types:check` verifies that committed Supabase TypeScript types match
the linked database schema. It requires a linked Supabase project and Supabase
CLI authentication, so run it whenever migrations are pushed.

GitHub Actions runs the equivalent CI command:

```bash
npm run db:types:check:ci
```

The CI job requires these repository secrets:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
```

When both are present, schema/type drift blocks the workflow. If either secret
is absent, the job emits a notice and skips only the linked Supabase drift check.

`npm run db:verify:local` resets the local database from `supabase/migrations`,
checks locally generated public-schema types against `types/database.ts`, and
runs local pgTAP tests. It does not use `supabase/schema.sql`.

`npm run test:db:linked` is the remote Supabase pgTAP security gate. It depends
on the linked project containing the permanent learner/admin test users declared
in `supabase/tests/database/_test_constants.psql`, so it is intentionally kept
separate from the generic app CI workflow until CI has a dedicated linked test
database and secret set.

Latest linked DB result after `VE-DB-001`:

```text
notification_security.sql .. ok
p0_release_gate.sql ........ ok
progress_security.sql ...... ok
quiz_security.sql .......... ok
rpc_security.sql ........... ok
xp_ledger_security.sql ..... ok
All tests successful.
Files=6, Tests=107
Result: PASS
```

`npm run test:e2e` is present as a stable command for the next Playwright pass,
but no browser scenarios are configured yet.
