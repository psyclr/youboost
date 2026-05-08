import { createOrdersService, type OrdersService } from '../orders.service';
import {
  createFakeOrdersRepository,
  createFakeServicesRepository,
  createFakeBilling,
  createFakeProviderSelector,
  createFakeProviderClient,
  createFakeCouponsService,
  createFakeOutbox,
  createFakePrisma,
  makeServiceRecord,
  silentLogger,
  type FakeOrdersRepository,
  type FakeServicesRepository,
  type FakeBilling,
  type FakeOutbox,
  type FakeCouponsService,
} from './fakes';
import type { ProviderClient } from '../utils/provider-client';
import type { ProviderSelectorPort } from '../ports/provider-selector.port';

interface Harness {
  service: OrdersService;
  ordersRepo: FakeOrdersRepository;
  servicesRepo: FakeServicesRepository;
  billing: FakeBilling;
  outbox: FakeOutbox;
  couponsService: FakeCouponsService;
  providerClient: jest.Mocked<ProviderClient>;
  providerSelector: ReturnType<typeof createFakeProviderSelector>;
}

function buildHarness(
  opts: {
    service?: ReturnType<typeof makeServiceRecord>;
    clientOverrides?: Partial<ProviderClient>;
    selectByIdImpl?: Parameters<typeof createFakeProviderSelector>[0]['selectByIdImpl'];
    couponResults?: Record<
      string,
      { valid: boolean; discount: number; couponId: string | null; reason?: string }
    >;
  } = {},
): Harness {
  const servicesRepo = createFakeServicesRepository({
    services: [opts.service ?? makeServiceRecord()],
  });
  const ordersRepo = createFakeOrdersRepository();
  const billing = createFakeBilling();
  const providerClient = createFakeProviderClient(opts.clientOverrides);
  const providerSelector = createFakeProviderSelector({
    client: providerClient,
    providerId: 'prov-1',
    ...(opts.selectByIdImpl ? { selectByIdImpl: opts.selectByIdImpl } : {}),
  });
  const outbox = createFakeOutbox();
  const couponsService = createFakeCouponsService(opts.couponResults ?? {});
  const fakePrisma = createFakePrisma();

  const service = createOrdersService({
    prisma: fakePrisma.client,
    ordersRepo,
    servicesRepo,
    billing: {
      holdFunds: billing.holdFunds,
      releaseFunds: billing.releaseFunds,
    },
    providerSelector: providerSelector as unknown as ProviderSelectorPort,
    couponsService,
    outbox: outbox.port,
    logger: silentLogger,
  });

  return {
    service,
    ordersRepo,
    servicesRepo,
    billing,
    outbox,
    couponsService,
    providerClient,
    providerSelector,
  };
}

const validInput = {
  serviceId: 'svc-1',
  link: 'https://youtube.com/watch?v=test',
  quantity: 1000,
  isDripFeed: false as const,
};

describe('Orders Service', () => {
  describe('createOrder', () => {
    it('creates order and holds funds', async () => {
      const h = buildHarness();
      const result = await h.service.createOrder('user-1', validInput);

      expect(result.status).toBe('PROCESSING');
      expect(h.billing.calls.holdFunds).toEqual([
        { userId: 'user-1', amount: 2.5, orderId: result.orderId },
      ]);
    });

    it('calculates price from quantity * pricePer1000 / 1000', async () => {
      const h = buildHarness({
        service: makeServiceRecord({
          pricePer1000: 5 as unknown as ReturnType<typeof makeServiceRecord>['pricePer1000'],
        }),
      });
      await h.service.createOrder('user-1', { ...validInput, quantity: 5000 });
      expect(h.ordersRepo.calls.createOrder[0]).toMatchObject({ price: 25 });
    });

    it('throws NotFoundError when service does not exist', async () => {
      const h = buildHarness({ service: makeServiceRecord({ id: 'other-svc' }) });
      await expect(h.service.createOrder('user-1', validInput)).rejects.toThrow(
        'Service not found',
      );
    });

    it('throws ValidationError when service inactive', async () => {
      const h = buildHarness({ service: makeServiceRecord({ isActive: false }) });
      await expect(h.service.createOrder('user-1', validInput)).rejects.toThrow(
        'Service is not available',
      );
    });

    it('throws ValidationError when quantity below minQuantity', async () => {
      const h = buildHarness();
      await expect(
        h.service.createOrder('user-1', { ...validInput, quantity: 50 }),
      ).rejects.toThrow('Quantity must be between');
    });

    it('throws ValidationError when quantity above maxQuantity', async () => {
      const h = buildHarness();
      await expect(
        h.service.createOrder('user-1', { ...validInput, quantity: 200_000 }),
      ).rejects.toThrow('Quantity must be between');
    });

    it('throws ValidationError when service has no provider', async () => {
      const h = buildHarness({
        service: makeServiceRecord({ providerId: null, externalServiceId: null }),
      });
      await expect(h.service.createOrder('user-1', validInput)).rejects.toThrow(
        'Service is not linked to a provider',
      );
    });

    it('submits to provider via selectProviderById with service.providerId', async () => {
      const h = buildHarness();
      await h.service.createOrder('user-1', validInput);
      expect(h.providerSelector.calls.selectProviderById).toContain('prov-1');
    });

    it('submits externalServiceId + link + quantity to provider', async () => {
      const h = buildHarness();
      await h.service.createOrder('user-1', validInput);
      expect(h.providerClient.submitOrder).toHaveBeenCalledWith({
        serviceId: '101',
        link: 'https://youtube.com/watch?v=test',
        quantity: 1000,
      });
    });

    it('emits order.created outbox event in a transaction', async () => {
      const h = buildHarness();
      const result = await h.service.createOrder('user-1', validInput);

      const created = h.outbox.events.find((e) => e.event.type === 'order.created');
      expect(created).toBeDefined();
      expect(created?.event).toMatchObject({
        type: 'order.created',
        aggregateType: 'order',
        aggregateId: result.orderId,
        userId: 'user-1',
        payload: { orderId: result.orderId, userId: 'user-1', status: 'PROCESSING' },
      });
    });

    it('emits coupon.used event when a coupon is applied', async () => {
      const h = buildHarness({
        couponResults: { SAVE5: { valid: true, discount: 0.5, couponId: 'c1' } },
      });
      const result = await h.service.createOrder('user-1', {
        ...validInput,
        couponCode: 'SAVE5',
      });
      const couponEvent = h.outbox.events.find((e) => e.event.type === 'coupon.used');
      expect(couponEvent?.event).toMatchObject({
        type: 'coupon.used',
        payload: { couponId: 'c1', orderId: result.orderId },
      });
    });

    it('does not emit coupon.used when no coupon was applied', async () => {
      const h = buildHarness();
      await h.service.createOrder('user-1', validInput);
      expect(h.outbox.events.find((e) => e.event.type === 'coupon.used')).toBeUndefined();
    });

    it('throws ValidationError when coupon invalid', async () => {
      const h = buildHarness({
        couponResults: {
          BADCODE: { valid: false, discount: 0, couponId: null, reason: 'Coupon expired' },
        },
      });
      await expect(
        h.service.createOrder('user-1', { ...validInput, couponCode: 'BADCODE' }),
      ).rejects.toThrow('Coupon expired');
    });

    it('updates order status to PROCESSING with externalOrderId + remains', async () => {
      const h = buildHarness({
        clientOverrides: {
          submitOrder: jest
            .fn()
            .mockResolvedValue({ externalOrderId: 'ext-99', status: 'processing' }),
        },
      });
      const result = await h.service.createOrder('user-1', validInput);
      expect(h.ordersRepo.calls.updateOrderStatus[0]).toMatchObject({
        orderId: result.orderId,
        data: {
          status: 'PROCESSING',
          externalOrderId: 'ext-99',
          providerId: 'prov-1',
          remains: 1000,
        },
      });
    });

    it('releases funds and marks order FAILED when provider submit throws', async () => {
      const h = buildHarness({
        clientOverrides: {
          submitOrder: jest.fn().mockRejectedValue(new Error('provider down')),
        },
      });
      await expect(h.service.createOrder('user-1', validInput)).rejects.toThrow('provider down');
      expect(h.billing.calls.releaseFunds.length).toBeGreaterThan(0);
      expect(h.ordersRepo.calls.updateOrderStatus.some((c) => c.data.status === 'FAILED')).toBe(
        true,
      );
    });
  });

  describe('getOrder', () => {
    it('returns order details', async () => {
      const h = buildHarness();
      const result = await h.service.createOrder('user-1', validInput);
      const fetched = await h.service.getOrder('user-1', result.orderId);
      expect(fetched.orderId).toBe(result.orderId);
      expect(fetched.link).toBe('https://youtube.com/watch?v=test');
    });

    it('throws NotFoundError when order not found', async () => {
      const h = buildHarness();
      await expect(h.service.getOrder('user-1', 'missing')).rejects.toThrow('Order not found');
    });

    it('scopes by userId', async () => {
      const h = buildHarness();
      const result = await h.service.createOrder('user-1', validInput);
      await expect(h.service.getOrder('user-2', result.orderId)).rejects.toThrow('Order not found');
    });
  });

  describe('listOrders', () => {
    it('returns paginated orders', async () => {
      const h = buildHarness();
      await h.service.createOrder('user-1', validInput);
      const result = await h.service.listOrders('user-1', { page: 1, limit: 20 });
      expect(result.orders).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('filters by status', async () => {
      const h = buildHarness();
      await h.service.createOrder('user-1', validInput);
      const result = await h.service.listOrders('user-1', {
        page: 1,
        limit: 20,
        status: 'PENDING',
      });
      expect(result.orders).toHaveLength(0); // Created orders are PROCESSING
    });

    it('computes totalPages correctly', async () => {
      const h = buildHarness();
      for (let i = 0; i < 45; i++) await h.service.createOrder('user-1', validInput);
      const result = await h.service.listOrders('user-1', { page: 1, limit: 20 });
      expect(result.pagination.totalPages).toBe(3);
    });

    it('returns empty list when no orders', async () => {
      const h = buildHarness();
      const result = await h.service.listOrders('user-1', { page: 1, limit: 20 });
      expect(result.orders).toHaveLength(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe('cancelOrder', () => {
    it('cancels PROCESSING order and releases funds', async () => {
      const h = buildHarness();
      const created = await h.service.createOrder('user-1', validInput);
      const result = await h.service.cancelOrder('user-1', created.orderId);

      expect(result.status).toBe('CANCELLED');
      expect(result.refundAmount).toBe(2.5);
      expect(h.billing.calls.releaseFunds).toEqual(
        expect.arrayContaining([{ userId: 'user-1', amount: 2.5, orderId: created.orderId }]),
      );
    });

    it('emits order.cancelled outbox event', async () => {
      const h = buildHarness();
      const created = await h.service.createOrder('user-1', validInput);
      await h.service.cancelOrder('user-1', created.orderId);

      const cancelled = h.outbox.events.find((e) => e.event.type === 'order.cancelled');
      expect(cancelled?.event).toMatchObject({
        type: 'order.cancelled',
        aggregateType: 'order',
        aggregateId: created.orderId,
        userId: 'user-1',
        payload: { orderId: created.orderId, refundAmount: 2.5 },
      });
    });

    it('throws NotFoundError when order not found', async () => {
      const h = buildHarness();
      await expect(h.service.cancelOrder('user-1', 'missing')).rejects.toThrow('Order not found');
    });

    it('throws ValidationError when order already COMPLETED', async () => {
      const h = buildHarness();
      const created = await h.service.createOrder('user-1', validInput);
      // manually mutate to completed via repo
      await h.ordersRepo.updateOrderStatus(created.orderId, {
        status: 'COMPLETED',
        completedAt: new Date(),
      });
      await expect(h.service.cancelOrder('user-1', created.orderId)).rejects.toThrow(
        'Order cannot be cancelled',
      );
    });

    it('throws ValidationError when order already CANCELLED', async () => {
      const h = buildHarness();
      const created = await h.service.createOrder('user-1', validInput);
      await h.ordersRepo.updateOrderStatus(created.orderId, {
        status: 'CANCELLED',
        completedAt: new Date(),
      });
      await expect(h.service.cancelOrder('user-1', created.orderId)).rejects.toThrow(
        'Order cannot be cancelled',
      );
    });
  });
});
