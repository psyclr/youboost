import { confirmOrderPayment, type ConfirmOrderPaymentDeps } from '../confirm-order-payment.flow';
import type { PaymentWithOrders } from '../../billing/payment.repository';
import type { OrderRecord } from '../orders.types';
import {
  createFakeOrdersRepository,
  createFakeServicesRepository,
  createFakeProviderSelector,
  createFakeProviderClient,
  createFakeOutbox,
  createFakePrisma,
  makeServiceRecord,
  makeOrderRecord,
  silentLogger,
} from './fakes';

interface MakeDepsOptions {
  payment: PaymentWithOrders | null;
  /**
   * Override the status an order has in the DB (repo), keyed by order id —
   * defaults to the status in the payment snapshot. Use to simulate an order
   * already claimed by a concurrent delivery (DB=PROCESSING) while this
   * delivery's snapshot is still stale (PENDING_PAYMENT).
   */
  repoStatusById?: Record<string, OrderRecord['status']>;
  /** Force the provider submit to reject, to exercise the revert path. */
  submitOrderError?: Error;
}

function makeDeps(opts: MakeDepsOptions): ConfirmOrderPaymentDeps & {
  submitted: string[];
  warnSpy: jest.SpyInstance;
  ordersRepo: ReturnType<typeof createFakeOrdersRepository>;
  paymentRepo: {
    findPaymentWithOrders: jest.Mock;
    claimPaymentForSettlement: jest.Mock;
    createPaymentWithOrders: jest.Mock;
    attachSession: jest.Mock;
  };
} {
  const submitOrder = opts.submitOrderError
    ? jest.fn(async () => {
        throw opts.submitOrderError;
      })
    : jest.fn(async () => ({ externalOrderId: 'ext-1', status: 'processing' }));
  const client = createFakeProviderClient({ submitOrder });
  const providerSelector = createFakeProviderSelector({ client });

  // Seed the repo with the payment's orders as they exist in the DB.
  const ordersRepo = createFakeOrdersRepository({
    orders: (opts.payment?.orders ?? []).map((o) =>
      makeOrderRecord({
        id: o.id,
        userId: opts.payment?.userId ?? 'u1',
        serviceId: o.serviceId,
        link: o.link,
        quantity: o.quantity,
        status: opts.repoStatusById?.[o.id] ?? o.status,
      }),
    ),
  });

  // Record orders that get submitted (flipped to PROCESSING via updateOrderStatus).
  const submitted: string[] = [];
  const originalUpdate = ordersRepo.updateOrderStatus.bind(ordersRepo);
  ordersRepo.updateOrderStatus = async (orderId, data) => {
    if (data.status === 'PROCESSING') submitted.push(orderId);
    return originalUpdate(orderId, data);
  };

  const servicesRepo = createFakeServicesRepository({
    services: [
      makeServiceRecord({ id: 's1', providerId: 'prov-1', externalServiceId: '101' }),
      makeServiceRecord({ id: 's2', providerId: 'prov-1', externalServiceId: '102' }),
    ],
  });
  const prisma = createFakePrisma();
  const outbox = createFakeOutbox();

  const paymentRepo = {
    findPaymentWithOrders: jest.fn(async () => opts.payment),
    claimPaymentForSettlement: jest.fn(async () => true),
    createPaymentWithOrders: jest.fn(),
    attachSession: jest.fn(),
  };

  const warnSpy = jest.spyOn(silentLogger, 'warn');

  return {
    submitted,
    warnSpy,
    ordersRepo,
    paymentRepo,
    prisma: prisma.client,
    servicesRepo,
    providerSelector,
    outbox: outbox.port,
    logger: silentLogger,
  };
}

describe('confirmOrderPayment', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('settles the payment and submits every PENDING_PAYMENT order', async () => {
    const deps = makeDeps({
      payment: {
        id: 'pay1',
        userId: 'u1',
        status: 'PENDING',
        orders: [
          { id: 'o1', status: 'PENDING_PAYMENT', serviceId: 's1', link: 'l1', quantity: 100 },
          { id: 'o2', status: 'PENDING_PAYMENT', serviceId: 's2', link: 'l2', quantity: 200 },
        ],
      },
    });
    await confirmOrderPayment(deps, 'pay1');
    expect(deps.paymentRepo.claimPaymentForSettlement).toHaveBeenCalledWith('pay1');
    expect(deps.submitted).toEqual(['o1', 'o2']);
  });

  it('already-PAID payment with no pending orders is a no-op', async () => {
    const deps = makeDeps({
      payment: { id: 'pay1', userId: 'u1', status: 'PAID', orders: [] },
    });
    await confirmOrderPayment(deps, 'pay1');
    // Already settled: must not re-run the settlement marker.
    expect(deps.paymentRepo.claimPaymentForSettlement).not.toHaveBeenCalled();
    expect(deps.submitted).toEqual([]);
  });

  it('already-PAID re-delivery submits leftover PENDING_PAYMENT orders (partial-failure recovery)', async () => {
    // Regression: the old fast-path returned on status==='PAID' and dropped any
    // order that had not yet been submitted (e.g. the 2nd order failed the first
    // time). The customer had paid but never received the leftover service.
    const deps = makeDeps({
      payment: {
        id: 'pay1',
        userId: 'u1',
        status: 'PAID',
        orders: [
          { id: 'o1', status: 'PROCESSING', serviceId: 's1', link: 'l1', quantity: 100 },
          { id: 'o2', status: 'PENDING_PAYMENT', serviceId: 's2', link: 'l2', quantity: 200 },
        ],
      },
    });
    await confirmOrderPayment(deps, 'pay1');
    expect(deps.paymentRepo.claimPaymentForSettlement).not.toHaveBeenCalled();
    expect(deps.submitted).toEqual(['o2']);
  });

  it('concurrent duplicate: order already claimed in DB → not re-submitted', async () => {
    // Stale snapshot says PENDING_PAYMENT, but another delivery already flipped
    // it to PROCESSING in the DB. The per-order claim must lose and skip submit.
    const deps = makeDeps({
      payment: {
        id: 'pay1',
        userId: 'u1',
        status: 'PENDING',
        orders: [
          { id: 'o1', status: 'PENDING_PAYMENT', serviceId: 's1', link: 'l1', quantity: 100 },
        ],
      },
      repoStatusById: { o1: 'PROCESSING' },
    });
    await confirmOrderPayment(deps, 'pay1');
    expect(deps.submitted).toEqual([]);
  });

  it('skips orders already past PENDING_PAYMENT in the snapshot', async () => {
    const deps = makeDeps({
      payment: {
        id: 'pay1',
        userId: 'u1',
        status: 'PENDING',
        orders: [
          { id: 'o1', status: 'PROCESSING', serviceId: 's1', link: 'l1', quantity: 100 },
          { id: 'o2', status: 'PENDING_PAYMENT', serviceId: 's2', link: 'l2', quantity: 200 },
        ],
      },
    });
    await confirmOrderPayment(deps, 'pay1');
    expect(deps.submitted).toEqual(['o2']);
  });

  it('reverts the order to PENDING_PAYMENT and rethrows when the provider submit fails', async () => {
    const deps = makeDeps({
      submitOrderError: new Error('provider 503'),
      payment: {
        id: 'pay1',
        userId: 'u1',
        status: 'PENDING',
        orders: [
          { id: 'o1', status: 'PENDING_PAYMENT', serviceId: 's1', link: 'l1', quantity: 100 },
        ],
      },
    });
    await expect(confirmOrderPayment(deps, 'pay1')).rejects.toThrow('provider 503');
    // Order must be released back to PENDING_PAYMENT so a re-delivery can retry.
    const reverted = await deps.ordersRepo.findOrderById('o1', 'u1');
    expect(reverted?.status).toBe('PENDING_PAYMENT');
  });

  it('throws when the payment does not exist', async () => {
    const deps = makeDeps({ payment: null });
    await expect(confirmOrderPayment(deps, 'missing')).rejects.toThrow(/Payment not found/);
  });

  it('warns when payment settles but zero orders are PENDING_PAYMENT (all cancelled before late webhook)', async () => {
    const deps = makeDeps({
      payment: {
        id: 'pay1',
        userId: 'u1',
        status: 'PENDING',
        orders: [
          { id: 'o1', status: 'CANCELLED', serviceId: 's1', link: 'l1', quantity: 100 },
          { id: 'o2', status: 'CANCELLED', serviceId: 's2', link: 'l2', quantity: 200 },
        ],
      },
    });
    await confirmOrderPayment(deps, 'pay1');
    expect(deps.warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'pay1', submittedCount: 0 }),
      expect.stringContaining('no pending orders to submit'),
    );
    expect(deps.submitted).toEqual([]);
  });
});
