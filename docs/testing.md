# Testing

Primary commands:

```bash
npm run ci
npm run test:unit
npm run test:db
npm run test:db:linked
npm run test:integration
npm run test:remediation:local
npm run test:quiz-xp-concurrency:local
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

`npm run test:repositories:local` runs the `VE-DEMO-001` repository contract
tests twice:

```text
APP_MODE=demo with Supabase env blank
APP_MODE=live against the local Supabase API
```

Run it after `npm run db:start` and `npm run db:reset`. The live contract reads
the local Supabase URL and keys from `supabase status -o env`, reads published
learning content from the local database, inserts and removes learner progress
rows for the seeded test learner, and asserts live rewards/progress do not fall
back to demo snapshots. Override the local connection with
`LOCAL_SUPABASE_URL`, `LOCAL_SUPABASE_PUBLISHABLE_KEY`, and
`LOCAL_SUPABASE_SERVICE_ROLE_KEY` if your local Supabase output differs.

`npm run test:integration` runs local pgTAP tests, the local repository contract
tests, and the local quiz XP concurrency regression.

`npm run test:remediation:local` is the local remediation acceptance gate used
by GitHub Actions. It resets/replays the local database from migrations, checks
generated local database types against `types/database.ts`, runs local pgTAP,
runs repository contracts, runs the quiz XP concurrency regression, runs the
organisation AI reservation concurrency regression, runs the economic integrity
regression, and then runs the current E2E command.

`npm run test:quiz-xp-concurrency:local` runs the `VE-QUIZ-003` concurrency
regression directly against local Supabase Postgres. It creates throwaway local
auth users and content, uses real learner RPCs to start/answer attempts, submits
two correct answers concurrently, verifies the daily quiz XP cap is not
exceeded, checks ledger/cache consistency, and cleans up afterward. The script
refuses non-local database URLs unless `ALLOW_NONLOCAL_DB_CONCURRENCY_TESTS=1`
is explicitly set.

`npm run test:organization-ai-concurrency:local` runs the P1.5E organisation AI
reservation concurrency regression directly against local Supabase Postgres. It
creates a throwaway organisation entitlement fixture, opens two real `psql`
sessions with overlapping reservations that cannot both fit under the hard cap,
and verifies exactly one reservation succeeds while total reserved units remain
within budget. The script refuses non-local database URLs unless
`ALLOW_NONLOCAL_DB_CONCURRENCY_TESTS=1` is explicitly set.

`npm run test:economic-integrity:local` runs the `VE-TEST-003` economic
integrity regression directly against local Supabase Postgres. It creates
throwaway local users, missions, rewards, and inventory; asserts concurrent
reward redemption allocates one reward only; asserts duplicate XP mission and
reward mission awards collapse to one domain event; verifies ledger/cache
consistency after each economic mutation; and cleans up afterward. The script
refuses non-local database URLs unless `ALLOW_NONLOCAL_DB_ECONOMIC_TESTS=1` is
explicitly set.

`npm run test:db:linked` is the remote Supabase pgTAP security gate. It depends
on the linked project containing the permanent learner/admin test users declared
in `supabase/tests/database/_test_constants.psql`, so it remains a linked
environment validation command rather than the local replay gate.

Latest linked DB result after `VE-AI-002`:

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

The third `VE-SEC-002` classification refinement migration is pushed and linked
validated with `Files=7, Tests=133, Result: PASS`.

The follow-up test-only `VE-SEC-002` mission-flow acceptance assertion raises
the linked pgTAP suite to 136 assertions.

The `VE-QUIZ-003` daily quiz XP serialization migration is pushed and linked
validated with `Files=7, Tests=136, Result: PASS`.

The `VE-AI-002` durable worker lease fencing cleanup is pushed and linked
validated with `Files=7, Tests=140, Result: PASS`.

`npm run test:e2e` now runs the Playwright remediation browser suite against
local Supabase. The suite creates throwaway users/content and covers real
signup, password login, learner lesson progress plus quiz XP, reward
redemption/history, the admin course status workflow, the CMS authoring
workspace, and the institutional Org Mode journey. For local E2E only, the
runner disables the public Turnstile widget, forces a fresh `.next` production
build for the Playwright server, and enables a local-only verification bypass
fenced to `PROJECT_VE_LOCAL_E2E=1`, non-Vercel execution, and the local Supabase
URL.

Current local remediation gate shape:

```text
npm run test:remediation:local
Expected coverage: local DB reset/replay, generated type drift, full pgTAP,
repository contracts, quiz XP concurrency, organisation AI reservation
concurrency, economic integrity, and E2E.
```

Latest focused P1.5E boundary-closure validation:

```text
npm run db:reset
node scripts/supabase-cli.mjs test db supabase/tests/database/organization_ai_metering.sql
node scripts/supabase-cli.mjs test db supabase/tests/database/lms_reporting.sql
npm run test:organization-ai-concurrency:local
npm run test:db
npm run db:types:local:check
npm run typecheck
npm run lint
npm run build
git diff --check

Result: PASS
Focused pgTAP: organization AI metering 18/18; LMS reporting 34/34
Full pgTAP: Files=33, Tests=695
Organisation AI reservation concurrency regression: PASS
Build/type/lint/whitespace: PASS
```

GitHub Actions now blocks pull requests and pushes on:

- app-side `npm run ci`;
- linked Supabase type drift when `SUPABASE_ACCESS_TOKEN` and
  `SUPABASE_PROJECT_REF` are configured;
- local remediation replay through `npm run test:remediation:local`.
