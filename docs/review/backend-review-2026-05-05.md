# Backend Review — 2026-05-05

**Scope:** Backend (`src/`) + frontend (`frontend/src/`) — architecture, code smells, security, SonarQube static analysis.

**Stack:** Fastify 5 + TypeScript (strict) + Prisma 7 + PostgreSQL + Redis + BullMQ + Next.js 15 (frontend).

**Tools:**

- SonarQube 26.3 (`http://localhost:9100/dashboard?id=youboost-smm`)
- ESLint + `eslint-plugin-sonarjs` + `eslint-plugin-unicorn`
- Architecture / code smells / security agents (manual code reading)

---

## 📊 TL;DR — Quality Snapshot

| Metric                   | Value        | Rating                          |
| ------------------------ | ------------ | ------------------------------- |
| Security rating          | **A (1.0)**  | 🔒                              |
| Maintainability rating   | **A (1.0)**  | 🔒                              |
| Reliability rating       | **C (3.0)**  | 🟡 (3 minor bugs, all frontend) |
| Coverage                 | **54.4%**    | 🟡 (target 80%+)                |
| Duplicated lines         | **7.3%**     | 🟡                              |
| Lines of code            | 22,096       | —                               |
| Cognitive complexity     | 909          | —                               |
| Bugs                     | 3 (frontend) | 🟡                              |
| Vulnerabilities          | **0**        | 🔒                              |
| Code smells              | 18           | 🟢                              |
| Security hotspots        | 2            | 🟡                              |
| ESLint errors / warnings | 0 / 0        | 🔒                              |
| Technical debt           | 88 min       | 🟢                              |

**Verdict:** Security clean, maintainability clean, zero vulnerabilities. Main issues are **architectural duplication** (Stripe/Cryptomus), **coverage gap** (54% vs 80% target), and a few **config hygiene** items (CORS default `*`, JWT min 16 chars, bcrypt rounds 10).

---

## 🔴 CRITICAL (Must Fix)

### C1. PaymentProvider interface is dead code

**Files:** `src/modules/billing/providers/types.ts:1-19`

Interface defined during planning but **never implemented** by Stripe or Cryptomus services. Neither service imports it. No factory uses it.

**Impact:** Adding a third provider (Coinbase, Razorpay) requires copy-pasting Stripe or Cryptomus logic.

**Fix options:**

- (A) Implement it in both services + add a `PaymentProviderRegistry` that `app.ts` uses to register routes dynamically.
- (B) Delete the file.

🤔 Recommend (A) — Alex preference is robust/future-proof solutions (per memory).

---

### C2. Stripe and Cryptomus services duplicate deposit-confirmation logic

**Files:**

- `src/modules/billing/stripe/stripe.service.ts:118-168` (`handleCheckoutCompleted`)
- `src/modules/billing/cryptomus/cryptomus.service.ts:197-238` (`confirmDeposit`)

Near-identical blocks: wallet fetch → balance calculation → ledger entry → status update. ~40 LOC duplicated verbatim.

**Fix:** Extract `confirmDepositTransaction(depositId, tx)` to `billing-internal.service.ts`. Both providers call it after signature verification.

---

### C3. Deposit-confirmation race condition (potential double credit)

**Files:**

- `src/modules/billing/stripe/stripe.service.ts:94-123`
- `src/modules/billing/cryptomus/cryptomus.service.ts:148-228`

Check `status === 'PENDING'` and `updateBalance()` are NOT inside a DB transaction. Two simultaneous webhook retries could both pass the status check and double-credit the wallet.

**Attack/incident scenario:** Stripe/Cryptomus both retry webhooks on non-200 responses. A slow first handler + retry → both see PENDING → both credit balance.

**Fix:** Wrap in `prisma.$transaction()` and re-fetch deposit with `SELECT ... FOR UPDATE` (Prisma: re-fetch inside transaction, rely on serializable isolation, or use advisory lock on deposit.id).

```ts
await prisma.$transaction(async (tx) => {
  const fresh = await tx.deposit.findUnique({ where: { id: depositId } });
  if (fresh?.status !== 'PENDING') return;
  // ... credit + mark CONFIRMED
});
```

---

## 🟠 HIGH

### H1. CORS default is `*`

**File:** `src/app.ts:36-38`

```ts
await app.register(cors, {
  origin: process.env['CORS_ORIGIN'] ?? '*',
});
```

**Attack:** If `CORS_ORIGIN` is unset in prod, any origin can make credentialed requests.

**Fix:**

- Remove `?? '*'` fallback.
- Add Zod validation: `CORS_ORIGIN: z.string().min(1)` in `env.ts`.
- Parse comma-separated list into array for `cors` plugin.

---

### H2. Provider encryption key derivation weak

**File:** `src/modules/providers/utils/encryption.ts:10-13`

```ts
function deriveKey(): Buffer {
  const key = getConfig().provider.encryptionKey;
  return Buffer.from(key.slice(0, 32).padEnd(32, '0'));
}
```

Short keys silently padded with zeros → predictable. No KDF.

**Fix:**

```ts
import { scryptSync } from 'node:crypto';
function deriveKey(): Buffer {
  return scryptSync(getConfig().provider.encryptionKey, 'provider-enc', 32);
}
```

Also enforce `PROVIDER_ENCRYPTION_KEY: z.string().min(32)` in env validation.

---

## 🟡 MAJOR

### M1. Queue/worker patterns duplicated, shared queue unused

**Files:**

- `src/shared/queue/queue.ts` (defined, never imported)
- `src/modules/billing/workers/deposit-expiry.worker.ts`
- `src/modules/notifications/notification-dispatcher.ts`
- `src/modules/webhooks/webhook-dispatcher.ts`
- `src/modules/orders/workers/*.worker.ts`

Each module creates its own `Queue` + `Worker` singleton with identical boilerplate: `getRedis().duplicate()`, `queue ??= new Queue(...)`, `worker.on('failed', ...)`.

**Fix:** Route all queue creation through `shared/queue/queue.ts` factory. Register workers in `src/index.ts`.

---

### M2. Inconsistent worker error handling

**Files:**

- `src/modules/billing/workers/deposit-expiry.worker.ts:32-36` — silent catch, no re-throw → BullMQ doesn't retry
- `src/modules/notifications/notification-dispatcher.ts:68-72` — re-throws → BullMQ retries

No documented policy. Workers that should retry don't; workers that shouldn't do.

**Fix:** Document policy in `shared/queue/`. Standardize: idempotent workers log-and-return; retryable workers re-throw.

---

### M3. Services bypass repository layer

**Files:**

- `src/modules/billing/billing-internal.service.ts` (direct `getPrisma()` calls for transactions)
- `src/modules/auth/token-store.ts`
- `src/modules/auth/auth-email.service.ts:16-51`
- `src/modules/admin/admin-dashboard.service.ts:7-23`
- `src/modules/referrals/referrals.service.ts`

Most modules use repository pattern; these don't. Mixes data access with business logic.

**Fix:** Move direct Prisma calls to `*.repository.ts`. Services call repos, not `getPrisma()`.

---

### M4. Hardcoded deposit min/max duplicated

**Files:**

- `src/modules/billing/stripe/stripe.service.ts:39-43` (5 / 10_000)
- `src/modules/billing/cryptomus/cryptomus.service.ts:62-66` (same)
- Frontend `deposit/page.tsx` (same)

Same values in 3+ places.

**Fix:** Move to `config.billing.minDeposit` / `config.billing.maxDeposit`. Export for frontend via API `GET /billing/config` (or keep hardcoded on frontend + validate on backend only).

---

### M5. Session expiry hardcoded in two providers

**Files:**

- `src/modules/billing/stripe/stripe.service.ts:54` — `new Date(Date.now() + 60 * 60 * 1000)`
- `src/modules/billing/cryptomus/cryptomus.service.ts` — same 1h literal

**Fix:** `config.billing.depositExpiryMs`.

---

### M6. JWT secret minimum 16 chars (should be 32)

**File:** `src/shared/config/env.ts:33-34`

```ts
JWT_SECRET: z.string().min(16),
JWT_REFRESH_SECRET: z.string().min(16),
```

HS256 recommends 256 bits (32 bytes).

**Fix:** `.min(32)`.

---

### M7. bcrypt rounds default 10 (should be 12)

**File:** `src/shared/config/env.ts:49-51`

Financial system → bump to 12 per OWASP 2024.

---

### M8. Cross-module imports bypass public API

**Files:**

- `src/modules/orders/orders.helpers.ts:1-7` — imports `releaseFunds`, `chargeFunds` directly from billing internals
- `src/modules/admin/admin-users.service.ts:3-4` — imports auth's `user.repository` directly
- `src/modules/orders/utils/fund-settlement.ts:1` — imports billing internals

Modules reach into each other's internals rather than going through `index.ts`.

**Fix:** Each module's `index.ts` is the only entry. Re-export needed functions explicitly. Consider domain events (e.g., `order:created`) for cross-cutting concerns (webhooks, notifications).

---

### M9. Fire-and-forget `.catch(() => {})` scattered

**Files (14+ sites):**

- `src/modules/auth/auth.service.ts:49`
- `src/modules/orders/orders.helpers.ts:84-95, 109-111, 122-124, 138-140, 151-153`
- `src/modules/orders/workers/status-poll.worker.ts:109, 122`
- `src/modules/orders/workers/order-timeout.worker.ts:85, 96`

No consistent logging — some just swallow, some log. Errors in email/webhook delivery disappear silently.

**Fix:** Helper `fireAndForget(promise, { context, logger })` that always logs errors at `warn` level.

---

### M10. Status strings duplicated, no enum

**Sites:** `'PENDING'`, `'CONFIRMED'`, `'PAID'`, `'EXPIRED'`, `'FAILED'`, `'CANCELLED'`, `'PARTIAL'`, `'REFUNDED'` referenced as string literals across ~30 files.

Typos pass TypeScript. No IDE autocomplete.

**Fix:** TypeScript `const` enums or branded types in `shared/types/statuses.ts`. Prisma already generates enum types — import those.

---

### M11. Duplicate validation helpers

**File:** `src/modules/support/support.routes.ts:15-52`

`validateBody`, `validateQuery`, `validateParams` — 40 LOC. Pattern exists elsewhere (`src/modules/billing/billing.routes.ts` previously had it, removed in Cryptomus refactor).

**Fix:** Move to `src/shared/middleware/validation.ts` + reuse.

---

### M12. No webhook-replay timestamp check (Cryptomus)

**File:** `src/modules/billing/cryptomus/cryptomus.service.ts:148-174`

Webhook idempotency via `order_id` + `status === PENDING` — but a captured webhook replayed days later while deposit is still PENDING would still credit. Unlikely (deposits auto-expire), but defense-in-depth.

**Fix:** If Cryptomus provides `created_at` in payload, reject webhooks older than ~1h. Stripe's SDK handles timestamp tolerance already.

---

### M13. Direct `process.env` reads bypass Zod validation

**Files:**

- `src/app.ts:38, 44-45`
- `src/modules/auth/auth-email.service.ts:12-14`
- `src/modules/notifications/utils/email-provider-factory.ts:27-32`

`APP_URL`, `CORS_ORIGIN`, etc. read directly. Missing value → runtime error instead of startup fail-fast.

**Fix:** All env reads via `getConfig()`.

---

### M14. Provider-specific columns on Deposit model

**File:** `src/modules/billing/deposit.repository.ts:98-122`

`stripeSessionId`, `cryptomusOrderId`, `cryptomusCheckoutUrl` as separate nullable columns. Adding provider 3 → another pair of columns.

**Fix:** Polymorphic `external_provider` enum + `external_id` + `external_url` columns (single unique index on `(external_provider, external_id)`). Migration risk — defer until 3rd provider planned.

---

## 🟡 SONARQUBE FINDINGS (18 code smells + 3 frontend bugs)

### Backend (1 issue)

- **MAJOR** `src/index.ts:62` (`S7785`) — prefer top-level await over promise chain
- **MINOR** `src/modules/providers/utils/smm-api-client.ts:116` (`S6551`) — value with default stringification `[object Object]` in a string interpolation

### Frontend bugs (3)

- **MAJOR** `frontend/src/app/globals.css:5` — unknown `@custom-variant` at-rule (Tailwind v4 syntax; Sonar doesn't recognize it — false positive)
- **MAJOR** `frontend/src/components/ui/table.tsx:10` — `<table>` missing header row (shadcn base; accessibility valid concern)
- **MAJOR** `frontend/src/app/(admin)/admin/providers/page.tsx:292` — promise-returning fn in void-expected prop (missing `void` wrap)

### Frontend code smells (15)

- 6× `S6478` — `frontend/src/app/(admin)/admin/deposits/page.tsx:86-106` — nested component definitions in parent (re-creates on every render)
- 4× `S6759` — missing `readonly` on React props
- 2× `S4624` — nested template literals in bulk/new order pages
- 2× `S3863` — duplicate imports in orders page
- 1× `S3358` — nested ternary in service-form
- 1× `S4325` — unnecessary type assertion

🔒 All SonarQube findings: http://localhost:9100/dashboard?id=youboost-smm

---

## 🟢 WHAT'S WORKING WELL

- ✅ **No `any` types** in backend (generated Prisma files excluded)
- ✅ **No SQL/command injection** — all queries parameterized through Prisma, no `$queryRawUnsafe`
- ✅ **No `console.log`** — all logging via Pino with PII redaction (`password`, `token`, `authorization`, etc.)
- ✅ **Webhook signature verification correct** for both Stripe and Cryptomus
- ✅ **AES-256-GCM** for API key encryption — random IV per ciphertext, auth tag verified
- ✅ **API keys hashed** (SHA-256) before storage — raw key shown once
- ✅ **JWT refresh rotation** — old token revoked before new issued (no session fixation)
- ✅ **Rate limiting** — auth endpoints + per-API-key tiered (BASIC/PRO/ENTERPRISE)
- ✅ **Hold/release atomicity** — wallet updates + ledger entries in same transaction
- ✅ **Error handling structured** — `AppError` hierarchy with codes + HTTP status, no stack traces leaked to client
- ✅ **Admin auth guards** — `requireAdmin()` on every admin route
- ✅ **Test colocation** — consistent `__tests__/` directories, 220 backend files scanned, ESLint clean
- ✅ **Config validation** — Zod schema, frozen at startup, fail-fast
- ✅ **No circular dependencies** detected
- ✅ **Prisma transactions** implemented correctly with `tx` parameter passing

---

## 📋 RECOMMENDATIONS — PRIORITY ORDER

### Must fix (ship-blocker / financial integrity)

1. **C3** — deposit-confirmation race condition → wrap in transaction
2. **H1** — CORS default `*` → enforce explicit origins
3. **H2** — encryption key KDF via scrypt

### Should fix (next sprint)

4. **C1/C2** — implement `PaymentProvider` interface + extract common deposit-confirm logic
5. **M6/M7** — JWT min 32 / bcrypt rounds 12
6. **M1** — consolidate queue/worker patterns via shared factory
7. **M4/M5** — move deposit limits + expiry to config
8. **M3** — move direct Prisma out of services to repositories

### Nice to have (tech debt)

9. **M8** — module boundary enforcement via index.ts exports
10. **M9** — `fireAndForget()` helper
11. **M10** — status enums/branded types
12. **M11** — shared validation middleware
13. **M13** — all env reads via `getConfig()`
14. Raise test coverage from 54% → 80% (target per CLAUDE.md)
15. Frontend: fix SonarQube S6478 (6 nested components in admin deposits page)

### Architectural / long-term

16. **M14** — polymorphic Deposit provider reference (when 3rd provider planned)
17. API versioning (`/v1/` prefix)
18. Consider dependency injection framework if testability becomes painful

---

## 🔗 Source reports

Full per-agent reports available on request (conversation transcript). This file consolidates:

- Architecture agent (module boundaries, layering, coupling)
- Code-smell agent (type safety, complexity, duplication)
- Security agent (OWASP review, auth, crypto, financial integrity)
- SonarQube scan (21 issues, metrics)

**Review date:** 2026-05-05  
**Reviewer:** Archie (Claude) + 3 subagents + SonarQube  
**Project:** `youboost-smm` at `d019ab1`
