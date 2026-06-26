/**
 * End-to-end failover against a real Postgres test DB: the engine + the real
 * mapping/attempt repos, with a stub provider selector that fails panel A and
 * succeeds on panel B. Gated on TEST_DATABASE_URL; refuses youboost_dev.
 *   TEST_DATABASE_URL=postgresql://youboost:youboost_dev_password@localhost:5432/youboost_test \
 *     npx jest order-failover.integration
 */
import type { Logger } from 'pino';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma';
import { createServiceProviderMappingRepository } from '../../providers/service-provider-mapping.repository';
import { createProviderOrderAttemptRepository } from '../../providers/provider-order-attempt.repository';
import { submitWithFailover } from '../submit-with-failover';
import type { ProviderSelectorPort } from '../ports/provider-selector.port';
import type { ProviderClient } from '../utils/provider-client';

const DB_URL = process.env['TEST_DATABASE_URL'];
const DB_NAME = (DB_URL ?? '').split('/').pop()?.split('?')[0];
const SAFE = Boolean(DB_URL) && DB_NAME !== 'youboost_dev';
const describeDb = SAFE ? describe : describe.skip;

const TAG = 'failover-e2e';
const silentLogger = { warn: jest.fn(), info: jest.fn() } as unknown as Logger;

function selectorFailing(failProviderIds: Set<string>): ProviderSelectorPort {
  return {
    async selectProviderById(providerId) {
      return {
        providerId,
        client: {
          async submitOrder() {
            if (failProviderIds.has(providerId)) throw new Error('not enough funds');
            return { externalOrderId: `ext-${providerId}`, status: 'processing' };
          },
        } as unknown as ProviderClient,
      };
    },
    async selectProvider() {
      return this.selectProviderById('stub');
    },
  };
}

describeDb('order failover (integration, real DB)', () => {
  let prisma: PrismaClient;
  const created = { userIds: [] as string[], serviceIds: [] as string[], providerIds: [] as string[] };

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DB_URL! }) });
    await prisma.$connect();
  });

  afterAll(async () => {
    const orderIds = (
      await prisma.order.findMany({ where: { userId: { in: created.userIds } }, select: { id: true } })
    ).map((o) => o.id);
    await prisma.providerOrderAttempt.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.serviceProviderMapping.deleteMany({ where: { serviceId: { in: created.serviceIds } } });
    await prisma.order.deleteMany({ where: { userId: { in: created.userIds } } });
    await prisma.service.deleteMany({ where: { id: { in: created.serviceIds } } });
    await prisma.provider.deleteMany({ where: { id: { in: created.providerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    await prisma.$disconnect();
  });

  async function seed(): Promise<{ orderId: string; userId: string; serviceId: string; provA: string; provB: string }> {
    // A has the higher admin priority so it is tried first (ordering = provider.priority desc).
    const provA = (await prisma.provider.create({ data: { name: `${TAG}-A-${Math.random()}`, apiEndpoint: 'https://a.test', apiKeyEncrypted: 'x', priority: 10 } })).id;
    const provB = (await prisma.provider.create({ data: { name: `${TAG}-B-${Math.random()}`, apiEndpoint: 'https://b.test', apiKeyEncrypted: 'x', priority: 5 } })).id;
    created.providerIds.push(provA, provB);
    const service = await prisma.service.create({
      data: { name: `${TAG}-svc`, platform: 'YOUTUBE', type: 'VIEWS', pricePer1000: 1.5, minQuantity: 100, maxQuantity: 1_000_000 },
    });
    created.serviceIds.push(service.id);
    await prisma.serviceProviderMapping.create({ data: { serviceId: service.id, providerId: provA, externalServiceId: 'ext-A', priority: 0 } });
    await prisma.serviceProviderMapping.create({ data: { serviceId: service.id, providerId: provB, externalServiceId: 'ext-B', priority: 1 } });
    const user = await prisma.user.create({ data: { email: `${TAG}-${Date.now()}@test.local`, username: `${TAG}${Date.now()}`.slice(0, 28) } });
    created.userIds.push(user.id);
    const order = await prisma.order.create({ data: { userId: user.id, serviceId: service.id, link: 'https://x.test/v', quantity: 1000, price: 1.5 } });
    return { orderId: order.id, userId: user.id, serviceId: service.id, provA, provB };
  }

  it('panel A fails → routes to B; records both attempts in the DB', async () => {
    const s = await seed();
    const deps = {
      providerSelector: selectorFailing(new Set([s.provA])),
      mappingRepo: createServiceProviderMappingRepository(prisma),
      attemptRepo: createProviderOrderAttemptRepository(prisma),
      logger: silentLogger,
    };
    const res = await submitWithFailover(deps, {
      orderId: s.orderId, userId: s.userId, serviceId: s.serviceId, link: 'https://x.test/v', quantity: 1000,
    });

    expect(res).toEqual({ ok: true, providerId: s.provB, externalOrderId: `ext-${s.provB}` });
    const rows = await prisma.providerOrderAttempt.findMany({ where: { orderId: s.orderId }, orderBy: { createdAt: 'asc' } });
    expect(rows.map((r) => `${r.providerId === s.provA ? 'A' : 'B'}:${r.outcome}`)).toEqual(['A:FAILED', 'B:SUCCESS']);
  });

  it('all panels fail → ok:false; both attempts recorded FAILED', async () => {
    const s = await seed();
    const deps = {
      providerSelector: selectorFailing(new Set([s.provA, s.provB])),
      mappingRepo: createServiceProviderMappingRepository(prisma),
      attemptRepo: createProviderOrderAttemptRepository(prisma),
      logger: silentLogger,
    };
    const res = await submitWithFailover(deps, {
      orderId: s.orderId, userId: s.userId, serviceId: s.serviceId, link: 'https://x.test/v', quantity: 1000,
    });

    expect(res).toEqual({ ok: false, attempts: 2 });
    const rows = await prisma.providerOrderAttempt.findMany({ where: { orderId: s.orderId } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.outcome === 'FAILED')).toBe(true);
  });
});
