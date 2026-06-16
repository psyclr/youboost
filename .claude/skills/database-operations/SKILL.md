---
name: database-operations
description: Use for ANY youboost database work — running migrations, inspecting/querying data, writing DB-backed integration tests, or any script that touches Postgres. Covers the Prisma 7 + prisma.config.ts setup, the env/tooling gotchas, and the critical rule that prod and dev SHARE one database (youboost_dev) so mutating work must run against an isolated test DB (youboost_test).
---

# Youboost database operations

## ⚠️ The one rule that matters: prod and dev share ONE database

Both the prod Docker backend and the local dev backend connect to **`youboost_dev`**
on the shared Postgres at `localhost:5432` (see `.env` `DATABASE_URL`). There is no
separate prod DB. **Any write to `youboost_dev` is a write to production data.**

Before running anything that mutates rows (a script, a seed, an integration test),
**verify which database you are about to hit** (trace-verify your own command). Never
point a mutating test or experiment at `youboost_dev`.

## Inspecting / querying (read-only is safe)

```bash
docker compose exec -T postgres psql -U youboost -d youboost_dev -c "SELECT ..."
```
- Tables are snake_case plural: `users`, `deposits`, `ledger`, `wallets`, `landings`,
  `landing_pages` does NOT exist (it's `landings`). Confirm names via
  `information_schema.tables` rather than guessing.
- Prisma model accessors (in code/tests): `prisma.user`, `prisma.deposit`,
  `prisma.ledger`, `prisma.wallet`. Money columns (`balance`, `amount`) are
  `Decimal` → wrap with `Number(...)` for assertions.

## Prisma 7 setup (how the connection is resolved)

- `prisma/schema.prisma` datasource has **no inline url**; the URL comes from
  `prisma.config.ts`, which reads `process.env.DATABASE_URL` (via `import 'dotenv/config'`).
- `dotenv` does **not** override an env var that is already set — so prefixing a command
  with `DATABASE_URL=...` wins over `.env`. This is how you target a non-default DB.
- Migrations live in `prisma/migrations`; apply them with `prisma migrate deploy`
  (not `db push` — this project is migration-based).

## Tooling env (always)

```bash
export PATH=/opt/nodejs/bin:$PATH          # Node 22 (system node is too old)
export NODE_OPTIONS=--experimental-require-module   # required for the Prisma CLI
```

## Best practice: isolated test database for DB-backed tests

Money-/state-mutating integration tests must run against a dedicated DB, never the
shared `youboost_dev`.

**Provision once (idempotent):**
```bash
docker compose exec -T postgres psql -U youboost -d youboost_dev \
  -c "CREATE DATABASE youboost_test OWNER youboost;"        # youboost role has CREATEDB
DATABASE_URL='postgresql://youboost:youboost_dev_password@localhost:5432/youboost_test' \
  NODE_OPTIONS=--experimental-require-module npx prisma migrate deploy
```

**Run DB-backed tests against it:**
```bash
TEST_DATABASE_URL='postgresql://youboost:youboost_dev_password@localhost:5432/youboost_test' \
  npx jest <name>.integration
```

**Write the test to be safe-by-default** (pattern: `src/modules/billing/__tests__/settlement.integration.test.ts`,
harness: `src/shared/outbox/__tests__/outbox.repository.integration.test.ts`):
- Gate on `TEST_DATABASE_URL`; `describe.skip` when unset → the suite is inert in
  normal `npx jest` runs and in CI without a test DB.
- **Hard-refuse the prod DB by NAME, not by URL substring.** The password literal is
  `youboost_dev_password`, so matching the whole URL false-positives. Extract the db
  name: `const dbName = url.split('/').pop()?.split('?')[0]; const SAFE = dbName !== 'youboost_dev';`
- Connect with the pg adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })`,
  `await prisma.$connect()` / `$disconnect()`.
- Clean up only the rows you created, in FK order (children first):
  `deposit → ledger → wallet → user` (deleteMany by tracked `userId`s). Track created
  ids in an array; don't truncate shared tables.

## When changing the schema

After editing `prisma/schema.prisma`: create a migration, `migrate deploy` to
`youboost_dev` (dev) AND re-apply to `youboost_test`, and regenerate the client
(`prisma generate`, output is `src/generated/prisma`). The prod stack picks up schema
on its next `docker compose build --no-cache backend`.
