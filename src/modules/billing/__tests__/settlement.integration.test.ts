/**
 * Integration test for the REAL money-settlement chain, against a real Postgres
 * test DB. Unlike the per-layer unit tests (which each fake their neighbour —
 * the webhook route mocks the service, the service fakes the repos), this wires
 * the whole chain end to end:
 *
 *   signed Cryptomus webhook → cryptomus route → cryptomus service →
 *   deposit-lifecycle → wallet/ledger/deposit repos (real DB)
 *
 * and asserts the OUTCOME the customer cares about: the wallet balance actually
 * grows. That is the gap no existing test covered.
 *
 * Gated on TEST_DATABASE_URL and HARD-REFUSES the shared dev/prod DB
 * (youboost_dev) — this test mutates balances, so it must only run against an
 * isolated DB (youboost_test). Provision once:
 *   docker compose exec postgres psql -U youboost -d youboost_dev \
 *     -c "CREATE DATABASE youboost_test OWNER youboost;"
 *   DATABASE_URL=postgresql://youboost:youboost_dev_password@localhost:5432/youboost_test \
 *     npx prisma migrate deploy
 * Run:
 *   TEST_DATABASE_URL=postgresql://youboost:youboost_dev_password@localhost:5432/youboost_test \
 *     npx jest settlement.integration
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma';
import { createWalletRepository } from '../wallet.repository';
import { createLedgerRepository } from '../ledger.repository';
import { createDepositRepository } from '../deposit.repository';
import { createDepositLifecycleService } from '../deposit-lifecycle.service';
import { createCryptomusPaymentService } from '../cryptomus/cryptomus.service';
import { createCryptomusRoutes } from '../cryptomus/cryptomus.routes';
import { signRequestBody } from '../cryptomus/cryptomus.crypto';
import type { OutboxEvent, OutboxPort } from '../../../shared/outbox';
import { silentLogger } from './fakes';

const DB_URL = process.env['TEST_DATABASE_URL'];
// Money-mutating test: never touch the shared dev/prod database. Check the
// database NAME specifically (the password literal contains "youboost_dev",
// so matching the whole URL would false-positive).
const DB_NAME = (DB_URL ?? '').split('/').pop()?.split('?')[0];
const SAFE = Boolean(DB_URL) && DB_NAME !== 'youboost_dev';
const describeDb = SAFE ? describe : describe.skip;

const PAYMENT_KEY = 'test-payment-key';
const TEST_TAG = 'settle-int';

function signedWebhook(body: Record<string, unknown>): Record<string, unknown> {
  const unsignedJson = JSON.stringify(body);
  return { ...body, sign: signRequestBody(unsignedJson, PAYMENT_KEY) };
}

describeDb('payment settlement (integration, real DB)', () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;
  let capturedEvents: OutboxEvent[];
  let repos: {
    walletRepo: ReturnType<typeof createWalletRepository>;
    depositRepo: ReturnType<typeof createDepositRepository>;
  };
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const adapter = new PrismaPg({ connectionString: DB_URL! });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    const walletRepo = createWalletRepository(prisma);
    const ledgerRepo = createLedgerRepository(prisma);
    const depositRepo = createDepositRepository(prisma);
    const emitted: OutboxEvent[] = [];
    const outbox: OutboxPort = {
      async emit(event): Promise<void> {
        emitted.push(event);
      },
    };
    capturedEvents = emitted;

    const lifecycle = createDepositLifecycleService({
      prisma,
      walletRepo,
      ledgerRepo,
      depositRepo,
      outbox,
      billingConfig: { minDeposit: 1, maxDeposit: 100_000, depositExpiryMs: 60 * 60 * 1000 },
      logger: silentLogger,
    });
    const cryptomus = createCryptomusPaymentService({
      depositRepo,
      lifecycle,
      cryptomusConfig: {
        merchantId: 'test-merchant',
        paymentKey: PAYMENT_KEY,
        callbackUrl: 'https://cb.test',
      },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

    app = Fastify();
    await app.register(
      createCryptomusRoutes({ service: cryptomus, authenticate: async (): Promise<void> => {} }),
      { prefix: '/billing/cryptomus' },
    );
    await app.ready();

    repos = { walletRepo, depositRepo };
  });

  afterAll(async () => {
    // Children first (FK order), only rows this test created.
    if (createdUserIds.length > 0) {
      await prisma.deposit.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.ledger.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.wallet.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
    await prisma.$disconnect();
  });

  async function makeUser(): Promise<string> {
    const unique = `${TEST_TAG}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: { email: `${unique}@test.local`, username: unique.slice(0, 28) },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  it('a paid Cryptomus webhook credits the wallet balance and confirms the deposit', async () => {
    capturedEvents.length = 0;
    const userId = await makeUser();

    // PENDING deposit, then bind a Cryptomus order id (as the real checkout
    // flow does) so the webhook lookup resolves it.
    const pending = await repos.depositRepo.createDeposit({
      userId,
      amount: 25,
      cryptoAmount: 0,
      cryptoCurrency: '',
      paymentAddress: '',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const orderId = `cmo-${pending.id}`;
    await repos.depositRepo.updateDepositCryptomusOrder(pending.id, {
      cryptomusOrderId: orderId,
      cryptomusCheckoutUrl: 'https://pay.test/x',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/billing/cryptomus/webhook',
      headers: { 'content-type': 'application/json' },
      payload: signedWebhook({ order_id: orderId, status: 'paid', amount: '25.00' }),
    });
    expect(res.statusCode).toBe(200);

    // The outcome the customer sees: balance up by the deposit amount.
    const wallet = await repos.walletRepo.findWalletByUserId(userId);
    expect(Number(wallet?.balance)).toBe(25);

    const confirmed = await prisma.deposit.findUnique({ where: { id: pending.id } });
    expect(confirmed?.status).toBe('CONFIRMED');
    expect(capturedEvents.map((e) => e.type)).toContain('deposit.confirmed');
  });

  it('is idempotent: a replayed paid webhook does not double-credit', async () => {
    const userId = await makeUser();
    const pending = await repos.depositRepo.createDeposit({
      userId,
      amount: 40,
      cryptoAmount: 0,
      cryptoCurrency: '',
      paymentAddress: '',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const orderId = `cmo-${pending.id}`;
    await repos.depositRepo.updateDepositCryptomusOrder(pending.id, {
      cryptomusOrderId: orderId,
      cryptomusCheckoutUrl: 'https://pay.test/y',
    });
    const hook = signedWebhook({ order_id: orderId, status: 'paid', amount: '40.00' });

    await app.inject({ method: 'POST', url: '/billing/cryptomus/webhook', payload: hook });
    await app.inject({ method: 'POST', url: '/billing/cryptomus/webhook', payload: hook });

    const wallet = await repos.walletRepo.findWalletByUserId(userId);
    expect(Number(wallet?.balance)).toBe(40);
  });
});
