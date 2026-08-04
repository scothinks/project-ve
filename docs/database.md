# Database Workflow

Migrations are the schema source of truth.

```text
supabase/migrations/
```

The repository no longer keeps a hand-maintained `supabase/schema.sql`. If a
schema dump is needed for debugging or release review, generate it as a temporary
artifact from a migrated database and do not commit it.

## Local Database

A clean checkout should use the committed Supabase config and migration history:

```bash
npm install
npm run db:start
npm run db:reset
npm run db:types:local:check
npm run test:db
```

For a one-command local verification after Supabase is running:

```bash
npm run db:verify:local
```

`npm run db:reset` rebuilds the local database from migration history. It must
not consult `supabase/schema.sql`.

Database scripts use the repo-local `supabase` dev dependency through
`node scripts/supabase-cli.mjs` so reset, test, and type-generation behavior does
not change silently when a new CLI release is published. The wrapper also uses a
writable temp Supabase CLI home, which avoids local validation failures caused by
`npx` registry lookups or restricted `~/.supabase` writes.

Local role bootstrap lives in:

```text
supabase/roles.sql
```

It creates the local `cli_login_postgres` role name that hosted Supabase exposes
to the linked pgTAP runner, and mirrors the linked project's public-schema
default privileges for `anon`, `authenticated`, and `service_role`. RLS policies
remain the row-level boundary; the grants let local clients and pgTAP fixtures
reach those policies the same way they do in the linked project.

Local test seed data lives in:

```text
supabase/seed.sql
```

It creates the permanent learner/admin pgTAP fixture users locally. Linked tests
use the corresponding real users declared in
`supabase/tests/database/_test_constants.psql`.

## Linked Database

Generated TypeScript database types live at:

```text
types/database.ts
```

Regenerate after a migration is pushed to the linked Supabase project:

```bash
npm run db:types
```

Check committed types against the linked project:

```bash
npm run db:types:check
```

GitHub Actions uses the project-ref based variant so it does not depend on a
checked-in Supabase link state:

```bash
npm run db:types:check:ci
```

Configure these repository secrets before expecting CI to enforce linked schema
drift:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
```

The current generated contract covers the `public` schema. App Supabase client
factories are parameterized with `Database`, so table, view, enum and RPC drift
now surfaces during `npm run typecheck`.

Do not hand-edit `types/database.ts`. Regenerate it from the linked or local
migrated schema.

Local type generation uses the explicit local Postgres URL emitted by
`supabase start` instead of the Supabase CLI `--local` shortcut, so the command
does not depend on CLI-internal password discovery.

Type check commands compare through `scripts/check-database-types.mjs`, which
normalizes Supabase generator metadata that differs between linked and direct
database URL generation while still failing on schema contract drift.

## DB Tests

Run local pgTAP tests against the local Supabase database:

```bash
npm run test:db
```

Run the remote linked security gate:

```bash
npm run test:db:linked
```

The linked gate depends on the permanent test users and hosted-project pgTAP role
documented in `supabase/tests/database/_test_constants.psql`.

## Guardrails

Do not reintroduce runtime schema-version inference based on database error
strings. Migrations and generated types define the supported schema contract.

Do not reintroduce `supabase/schema.sql` as source. If a future tool requires a
schema dump, write it outside the tracked source tree or treat it as generated
output.
