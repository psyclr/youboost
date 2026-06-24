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
  payment: Omit<PaymentWithOrders, 'amount' | 'metrikaClientId'> | null;
  /** Payment amount in the snapshot (defaults to 0). */
  amount?: number;
  /** Metrika ClientID captured at checkout (defaults to null). */
  metrikaClientId?: string | null;
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
  outboxEvents: ReturnType<typeof createFakeOutbox>['events'];
  refundToWallet: jest.Mock;
} {
  const payment: PaymentWithOrders | null = opts.payment
    ? { ...opts.payment, amount: opts.amount ?? 0, metrikaClientId: opts.metrikaClientId ?? null }
    : null;
  const submitOrder = opts.submitOrderError
    ? jest.fn(async () => {
        throw opts.submitOrderError;
      })
    : jest.fn(async () => ({ externalOrderId: 'ext-1', status: 'processing' }));
  const client = createFakeProviderClient({ submitOrder });
  const providerSelector = createFakeProviderSelector({ client });

  // Seed the repo with the payment's orders as they exist in the DB.
  const ordersRepo = createFakeOrdersRepository({
    orders: (payment?.orders ?? []).map((o) =>
      makeOrderRecord({
        id: o.id,
        userId: payment?.userId ?? 'u1',
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
    findPaymentWithOrders: jest.fn(async () => payment),
    claimPaymentForSettlement: jest.fn(async () => true),
    createPaymentWithOrders: jest.fn(),
    attachSession: jest.fn(),
  };

  const warnSpy = jest.spyOn(silentLogger, 'warn');
  const refundToWallet = jest.fn(async () => undefined);

  return {
    submitted,
    warnSpy,
    ordersRepo,
    paymentRepo,
    prisma: prisma.client,
    servicesRepo,
    providerSelector,
    outbox: outbox.port,
    outboxEvents: outbox.events,
    refundToWallet,
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

  it('emits payment.confirmed once with amount + ClientID when it wins the settlement claim', async () => {
    const deps = makeDeps({
      amount: 24.5,
      metrikaClientId: 'ym-client-1',
      payment: {
        id: 'pay1',
        userId: 'u1',
        status: 'PENDING',
        orders: [
          { id: 'o1', status: 'PENDING_PAYMENT', serviceId: 's1', link: 'l1', quantity: 100 },
        ],
      },
    });
    await confirmOrderPayment(deps, 'pay1');
    const confirmed = deps.outboxEvents.filter((e) => e.event.type === 'payment.confirmed');
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]?.event.payload).toEqual(
      expect.objectContaining({
        paymentId: 'pay1',
        amount: 24.5,
        currency: 'USD',
        metrikaClientId: 'ym-client-1',
      }),
    );
  });

  it('does NOT emit payment.confirmed when it loses the settlement claim (concurrent webhook)', async () => {
    const deps = makeDeps({
      payment: {
        id: 'pay1',
        userId: 'u1',
        status: 'PENDING',
        orders: [
          { id: 'o1', status: 'PENDING_PAYMENT', serviceId: 's1', link: 'l1', quantity: 100 },
        ],
      },
    });
    deps.paymentRepo.claimPaymentForSettlement.mockResolvedValueOnce(false);
    await confirmOrderPayment(deps, 'pay1');
    expect(deps.outboxEvents.some((e) => e.event.type === 'payment.confirmed')).toBe(false);
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

  it('refunds the customer to wallet and fails the order when the provider rejects (no panel funds)', async () => {
    const deps = makeDeps({
      amount: 5,
      submitOrderError: new Error('not enough funds'),
      payment: {
        id: 'pay1',
        userId: 'u1',
        status: 'PENDING',
        orders: [
          {
            id: 'o1',
            status: 'PENDING_PAYMENT',
            serviceId: 's1',
            link: 'l1',
            quantity: 100,
            price: 5,
          },
        ],
      },
    });
    // Never strand a paid order: the webhook must NOT throw (stays 200, no retry storm).
    await expect(confirmOrderPayment(deps, 'pay1')).resolves.toBeUndefined();
    // Customer is credited the order price to their wallet.
    expect(deps.refundToWallet).toHaveBeenCalledWith('u1', 5, 'o1');
    // Order ends FAILED and a failure event is emitted (drives the email).
    const failed = await deps.ordersRepo.findOrderById('o1', 'u1');
    expect(failed?.status).toBe('FAILED');
    expect(deps.outboxEvents.map((e) => e.event.type)).toContain('order.failed');
    expect(deps.submitted).toEqual([]);
  });

  it('does not refund the orders that succeeded — only the failed one (partial fulfilment)', async () => {
    const deps = makeDeps({
      submitOrderError: new Error('not enough funds'),
      payment: {
        id: 'pay1',
        userId: 'u1',
        status: 'PENDING',
        orders: [
          {
            id: 'o1',
            status: 'PENDING_PAYMENT',
            serviceId: 's1',
            link: 'l1',
            quantity: 100,
            price: 5,
          },
        ],
      },
    });
    // Single order here fails → refunded exactly once, no double credit on the path.
    await confirmOrderPayment(deps, 'pay1');
    expect(deps.refundToWallet).toHaveBeenCalledTimes(1);
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
