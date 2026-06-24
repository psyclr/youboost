/**
 * Integration test for the failover repositories against a real Postgres test DB.
 * Gated on TEST_DATABASE_URL and HARD-REFUSES the shared dev/prod DB
 * (youboost_dev). Provision once (see settlement.integration.test.ts) then:
 *   TEST_DATABASE_URL=postgresql://youboost:youboost_dev_password@localhost:5432/youboost_test \
 *     npx jest service-provider-mapping.repository.integration
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma';
import { createServiceProviderMappingRepository } from '../service-provider-mapping.repository';
import { createProviderOrderAttemptRepository } from '../provider-order-attempt.repository';

const DB_URL = process.env['TEST_DATABASE_URL'];
const DB_NAME = (DB_URL ?? '').split('/').pop()?.split('?')[0];
const SAFE = Boolean(DB_URL) && DB_NAME !== 'youboost_dev';
const describeDb = SAFE ? describe : describe.skip;

const TAG = 'failover-int';

describeDb('failover repositories (integration, real DB)', () => {
  let prisma: PrismaClient;
  const created = { userIds: [] as string[], serviceIds: [] as string[], providerIds: [] as string[] };

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DB_URL! }) });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.providerOrderAttempt.deleteMany({ where: { providerId: { in: created.providerIds } } });
    await prisma.serviceProviderMapping.deleteMany({ where: { serviceId: { in: created.serviceIds } } });
    await prisma.order.deleteMany({ where: { userId: { in: created.userIds } } });
    await prisma.service.deleteMany({ where: { id: { in: created.serviceIds } } });
    await prisma.provider.deleteMany({ where: { id: { in: created.providerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    await prisma.$disconnect();
  });

  async function makeProvider(name: string): Promise<string> {
    const p = await prisma.provider.create({
      data: { name: `${TAG}-${name}`, apiEndpoint: 'https://example.test/v2', apiKeyEncrypted: 'x' },
    });
    created.providerIds.push(p.id);
    return p.id;
  }

  it('lists active panels for a service in priority order', async () => {
    const provA = await makeProvider('A');
    const provB = await makeProvider('B');
    const service = await prisma.service.create({
      data: {
        name: `${TAG}-svc`,
        platform: 'YOUTUBE',
        type: 'VIEWS',
        pricePer1000: 1.5,
        minQuantity: 100,
        maxQuantity: 1_000_000,
      },
    });
    created.serviceIds.push(service.id);
    // B added first but lower priority — repo must order by priority asc.
    await prisma.serviceProviderMapping.create({
      data: { serviceId: service.id, providerId: provB, externalServiceId: 'ext-B', priority: 1 },
    });
    await prisma.serviceProviderMapping.create({
      data: { serviceId: service.id, providerId: provA, externalServiceId: 'ext-A', priority: 0 },
    });

    const repo = createServiceProviderMappingRepository(prisma);
    const candidates = await repo.listActiveByServiceId(service.id);

    expect(candidates.map((c) => c.priority)).toEqual([0, 1]);
    expect(candidates[0]!.externalServiceId).toBe('ext-A');
    expect(candidates[1]!.externalServiceId).toBe('ext-B');
  });

  it('excludes inactive mappings', async () => {
    const prov = await makeProvider('C');
    const service = await prisma.service.create({
      data: {
        name: `${TAG}-svc2`,
        platform: 'YOUTUBE',
        type: 'LIKES',
        pricePer1000: 3,
        minQuantity: 50,
        maxQuantity: 500_000,
      },
    });
    created.serviceIds.push(service.id);
    await prisma.serviceProviderMapping.create({
      data: { serviceId: service.id, providerId: prov, externalServiceId: 'ext-C', priority: 0, isActive: false },
    });

    const repo = createServiceProviderMappingRepository(prisma);
    expect(await repo.listActiveByServiceId(service.id)).toEqual([]);
  });

  it('records a provider attempt against an order', async () => {
    const prov = await makeProvider('D');
    const service = await prisma.service.create({
      data: {
        name: `${TAG}-svc3`,
        platform: 'YOUTUBE',
        type: 'VIEWS',
        pricePer1000: 1.5,
        minQuantity: 100,
        maxQuantity: 1_000_000,
      },
    });
    created.serviceIds.push(service.id);
    const user = await prisma.user.create({
      data: { email: `${TAG}-${Date.now()}@test.local`, username: `${TAG}${Date.now()}`.slice(0, 28) },
    });
    created.userIds.push(user.id);
    const order = await prisma.order.create({
      data: { userId: user.id, serviceId: service.id, link: 'https://x.test/v', quantity: 1000, price: 1.5 },
    });

    const repo = createProviderOrderAttemptRepository(prisma);
    await repo.record({
      orderId: order.id,
      providerId: prov,
      externalServiceId: 'ext-D',
      outcome: 'FAILED',
      error: 'not enough funds',
      providerCost: 0.9,
    });

    const rows = await prisma.providerOrderAttempt.findMany({ where: { orderId: order.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.outcome).toBe('FAILED');
    expect(rows[0]!.error).toBe('not enough funds');
  });
});
