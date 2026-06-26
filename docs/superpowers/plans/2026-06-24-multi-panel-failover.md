# Multi-Panel Auto-Failover Implementation Plan (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a paid order's panel can't fulfil it, silently try the next panel; only when every panel fails does the order end FAILED (admin-only) — the customer always sees "In progress", their price never changes, and every attempt is tracked.

**Architecture:** A service maps to an ordered list of panels (`service_provider_mappings`). Order submission walks that list (`submitWithFailover`), recording each attempt (`provider_order_attempts`) and emitting `order.provider_failed` per panel failure and `order.fulfilment_exhausted` when all fail. Admin is notified via an optional email handler. The interim guest auto-refund + "order failed" customer email (commits b0eaee8 / 21b9995) are removed — refund becomes an admin decision.

**Tech Stack:** Node 22 + TypeScript (strict), Fastify, Prisma 7 (Postgres), BullMQ/outbox, Jest. Spec: `docs/superpowers/specs/2026-06-24-order-fulfilment-failover-design.md`.

## Global Constraints

- Run all tooling under `export PATH=/opt/nodejs/bin:$PATH` and `NODE_OPTIONS=--experimental-require-module`. Commit with `--no-verify` (husky too slow). Backend tests/lint: `npx tsc --noEmit`, `npx eslint src --quiet`, `npx jest` from repo root. **Run eslint AND tsc locally before every push** (the pipeline gates on both; test files are type-checked by jest but NOT by `tsc --noEmit`).
- ESLint backend: `max-lines: 300`, `complexity: 10` — keep new files focused; do not edit the eslint config.
- Banned: `any`, `console.log` (use Pino), hardcoded secrets. Financial system: validate inputs, parameterized queries only (Prisma).
- Prod + dev SHARE `youboost_dev`. Mutating integration tests run ONLY against `youboost_test` via `TEST_DATABASE_URL`; the harness HARD-REFUSES `youboost_dev`. Migrations to prod happen automatically in `scripts/deploy.sh` (build + run the `migrate` service) — never run `prisma migrate deploy` against `youboost_dev` by hand.
- Customer price is the tier/service price the customer paid — it NEVER changes based on which panel fulfils or that panel's cost.
- Regenerate the Prisma client after schema changes: `npx prisma generate` (no TLS override needed; engines are local).

---

### Task 1: Schema — `service_provider_mappings` + `provider_order_attempts`

**Files:**
- Modify: `prisma/schema.prisma` (add two models + back-relations on `Service` and `Provider`)
- Create: `prisma/migrations/20260625000000_add_failover_tables/migration.sql`
- Test: applied against `youboost_test`

**Interfaces:**
- Produces tables `service_provider_mappings(id, service_id, provider_id, external_service_id, priority, provider_cost, is_active, created_at)` and `provider_order_attempts(id, order_id, provider_id, external_service_id, outcome, error, provider_cost, created_at)`.

- [ ] **Step 1: Add Prisma models** in `prisma/schema.prisma`:

```prisma
model ServiceProviderMapping {
  id                String   @id @default(uuid()) @db.Uuid
  serviceId         String   @map("service_id") @db.Uuid
  providerId        String   @map("provider_id") @db.Uuid
  externalServiceId String   @map("external_service_id") @db.VarChar(255)
  priority          Int      @default(0)
  providerCost      Decimal  @default(0) @map("provider_cost") @db.Decimal(12, 4)
  isActive          Boolean  @default(true) @map("is_active")
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  service  Service  @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  provider Provider @relation(fields: [providerId], references: [id])

  @@unique([serviceId, providerId])
  @@index([serviceId, priority])
  @@map("service_provider_mappings")
}

model ProviderOrderAttempt {
  id                String   @id @default(uuid()) @db.Uuid
  orderId           String   @map("order_id") @db.Uuid
  providerId        String   @map("provider_id") @db.Uuid
  externalServiceId String   @map("external_service_id") @db.VarChar(255)
  outcome           String   @db.VarChar(16) // 'SUCCESS' | 'FAILED'
  error             String?  @db.Text
  providerCost      Decimal  @default(0) @map("provider_cost") @db.Decimal(12, 4)
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  order    Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  provider Provider @relation(fields: [providerId], references: [id])

  @@index([orderId])
  @@index([providerId, outcome])
  @@map("provider_order_attempts")
}
```

  Add back-relations: on `model Service` add `providerMappings ServiceProviderMapping[]`; on `model Provider` add `serviceMappings ServiceProviderMapping[]` and `orderAttempts ProviderOrderAttempt[]`; on `model Order` add `attempts ProviderOrderAttempt[]`.

- [ ] **Step 2: Write the migration SQL** `prisma/migrations/20260625000000_add_failover_tables/migration.sql`:

```sql
CREATE TABLE "service_provider_mappings" (
  "id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "provider_id" UUID NOT NULL,
  "external_service_id" VARCHAR(255) NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "provider_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_provider_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "service_provider_mappings_service_id_provider_id_key" ON "service_provider_mappings"("service_id","provider_id");
CREATE INDEX "service_provider_mappings_service_id_priority_idx" ON "service_provider_mappings"("service_id","priority");
ALTER TABLE "service_provider_mappings" ADD CONSTRAINT "service_provider_mappings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_provider_mappings" ADD CONSTRAINT "service_provider_mappings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "provider_order_attempts" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "provider_id" UUID NOT NULL,
  "external_service_id" VARCHAR(255) NOT NULL,
  "outcome" VARCHAR(16) NOT NULL,
  "error" TEXT,
  "provider_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_order_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "provider_order_attempts_order_id_idx" ON "provider_order_attempts"("order_id");
CREATE INDEX "provider_order_attempts_provider_id_outcome_idx" ON "provider_order_attempts"("provider_id","outcome");
ALTER TABLE "provider_order_attempts" ADD CONSTRAINT "provider_order_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_order_attempts" ADD CONSTRAINT "provider_order_attempts_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed one mapping per service from the existing 1:1 link (priority 0).
INSERT INTO "service_provider_mappings" ("id","service_id","provider_id","external_service_id","priority","is_active")
SELECT gen_random_uuid(), s."id", s."provider_id", s."external_service_id", 0, true
FROM "services" s
WHERE s."provider_id" IS NOT NULL AND s."external_service_id" IS NOT NULL;
```

- [ ] **Step 3: Apply to the isolated test DB and regenerate the client**

Run:
```
export PATH=/opt/nodejs/bin:$PATH NODE_OPTIONS=--experimental-require-module
DATABASE_URL='postgresql://youboost:youboost_dev_password@localhost:5432/youboost_test' npx prisma migrate deploy
npx prisma generate
npx tsc --noEmit
```
Expected: "following migration(s) have been applied: 20260625000000_add_failover_tables"; generate succeeds; tsc clean. (Do NOT apply to `youboost_dev` by hand — prod gets it via the pipeline.)

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260625000000_add_failover_tables
git commit --no-verify -m "feat(db): service_provider_mappings + provider_order_attempts for failover"
```

---

### Task 2: Repositories for mappings + attempts

**Files:**
- Create: `src/modules/providers/service-provider-mapping.repository.ts`
- Create: `src/modules/providers/provider-order-attempt.repository.ts`
- Test: `src/modules/providers/__tests__/service-provider-mapping.repository.integration.test.ts`

**Interfaces:**
- Produces:
  - `createServiceProviderMappingRepository(prisma): { listActiveByServiceId(serviceId: string): Promise<PanelCandidate[]> }`
    where `PanelCandidate = { providerId: string; externalServiceId: string; priority: number; providerCost: number }`, ordered by `priority` asc.
  - `createProviderOrderAttemptRepository(prisma): { record(input: { orderId: string; providerId: string; externalServiceId: string; outcome: 'SUCCESS' | 'FAILED'; error?: string | null; providerCost?: number }, tx?): Promise<void> }`

- [ ] **Step 1: Write the failing integration test** (gated on `TEST_DATABASE_URL`, refuses `youboost_dev`; copy the guard from `src/modules/billing/__tests__/settlement.integration.test.ts` lines 37–43). Seed a service with two providers' mappings (priority 0 and 1), assert `listActiveByServiceId` returns them in priority order and `record` writes an attempt row. Use a unique marker prefix for self-cleanup in `afterAll`.

```ts
// key assertions
const candidates = await mappingRepo.listActiveByServiceId(serviceId);
expect(candidates.map((c) => c.priority)).toEqual([0, 1]);
expect(candidates[0]!.externalServiceId).toBe('ext-A');
await attemptRepo.record({ orderId, providerId: candidates[0]!.providerId, externalServiceId: 'ext-A', outcome: 'FAILED', error: 'no funds' });
const rows = await prisma.providerOrderAttempt.findMany({ where: { orderId } });
expect(rows).toHaveLength(1);
expect(rows[0]!.outcome).toBe('FAILED');
```

- [ ] **Step 2: Run it, expect FAIL** (`Cannot find module '../service-provider-mapping.repository'`).
Run: `TEST_DATABASE_URL='postgresql://youboost:youboost_dev_password@localhost:5432/youboost_test' npx jest service-provider-mapping.repository.integration`

- [ ] **Step 3: Implement both repositories.**

```ts
// service-provider-mapping.repository.ts
import type { PrismaClient } from '../../generated/prisma';

export interface PanelCandidate {
  providerId: string;
  externalServiceId: string;
  priority: number;
  providerCost: number;
}
export interface ServiceProviderMappingRepository {
  listActiveByServiceId(serviceId: string): Promise<PanelCandidate[]>;
}
export function createServiceProviderMappingRepository(
  prisma: PrismaClient,
): ServiceProviderMappingRepository {
  return {
    async listActiveByServiceId(serviceId): Promise<PanelCandidate[]> {
      const rows = await prisma.serviceProviderMapping.findMany({
        where: { serviceId, isActive: true },
        orderBy: [{ priority: 'asc' }, { providerCost: 'asc' }],
      });
      return rows.map((r) => ({
        providerId: r.providerId,
        externalServiceId: r.externalServiceId,
        priority: r.priority,
        providerCost: Number(r.providerCost),
      }));
    },
  };
}
```

```ts
// provider-order-attempt.repository.ts
import type { Prisma, PrismaClient } from '../../generated/prisma';

export interface RecordAttemptInput {
  orderId: string;
  providerId: string;
  externalServiceId: string;
  outcome: 'SUCCESS' | 'FAILED';
  error?: string | null;
  providerCost?: number;
}
export interface ProviderOrderAttemptRepository {
  record(input: RecordAttemptInput, tx?: Prisma.TransactionClient): Promise<void>;
}
export function createProviderOrderAttemptRepository(
  prisma: PrismaClient,
): ProviderOrderAttemptRepository {
  return {
    async record(input, tx): Promise<void> {
      const client = tx ?? prisma;
      await client.providerOrderAttempt.create({
        data: {
          orderId: input.orderId,
          providerId: input.providerId,
          externalServiceId: input.externalServiceId,
          outcome: input.outcome,
          error: input.error ?? null,
          providerCost: input.providerCost ?? 0,
        },
      });
    },
  };
}
```

- [ ] **Step 4: Run the test, expect PASS.**
- [ ] **Step 5: Commit** (`feat(providers): mapping + attempt repositories`).

---

### Task 3: Outbox events `order.provider_failed` + `order.fulfilment_exhausted`

**Files:**
- Modify: `src/shared/outbox/events.ts`
- Test: `src/shared/outbox/__tests__/events.test.ts` (if present; otherwise covered by handler tests in Task 6)

**Interfaces:**
- Produces two new variants on the `OutboxEvent` union:
  - `order.provider_failed` payload `{ orderId: string; userId: string; providerId: string; error: string }`
  - `order.fulfilment_exhausted` payload `{ orderId: string; userId: string; attempts: number }`

- [ ] **Step 1: Add the variants** to the union in `src/shared/outbox/events.ts` (after the existing `order.*` entries):

```ts
  | {
      type: 'order.provider_failed';
      aggregateType: 'order';
      aggregateId: string;
      userId: string;
      payload: { orderId: string; userId: string; providerId: string; error: string };
    }
  | {
      type: 'order.fulfilment_exhausted';
      aggregateType: 'order';
      aggregateId: string;
      userId: string;
      payload: { orderId: string; userId: string; attempts: number };
    }
```

- [ ] **Step 2: Typecheck** `npx tsc --noEmit` — expect clean (the union is consumed by `OutboxEventType`).
- [ ] **Step 3: Commit** (`feat(outbox): provider-failed + fulfilment-exhausted events`).

---

### Task 4: Failover engine — `submitWithFailover`

**Files:**
- Create: `src/modules/orders/submit-with-failover.ts`
- Test: `src/modules/orders/__tests__/submit-with-failover.test.ts`

**Interfaces:**
- Consumes: `ProviderSelectorPort.selectProviderById` (from `./ports/provider-selector.port`), `ServiceProviderMappingRepository.listActiveByServiceId` (Task 2), `ProviderOrderAttemptRepository.record` (Task 2), `OutboxPort.emit`.
- Produces:
  `submitWithFailover(deps, args): Promise<{ ok: true; providerId: string; externalOrderId: string } | { ok: false; attempts: number }>`
  where `deps = { providerSelector, mappingRepo, attemptRepo, outbox, logger }` and
  `args = { orderId: string; userId: string; serviceId: string; link: string; quantity: number }`.
  On each panel failure it records a FAILED attempt and emits `order.provider_failed`; on success records SUCCESS; when all candidates fail it emits `order.fulfilment_exhausted` and returns `{ ok: false }`. **Never throws** for provider failures (only programmer errors propagate).

- [ ] **Step 1: Write the failing test** with a fake mapping repo (two candidates), a provider selector whose client `submitOrder` fails for the first providerId and succeeds for the second, and a fake outbox/attempt recorder:

```ts
it('routes to the second panel when the first fails; records attempts; no exhausted event', async () => {
  const res = await submitWithFailover(deps, args);
  expect(res).toEqual({ ok: true, providerId: 'prov-2', externalOrderId: 'ext-ok' });
  expect(attempts).toEqual([
    { providerId: 'prov-1', outcome: 'FAILED' },
    { providerId: 'prov-2', outcome: 'SUCCESS' },
  ]);
  expect(emitted.map((e) => e.type)).toEqual(['order.provider_failed']); // one failure, no exhausted
});

it('returns ok:false and emits fulfilment_exhausted when every panel fails', async () => {
  const res = await submitWithFailover(depsAllFail, args);
  expect(res).toEqual({ ok: false, attempts: 2 });
  expect(emitted.filter((e) => e.type === 'order.provider_failed')).toHaveLength(2);
  expect(emitted.filter((e) => e.type === 'order.fulfilment_exhausted')).toHaveLength(1);
});

it('returns ok:false with attempts:0 when the service has no active panels', async () => {
  const res = await submitWithFailover(depsNoCandidates, args);
  expect(res).toEqual({ ok: false, attempts: 0 });
  expect(emitted.filter((e) => e.type === 'order.fulfilment_exhausted')).toHaveLength(1);
});
```

- [ ] **Step 2: Run it, expect FAIL** (module not found).

- [ ] **Step 3: Implement** `submit-with-failover.ts`:

```ts
import type { Logger } from 'pino';
import type { OutboxPort } from '../../shared/outbox';
import type { ProviderSelectorPort } from './ports/provider-selector.port';
import type { ServiceProviderMappingRepository } from '../providers/service-provider-mapping.repository';
import type { ProviderOrderAttemptRepository } from '../providers/provider-order-attempt.repository';

export interface FailoverDeps {
  providerSelector: ProviderSelectorPort;
  mappingRepo: ServiceProviderMappingRepository;
  attemptRepo: ProviderOrderAttemptRepository;
  outbox: OutboxPort;
  logger: Logger;
}
export interface FailoverArgs {
  orderId: string;
  userId: string;
  serviceId: string;
  link: string;
  quantity: number;
}
export type FailoverResult =
  | { ok: true; providerId: string; externalOrderId: string }
  | { ok: false; attempts: number };

export async function submitWithFailover(
  deps: FailoverDeps,
  args: FailoverArgs,
): Promise<FailoverResult> {
  const { providerSelector, mappingRepo, attemptRepo, outbox, logger } = deps;
  const candidates = await mappingRepo.listActiveByServiceId(args.serviceId);
  let attempts = 0;

  for (const candidate of candidates) {
    attempts += 1;
    try {
      const { providerId, client } = await providerSelector.selectProviderById(candidate.providerId);
      const result = await client.submitOrder({
        serviceId: candidate.externalServiceId,
        link: args.link,
        quantity: args.quantity,
      });
      await attemptRepo.record({
        orderId: args.orderId,
        providerId: candidate.providerId,
        externalServiceId: candidate.externalServiceId,
        outcome: 'SUCCESS',
        providerCost: candidate.providerCost,
      });
      return { ok: true, providerId: providerId ?? candidate.providerId, externalOrderId: result.externalOrderId };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'provider error';
      logger.warn({ orderId: args.orderId, providerId: candidate.providerId, error }, 'panel failed — trying next');
      await attemptRepo.record({
        orderId: args.orderId,
        providerId: candidate.providerId,
        externalServiceId: candidate.externalServiceId,
        outcome: 'FAILED',
        error,
        providerCost: candidate.providerCost,
      });
      await outbox.emit({
        type: 'order.provider_failed',
        aggregateType: 'order',
        aggregateId: args.orderId,
        userId: args.userId,
        payload: { orderId: args.orderId, userId: args.userId, providerId: candidate.providerId, error },
      });
    }
  }

  await outbox.emit({
    type: 'order.fulfilment_exhausted',
    aggregateType: 'order',
    aggregateId: args.orderId,
    userId: args.userId,
    payload: { orderId: args.orderId, userId: args.userId, attempts },
  });
  return { ok: false, attempts };
}
```

  Note: `outbox.emit` is called without a tx here (each event is its own unit, like the existing settlement events). Attempts are append-only and idempotency is held by the per-order claim in the caller (Task 5).

- [ ] **Step 4: Run the test, expect PASS.**
- [ ] **Step 5: Commit** (`feat(orders): submitWithFailover engine`).

---

### Task 5: Wire guest settlement to failover + remove the interim auto-refund/email

**Files:**
- Modify: `src/modules/orders/confirm-order-payment.flow.ts`
- Modify: `src/modules/orders/orders.service.ts` (deps wiring)
- Modify: `src/app.ts` (construct + inject the new repos)
- Modify: `src/modules/orders/__tests__/confirm-order-payment.flow.test.ts`
- Modify: `src/modules/notifications/handlers/order-email.handler.ts` (drop the customer order.failed email) and `src/modules/notifications/utils/email-templates.ts` (remove `orderFailedEmail` or keep only for admin — see Task 6)

**Interfaces:**
- Consumes: `submitWithFailover` (Task 4), `ServiceProviderMappingRepository`, `ProviderOrderAttemptRepository`.
- Produces: `submitGuestOrder` now returns `true` on success, `false` on exhaustion; on exhaustion the order is set to `FAILED` (admin-visible) with NO wallet refund and NO customer email.

- [ ] **Step 1: Update the flow test** — replace the morning's "refunds the customer to wallet and fails the order" test with failover behaviour. The flow no longer calls `refundToWallet` on provider failure; instead it relies on `submitWithFailover`. New tests:

```ts
it('settles via failover: order PROCESSING when some panel accepts', async () => {
  // mapping repo returns 2 candidates; first fails, second succeeds
  await confirmOrderPayment(deps, 'pay1');
  const o = await deps.ordersRepo.findOrderById('o1', 'u1');
  expect(o?.status).toBe('PROCESSING');
  expect(deps.refundToWallet).not.toHaveBeenCalled();
});

it('all panels fail → order FAILED, NO refund, NO customer email, exhausted event emitted', async () => {
  await confirmOrderPayment(depsAllFail, 'pay1');
  const o = await depsAllFail.ordersRepo.findOrderById('o1', 'u1');
  expect(o?.status).toBe('FAILED');
  expect(depsAllFail.refundToWallet).not.toHaveBeenCalled();
  expect(depsAllFail.outboxEvents.map((e) => e.event.type)).toContain('order.fulfilment_exhausted');
  expect(depsAllFail.outboxEvents.map((e) => e.event.type)).not.toContain('order.failed');
});
```

  Update `makeDeps` to supply a fake `mappingRepo` + `attemptRepo` and a provider client per the scenario; remove the `refundToWallet`-on-failure assertions. Keep `refundToWallet` in the deps type for now but unused by the failure path (Step 3 removes the call).

- [ ] **Step 2: Run, expect FAIL** (current code refunds + sets FAILED directly without failover).

- [ ] **Step 3: Rewrite `submitGuestOrder`** in `confirm-order-payment.flow.ts` to claim then delegate to `submitWithFailover`:

```ts
const claimed = await ordersRepo.claimOrderForSubmission(order.id);
if (!claimed) { logger.info({ orderId: order.id, userId }, 'already claimed — skipping'); return false; }

const outcome = await submitWithFailover(
  { providerSelector, mappingRepo, attemptRepo, outbox, logger },
  { orderId: order.id, userId, serviceId: order.serviceId, link: order.link, quantity: order.quantity },
);

if (outcome.ok) {
  await prisma.$transaction(async (tx) => {
    await ordersRepo.updateOrderStatus(order.id, {
      status: 'PROCESSING', externalOrderId: outcome.externalOrderId, providerId: outcome.providerId, remains: order.quantity,
    });
    await outbox.emit({ type: 'order.created', aggregateType: 'order', aggregateId: order.id, userId,
      payload: { orderId: order.id, userId, status: 'PROCESSING', price: Number(order.price ?? 0) } }, tx);
  });
  logger.info({ orderId: order.id, userId, externalOrderId: outcome.externalOrderId }, 'Order confirmed + submitted');
  return true;
}

// All panels failed: admin's problem. Order stays FAILED (customer sees "In progress").
// No auto-refund, no customer email — admin decides (retry/refund) from the exhausted alert.
await ordersRepo.updateOrderStatus(order.id, { status: 'FAILED', completedAt: new Date() });
logger.error({ orderId: order.id, userId, attempts: outcome.attempts }, 'Order fulfilment exhausted — admin alerted');
return false;
```

  Remove the `refundToWallet` import/dep usage from the failure path and the `order.failed` emit. Remove `refundToWallet` from `ConfirmOrderPaymentDeps` and `OrdersServiceDeps.billing.refundFunds` wiring **only if** nothing else uses it (the logged-in path Task 7 still refunds on exhaustion — keep `refundFunds` available). Add `mappingRepo` + `attemptRepo` to `ConfirmOrderPaymentDeps`.

- [ ] **Step 4: Drop the customer order.failed email** in `order-email.handler.ts` — `createOrderFailedEmailHandler` should no longer email the customer for guest exhaustion. Either remove the handler from `buildOutboxHandlers` for customer delivery, or keep it ONLY for the timeout/legacy case. Simplest: delete `createOrderFailedEmailHandler` usage from `src/composition/outbox-handlers.ts` and remove `orderFailedEmail` from templates (it was added this morning in commit 21b9995). Admin alerting is Task 6.

- [ ] **Step 5: Wire repos in `app.ts`** — construct `createServiceProviderMappingRepository(prisma)` and `createProviderOrderAttemptRepository(prisma)` and pass into `createOrdersService` (and through to the confirm flow deps).

- [ ] **Step 6: Run** `npx tsc --noEmit && npx eslint src --quiet && npx jest src/modules/orders` — expect green.
- [ ] **Step 7: Commit** (`feat(orders): guest settlement uses failover; drop interim auto-refund+email`).

---

### Task 6: Admin notification on failover + exhaustion

**Files:**
- Modify: `src/shared/config/env.ts`, `src/shared/config/env.types.ts` (add `ADMIN_ALERT_EMAIL`)
- Create: `src/modules/notifications/handlers/admin-alert.handler.ts`
- Modify: `src/composition/outbox-handlers.ts` (register the handlers)
- Test: `src/modules/notifications/__tests__/admin-alert.handler.test.ts`

**Interfaces:**
- Consumes: `EmailProvider.send`, `order.provider_failed` + `order.fulfilment_exhausted` events.
- Produces: `createAdminProviderFailedHandler(deps)` and `createAdminFulfilmentExhaustedHandler(deps)` where `deps = { emailProvider; adminEmail: string | undefined; logger }`. No-op when `adminEmail` is unset (same pattern as Metrika/Stripe optional config).

- [ ] **Step 1: Add config** `ADMIN_ALERT_EMAIL: z.string().optional()` to the env schema + `AppConfig.alerts.adminEmail`.

- [ ] **Step 2: Write the failing test** — exhausted event with `adminEmail` set → `emailProvider.send` called with `to: admin@…` and a body naming the order; with `adminEmail` undefined → not called.

- [ ] **Step 3: Implement the handlers** (plain-text admin email; subject e.g. `[YouBoost] Order <id> needs attention — all panels failed`). Provider-failed handler may log/aggregate rather than email each attempt — for v1, email only on `fulfilment_exhausted`, and record `provider_failed` to the attempts table (already done in Task 4) + `logger.warn`. So: implement only `createAdminFulfilmentExhaustedHandler` emailing admin; `provider_failed` needs no handler (it's tracked).

- [ ] **Step 4: Register** the exhausted handler in `buildOutboxHandlers` (+ pass `adminEmail` from config in `app.ts`).
- [ ] **Step 5: Run** tests + tsc + eslint — green.
- [ ] **Step 6: Commit** (`feat(notifications): admin alert when order fulfilment is exhausted`).

---

### Task 7: Logged-in order path uses failover

**Files:**
- Modify: `src/modules/orders/create-order.flow.ts`
- Modify: `src/modules/orders/__tests__/orders.service.test.ts` (or the create-order flow test)

**Interfaces:**
- Consumes: `submitWithFailover` (Task 4).
- Produces: `executeCreateOrder` submits via failover; on exhaustion it refunds the wallet hold (this path holds funds in the user's wallet, so refund-on-exhaustion is correct here — distinct from the guest path) and marks the order FAILED.

- [ ] **Step 1: Update the create-order test** — first panel fails, second succeeds → order PROCESSING, funds NOT released; all fail → order FAILED + `releaseFunds` called once.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Replace `submitOrderToProvider`** in `create-order.flow.ts` with a `submitWithFailover` call; keep the existing `handleOrderCreationFailure` (release funds + FAILED) for the exhaustion case. Drip-feed quantity logic stays (compute `submitQuantity` before calling, pass as `quantity`).
- [ ] **Step 4: Run** tsc + eslint + `npx jest src/modules/orders` — green.
- [ ] **Step 5: Commit** (`feat(orders): logged-in order creation uses failover`).

---

### Task 8: Integration test — full failover on the real test DB

**Files:**
- Create: `src/modules/orders/__tests__/order-failover.integration.test.ts`

**Interfaces:**
- Consumes: real repos + `submitWithFailover` + a fake provider selector whose stub client fails for panel A and succeeds for panel B.

- [ ] **Step 1: Write the test** (gated on `TEST_DATABASE_URL`, refuses `youboost_dev`). Seed a service with two mappings (A priority 0, B priority 1); stub provider client fails on A's providerId, succeeds on B's. Call `submitWithFailover` with a real `attemptRepo`/`mappingRepo`. Assert: returns `{ ok: true, providerId: B }`; two attempt rows exist (A FAILED, B SUCCESS). Then an all-fail variant: returns `{ ok: false, attempts: 2 }`, both attempts FAILED. Self-clean by marker in `afterAll`.

- [ ] **Step 2: Run**
`TEST_DATABASE_URL='postgresql://youboost:youboost_dev_password@localhost:5432/youboost_test' npx jest order-failover.integration` — expect PASS.

- [ ] **Step 3: "Teeth" check** — temporarily make panel B also fail; assert the test now reports `ok:false`; restore. (Manual verification step, no commit.)

- [ ] **Step 4: Commit** (`test(orders): real-DB failover integration`).

---

### Task 9: Full verify + deploy

- [ ] **Step 1: Full local verify** (from repo root):
```
export PATH=/opt/nodejs/bin:$PATH NODE_OPTIONS=--experimental-require-module
npx tsc --noEmit && npx eslint src --quiet && npx jest
TEST_DATABASE_URL='postgresql://youboost:youboost_dev_password@localhost:5432/youboost_test' npx jest integration
cd frontend && npx tsc --noEmit && npx eslint src --quiet && npx jest && cd ..
```
Expected: all green.

- [ ] **Step 2: Commit any remaining wiring; push to main.** The pipeline (`scripts/deploy.sh`) builds + runs the `migrate` service → applies `20260625000000_add_failover_tables` to prod, then rebuilds backend/frontend. Watch: `gh run watch <id> --exit-status`.

- [ ] **Step 3: Post-deploy verification** — run a real Stripe test-card purchase against prod. With the Views service still mapped only to the broken fake panel, the order should: pay → failover walk → exhausted → order internal FAILED + admin alert (if `ADMIN_ALERT_EMAIL` set) + attempt rows recorded; customer cabinet shows "In progress"; NO customer "failed" email; NO auto wallet refund. Verify order status FAILED in DB, `provider_order_attempts` rows present, and `/orders` shows "In progress".

- [ ] **Step 4: Real fulfilment readiness (manual, separate)** — to actually fulfil: fund a real panel, add a `service_provider_mappings` row (admin/SQL) pointing the Views service at that panel's real `external_service_id` with priority 0, leaving the broken one at lower priority or inactive. Then a purchase routes to the funded panel → PROCESSING → status-poll → COMPLETED.

---

## Notes / decisions captured from brainstorming
- Failover order: `priority` asc, `providerCost` asc as tiebreaker.
- Admin alert v1: email on `fulfilment_exhausted` only (per-panel failures are tracked in `provider_order_attempts` + logged), gated by `ADMIN_ALERT_EMAIL`.
- The interim guest auto-refund + "order failed" customer email (commits b0eaee8, 21b9995) are removed; refund becomes an admin action for the exhausted case.
- Customer price never changes; `providerCost` is for our margin analytics only.
- An admin UI for mappings/attempts is out of scope for this plan (SQL/seed for now); flag as a follow-up.
