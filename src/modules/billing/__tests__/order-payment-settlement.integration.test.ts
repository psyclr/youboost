/**
 * Integration test for the REAL order-payment settlement chain (the guest-cart
 * money path), against an isolated Postgres test DB:
 *
 *   signed Cryptomus webhook (order-payment ref) → cryptomus route → service →
 *   confirmOrderPayment → orders submitted → Payment PAID + orders PROCESSING
 *
 * The only stub is the external SMM provider call (providerSelector → client),
 * per the agreed boundary — we never hit a real provider in tests. Everything
 * else (route, ref decode, Payment/Order repos, DB writes) is real, so the
 * webhook→settlement seam is exercised, not faked.
 *
 * Same safety gate as settlement.integration: TEST_DATABASE_URL, never youboost_dev.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma';
import { createWalletRepository } from '../wallet.repository';
import { createLedgerRepository } from '../ledger.repository';
import { createDepositRepository } from '../deposit.repository';
import { createPaymentRepository } from '../payment.repository';
import { createDepositLifecycleService } from '../deposit-lifecycle.service';
import { createCryptomusPaymentService } from '../cryptomus/cryptomus.service';
import { createCryptomusRoutes } from '../cryptomus/cryptomus.routes';
import { signRequestBody } from '../cryptomus/cryptomus.crypto';
import { encodeRef } from '../payment-reference';
import { createOrdersRepository } from '../../orders/orders.repository';
import { confirmOrderPayment } from '../../orders/confirm-order-payment.flow';
import { createServiceProviderMappingRepository } from '../../providers/service-provider-mapping.repository';
import { createProviderOrderAttemptRepository } from '../../providers/provider-order-attempt.repository';
import type { ProviderSelectorPort } from '../../orders/ports/provider-selector.port';
import type { ProviderClient } from '../../orders/utils/provider-client';
import type { OutboxEvent, OutboxPort } from '../../../shared/outbox';
import { silentLogger } from './fakes';

const DB_URL = process.env['TEST_DATABASE_URL'];
const DB_NAME = (DB_URL ?? '').split('/').pop()?.split('?')[0];
const SAFE = Boolean(DB_URL) && DB_NAME !== 'youboost_dev';
const describeDb = SAFE ? describe : describe.skip;

const PAYMENT_KEY = 'test-payment-key';

function signedWebhook(body: Record<string, unknown>): Record<string, unknown> {
  return { ...body, sign: signRequestBody(JSON.stringify(body), PAYMENT_KEY) };
}

describeDb('order-payment settlement (integration, real DB)', () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;
  let capturedEvents: OutboxEvent[];
  let submitCalls: number;
  const created = { userIds: [] as string[], serviceIds: [] as string[], providerIds: [] as string[] };

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DB_URL! }) });
    await prisma.$connect();

    const paymentRepo = createPaymentRepository(prisma);
    const ordersRepo = createOrdersRepository(prisma);
    const emitted: OutboxEvent[] = [];
    capturedEvents = emitted;
    const outbox: OutboxPort = {
      async emit(event): Promise<void> {
        emitted.push(event);
      },
    };

    submitCalls = 0;
    // Stub ONLY the external SMM provider — everything downstream is real.
    const providerSelector: ProviderSelectorPort = {
      async selectProviderById(providerId) {
        return {
          providerId,
          client: {
            async submitOrder() {
              submitCalls += 1;
              return { externalOrderId: `ext-${submitCalls}` };
            },
          } as unknown as ProviderClient,
        };
      },
      async selectProvider() {
        return this.selectProviderById('stub');
      },
    };

    const confirmDeps = {
      prisma,
      paymentRepo,
      ordersRepo,
      providerSelector,
      mappingRepo: createServiceProviderMappingRepository(prisma),
      attemptRepo: createProviderOrderAttemptRepository(prisma),
      outbox,
      logger: silentLogger,
    };

    const cryptomus = createCryptomusPaymentService({
      depositRepo: createDepositRepository(prisma),
      lifecycle: createDepositLifecycleService({
        prisma,
        walletRepo: createWalletRepository(prisma),
        ledgerRepo: createLedgerRepository(prisma),
        depositRepo: createDepositRepository(prisma),
        outbox,
        billingConfig: { minDeposit: 1, maxDeposit: 100_000, depositExpiryMs: 3_600_000 },
        logger: silentLogger,
      }),
      confirmOrderPayment: (paymentId) => confirmOrderPayment(confirmDeps, paymentId),
      cryptomusConfig: { merchantId: 'm', paymentKey: PAYMENT_KEY, callbackUrl: 'https://cb.test' },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

    app = Fastify();
    await app.register(
      createCryptomusRoutes({ service: cryptomus, authenticate: async (): Promise<void> => {} }),
      { prefix: '/billing/cryptomus' },
    );
    await app.ready();

    repos = { paymentRepo, ordersRepo };
  });

  let repos: {
    paymentRepo: ReturnType<typeof createPaymentRepository>;
    ordersRepo: ReturnType<typeof createOrdersRepository>;
  };

  afterAll(async () => {
    if (created.userIds.length > 0) {
      const orderIds = (
        await prisma.order.findMany({ where: { userId: { in: created.userIds } }, select: { id: true } })
      ).map((o) => o.id);
      await prisma.providerOrderAttempt.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.serviceProviderMapping.deleteMany({ where: { serviceId: { in: created.serviceIds } } });
      await prisma.order.deleteMany({ where: { userId: { in: created.userIds } } });
      await prisma.payment.deleteMany({ where: { userId: { in: created.userIds } } });
      await prisma.service.deleteMany({ where: { id: { in: created.serviceIds } } });
      await prisma.provider.deleteMany({ where: { id: { in: created.providerIds } } });
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    }
    await app.close();
    await prisma.$disconnect();
  });

  async function seedPaymentWithOrders(): Promise<{ userId: string; paymentId: string; firstOrderId: string }> {
    const tag = `order-settle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: { email: `${tag}@test.local`, username: tag.slice(0, 28) },
    });
    created.userIds.push(user.id);
    const provider = await prisma.provider.create({
      data: { name: tag, apiEndpoint: 'https://provider.test/api', apiKeyEncrypted: 'enc' },
    });
    created.providerIds.push(provider.id);
    const service = await prisma.service.create({
      data: {
        name: 'YouTube Views',
        platform: 'YOUTUBE',
        type: 'VIEWS',
        pricePer1000: 1,
        minQuantity: 50,
        maxQuantity: 500000,
        providerId: provider.id,
        externalServiceId: '2001',
      },
    });
    created.serviceIds.push(service.id);
    // Failover reads panels from service_provider_mappings, not service.providerId.
    await prisma.serviceProviderMapping.create({
      data: { serviceId: service.id, providerId: provider.id, externalServiceId: '2001', priority: 0 },
    });
    const { paymentId, orderIds } = await repos.paymentRepo.createPaymentWithOrders({
      userId: user.id,
      provider: 'CRYPTOMUS',
      amount: 2,
      items: [{ serviceId: service.id, link: 'https://youtube.com/watch?v=abc', quantity: 1000, price: 1 }],
      metrikaClientId: 'ym-int-client',
    });
    const firstOrderId = orderIds[0];
    if (!firstOrderId) throw new Error('seed: no order created');
    return { userId: user.id, paymentId, firstOrderId };
  }

  it('a paid order-payment webhook submits the orders and marks the payment PAID', async () => {
    capturedEvents.length = 0;
    const before = submitCalls;
    const { userId, paymentId, firstOrderId } = await seedPaymentWithOrders();

    const orderId = encodeRef({ kind: 'order-payment', paymentId, userId });
    const res = await app.inject({
      method: 'POST',
      url: '/billing/cryptomus/webhook',
      headers: { 'content-type': 'application/json' },
      payload: signedWebhook({ order_id: orderId, status: 'paid', amount: '2.00' }),
    });
    expect(res.statusCode).toBe(200);

    // The order the customer paid for is actually submitted + PROCESSING.
    expect(submitCalls).toBe(before + 1);
    const order = await prisma.order.findUnique({ where: { id: firstOrderId } });
    expect(order?.status).toBe('PROCESSING');
    expect(order?.externalOrderId).toBeTruthy();

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment?.status).toBe('PAID');
    expect(capturedEvents.map((e) => e.type)).toContain('order.created');

    // The confirmed purchase is reported once, carrying the captured ClientID so
    // the analytics handler can attribute the server-side conversion.
    const purchase = capturedEvents.filter((e) => e.type === 'payment.confirmed');
    expect(purchase).toHaveLength(1);
    expect(purchase[0]?.payload).toEqual(
      expect.objectContaining({ paymentId, amount: 2, currency: 'USD', metrikaClientId: 'ym-int-client' }),
    );
  });

  it('is idempotent: a replayed webhook does not resubmit the order', async () => {
    const { userId, paymentId, firstOrderId } = await seedPaymentWithOrders();
    const orderId = encodeRef({ kind: 'order-payment', paymentId, userId });
    const hook = signedWebhook({ order_id: orderId, status: 'paid', amount: '2.00' });

    const before = submitCalls;
    await app.inject({ method: 'POST', url: '/billing/cryptomus/webhook', payload: hook });
    await app.inject({ method: 'POST', url: '/billing/cryptomus/webhook', payload: hook });

    // Per-order claim guarantees exactly one submission across replays.
    expect(submitCalls).toBe(before + 1);
    const order = await prisma.order.findUnique({ where: { id: firstOrderId } });
    expect(order?.status).toBe('PROCESSING');
  });
});
