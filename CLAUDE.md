# youboost — SMM marketplace for YouTube

Node.js + TypeScript (strict) + Fastify + PostgreSQL (Prisma) + Redis + BullMQ

## Architecture

Monorepo with modular services under `src/modules/`:

| Module        | Path                         | Key patterns                                                    |
| ------------- | ---------------------------- | --------------------------------------------------------------- |
| Auth          | `src/modules/auth/`          | JWT + refresh tokens, bcrypt, Redis sessions                    |
| Billing       | `src/modules/billing/`       | Ledger transactions, fund holds, deposits                       |
| Orders        | `src/modules/orders/`        | State machine, BullMQ status polling worker                     |
| Providers     | `src/modules/providers/`     | AES-256-GCM key encryption, priority selection, circuit breaker |
| API Keys      | `src/modules/api-keys/`      | SHA-256 hashing, rate limiting tiers (Redis)                    |
| Webhooks      | `src/modules/webhooks/`      | HMAC-SHA256 signatures, BullMQ delivery + retry                 |
| Notifications | `src/modules/notifications/` | BullMQ queue, stub email provider                               |
| Admin         | `src/modules/admin/`         | User/order/service management, dashboard stats                  |
| Catalog       | `src/modules/catalog/`       | Public (no auth), Redis caching (5-min TTL)                     |

- **Backend:** Node.js + Fastify, `src/` directory. Entry point: `src/app.ts`
- **Frontend:** Next.js (App Router), `frontend/` directory
- **Database:** PostgreSQL 15 (schema: `scripts/init-db.sql`), Redis 7
- **Shared code:** `src/shared/` — config, database, queue, middleware, errors, swagger
- **Docker:** `docker-compose.yml` — postgres, redis, backend (port 3000), frontend (port 3001)

## Development vs Docker

Docker compose is **prod-only**. Dev runs locally on **separate ports** so it coexists with the running prod stack — never run dev servers in Docker, never stop prod to develop.

- **Development and tests** — run locally on dev ports (prod stays up on 3000/3001)
  - Backend: `LOGIN_RATE_LIMIT_MAX=500 PORT=3100 npm run start:dev` (dev port 3100; high login limit so the e2e suite, which logs in per spec, doesn't hit the 10/15min `/login` cap — prod default stays 10)
  - Frontend: `cd frontend && API_URL=http://localhost:3100 npx next dev -p 3101` (dev port 3101; its `/api` proxy targets the dev backend)
  - E2E tests: `cd frontend && npx playwright test` (against the local dev stack on 3101)
- **Deploy** — push, then rebuild prod containers without cache so they pick up the pushed code
  - `docker compose build --no-cache backend frontend && docker compose up -d`
- **No CI:** there are no GitHub Actions and none are wanted — verify locally before pushing.

## E2E Tests (Playwright)

- Config: `frontend/playwright.config.ts`, base URL: `http://localhost:3101` (dev frontend; override with `E2E_BASE_URL`)
- Test dir: `frontend/e2e/`
- **Mocked UI specs** run against the dev stack (3101 → dev backend → `youboost_dev`). They use `page.route()` to fake `/api` — fine because they never mutate real data.
- **Real-backend specs** (money/state journeys, e.g. `landing-cart-checkout.spec.ts`) must NOT hit `youboost_dev` (it's shared with prod). They are guarded by `E2E_REAL_BACKEND=1` and run only against the **isolated Docker stack**: `scripts/e2e-stack.sh` (docker-compose.test.yml — own ephemeral pg+redis+backend+frontend on 33xx, `PAYMENTS_FAKE` stubs the external provider, seeded). One command: `scripts/e2e-stack.sh` (up --build → wait → playwright → down -v).
- **Backend DB-mutating integration tests** (jest, `*.integration.test.ts`) gate on `TEST_DATABASE_URL` and run against `youboost_test` — never `youboost_dev`. See the `database-operations` skill.
- Rate limiting: login endpoint has 10 req/15min in-memory limit. Total logins across all spec files must stay <= 10. Backend restart clears limits.
- Use `test.describe.serial` with shared `BrowserContext` + `Page` to minimize logins (1 per spec file)
- Use `page.route()` to mock API responses where needed (order creation, bulk orders)
- Selectors: prefer `getByRole('combobox')` over `[data-slot="select-trigger"]` — data-slot causes 30s timeouts
- **IMPORTANT:** Run `npx playwright test` from `frontend/` dir, NOT from project root — root dir picks up Jest test files from `src/`
- **IMPORTANT:** Run against the local dev stack on dev ports (frontend 3101 → backend 3100). No need to stop the prod Docker stack — dev ports don't clash with it.
- If rate limited: restart the dev backend (kill + `LOGIN_RATE_LIMIT_MAX=500 PORT=3100 npm run start:dev`) — clears the in-memory limits and raises the login cap
- Unicode: use actual `…` character in JSX, NOT `\u2026` — JSX attribute strings and JSX text do NOT interpret JS escape sequences

## Ports

| Service  | Prod (Docker) | Dev (local) |
| -------- | ------------- | ----------- |
| Backend  | 3000          | 3100        |
| Frontend | 3001          | 3101        |
| Postgres | 5432          | 5432        |
| Redis    | 6379          | 6379        |

Dev backend/frontend use separate ports so they coexist with the prod Docker stack; Postgres/Redis are shared.

## Linting

- **ESLint**: Runs automatically via PostToolUse hook after every Edit/Write. Fix errors before proceeding.
- **TypeScript (`tsc --noEmit`)**: Runs in husky pre-commit. Too slow for per-edit.
- **Prettier**: Runs via husky pre-commit hook.

## Conventions

- **Commits**: `type(scope): message` (conventional commits)
- **Coverage**: >= 80% required, target 97%+
- **Testing**: TDD — write failing test first, then implement
- **Security**: Financial system — validate all inputs, no hardcoded secrets, parameterized queries only, API keys encrypted at rest
- **Banned**: `any` type, `console.log` (use Pino), `eval()`, committing `.env`
- **Language**: Code and comments in English, user-facing strings as needed

## Always verify, never guess

Any factual claim — about anything: code behavior, library APIs, provider policies, configs, file contents, defaults, ports, env vars, what was committed, what tests pass, etc. — must be **verified** before stating it. Read the file, run the command, search the docs, test empirically.

- Never extrapolate from "this is how it usually works" or "I think this is how X behaves" and present it as fact.
- If verification isn't possible right now, say so explicitly: "I haven't verified, but typically..." — never present a guess as a statement of fact.
- This applies universally — codebase questions, infra/providers, libraries, APIs, package behavior, what was already done in this session, everything.

### Verify completion by every available method

Before claiming work is "done", "verified", "working", or "passing", run **every** verification method that applies — not just one. A single check (a screenshot, a 200 response, "looks right") is not verification.

- For code changes: `tsc --noEmit`, ESLint, the relevant existing tests (e2e/unit), AND a runtime/browser check.
- For UI work: typecheck + relevant e2e + screenshot/visual diff. A screenshot alone does not catch type errors, regressions, or broken handlers.
- For infra/config: read the config back, hit the endpoint, tail the logs, test from a clean process.
- Only call it "verified" when every applicable method passed. If you skipped a method, say which and why.

## Reference

- Architecture plan: `План архитектуры платформы youboost для SMM-маркетплейса (1).pdf`
- Market research: `Глубокое исследование рынка SMM-панелей (фокус на YouTube).pdf`
- API docs: `docs/api/openapi.yaml`

## Test User

- Admin: `admin@youboost.dev` / `admin123`
