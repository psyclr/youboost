import { confirmOrderPayment, type ConfirmOrderPaymentDeps } from '../confirm-order-payment.flow';
import type { PaymentWithOrders } from '../../billing/payment.repository';
import {
  createFakeOrdersRepository,
  createFakeServicesRepository,
  createFakeProviderSelector,
  createFakeProviderClient,
  createFakeOutbox,
  createFakePrisma,
  makeServiceRecord,
  silentLogger,
} from './fakes';

interface MakeDepsOptions {
  payment: PaymentWithOrders | null;
}

function makeDeps(opts: MakeDepsOptions): ConfirmOrderPaymentDeps & {
  submitted: string[];
  paymentRepo: {
    findPaymentWithOrders: jest.Mock;
    markPaymentPaid: jest.Mock;
    createPaymentWithOrders: jest.Mock;
    attachSession: jest.Mock;
  };
} {
  const submitted: string[] = [];
  const client = createFakeProviderClient({
    submitOrder: jest.fn(async () => ({ externalOrderId: 'ext-1', status: 'processing' })),
  });
  const providerSelector = createFakeProviderSelector({ client });
  // Record which orders are submitted by wrapping updateOrderStatus to PROCESSING.
  const ordersRepo = createFakeOrdersRepository();
  const originalUpdate = ordersRepo.updateOrderStatus.bind(ordersRepo);
  ordersRepo.updateOrderStatus = async (orderId, data) => {
    if (data.status === 'PROCESSING') submitted.push(orderId);
    // Seed a record so the fake doesn't throw on missing order.
    ordersRepo.orders.push({ id: orderId } as never);
    try {
      return await originalUpdate(orderId, data);
    } catch {
      return { id: orderId } as never;
    }
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
    markPaymentPaid: jest.fn(async () => undefined),
    createPaymentWithOrders: jest.fn(),
    attachSession: jest.fn(),
  };

  return {
    submitted,
    paymentRepo,
    prisma: prisma.client,
    ordersRepo,
    servicesRepo,
    providerSelector,
    outbox: outbox.port,
    logger: silentLogger,
  };
}

describe('confirmOrderPayment', () => {
  it('marks payment PAID and submits every PENDING_PAYMENT order', async () => {
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
    expect(deps.paymentRepo.markPaymentPaid).toHaveBeenCalledWith('pay1');
    expect(deps.submitted).toEqual(['o1', 'o2']);
  });

  it('is idempotent: already-PAID payment is a no-op', async () => {
    const deps = makeDeps({
      payment: { id: 'pay1', userId: 'u1', status: 'PAID', orders: [] },
    });
    await confirmOrderPayment(deps, 'pay1');
    expect(deps.paymentRepo.markPaymentPaid).not.toHaveBeenCalled();
    expect(deps.submitted).toEqual([]);
  });

  it('skips orders already past PENDING_PAYMENT (partial-failure re-run)', async () => {
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

  it('throws when the payment does not exist', async () => {
    const deps = makeDeps({ payment: null });
    await expect(confirmOrderPayment(deps, 'missing')).rejects.toThrow(/Payment not found/);
  });
});
