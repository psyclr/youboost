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

- **Development and tests** — run locally, NOT in Docker
  - Backend: `npm run dev` (port 3000)
  - Frontend: `cd frontend && npm run dev` (port 3001)
  - E2E tests: `cd frontend && npx playwright test` (against local dev servers)
- **Manual testing and deploy** — in Docker
  - `docker compose up --build -d`
  - After code changes, rebuild: `docker compose up --build -d frontend` (or `backend`)

## E2E Tests (Playwright)

- Config: `frontend/playwright.config.ts`, base URL: `http://localhost:3001`
- Test dir: `frontend/e2e/`
- Rate limiting: login endpoint has 10 req/15min in-memory limit. Total logins across all spec files must stay <= 10. Backend restart clears limits.
- Use `test.describe.serial` with shared `BrowserContext` + `Page` to minimize logins (1 per spec file)
- Use `page.route()` to mock API responses where needed (order creation, bulk orders)
- Selectors: prefer `getByRole('combobox')` over `[data-slot="select-trigger"]` — data-slot causes 30s timeouts
- **IMPORTANT:** Run `npx playwright test` from `frontend/` dir, NOT from project root — root dir picks up Jest test files from `src/`
- **IMPORTANT:** Before running tests, stop Docker frontend (`docker compose stop frontend`) and start local dev server (`cd frontend && npx next dev -p 3001`)
- If rate limited: `docker compose restart backend` clears in-memory limits
- Unicode: use actual `…` character in JSX, NOT `\u2026` — JSX attribute strings and JSX text do NOT interpret JS escape sequences

## Ports

| Service  | Port |
| -------- | ---- |
| Backend  | 3000 |
| Frontend | 3001 |
| Postgres | 5432 |
| Redis    | 6379 |

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

## Reference

- Architecture plan: `План архитектуры платформы youboost для SMM-маркетплейса (1).pdf`
- Market research: `Глубокое исследование рынка SMM-панелей (фокус на YouTube).pdf`
- API docs: `docs/api/openapi.yaml`

## Test User

- Admin: `admin@youboost.dev` / `admin123`
