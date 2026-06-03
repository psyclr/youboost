import { createPaymentRepository } from '../payment.repository';

interface FakePrisma {
  payment: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  order: { create: jest.Mock };
  $transaction: jest.Mock;
}

function fakePrisma(): FakePrisma {
  const prisma: FakePrisma = {
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    order: { create: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: FakePrisma) => unknown) => fn(prisma)),
  };
  return prisma;
}

describe('payment repository', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  beforeEach(() => {
    prisma = fakePrisma();
  });

  it('createPaymentWithOrders creates a payment then N orders linked by paymentId', async () => {
    prisma.payment.create.mockResolvedValue({ id: 'pay1' });
    prisma.order.create.mockResolvedValueOnce({ id: 'o1' }).mockResolvedValueOnce({ id: 'o2' });

    const repo = createPaymentRepository(prisma as never);
    const res = await repo.createPaymentWithOrders({
      userId: 'u1',
      provider: 'STRIPE',
      amount: 5,
      items: [
        { serviceId: 's1', link: 'l1', quantity: 100, price: 2 },
        { serviceId: 's2', link: 'l2', quantity: 300, price: 3 },
      ],
    });

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          amount: 5,
          provider: 'STRIPE',
          status: 'PENDING',
        }),
      }),
    );
    expect(prisma.order.create).toHaveBeenCalledTimes(2);
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceId: 's1',
          link: 'l1',
          quantity: 100,
          price: 2,
          status: 'PENDING_PAYMENT',
          paymentId: 'pay1',
        }),
      }),
    );
    expect(res).toEqual({ paymentId: 'pay1', orderIds: ['o1', 'o2'] });
  });

  it('findPaymentWithOrders includes orders', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay1',
      userId: 'u1',
      status: 'PENDING',
      orders: [],
    });
    const repo = createPaymentRepository(prisma as never);
    const p = await repo.findPaymentWithOrders('pay1');
    expect(prisma.payment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pay1' }, include: { orders: true } }),
    );
    expect(p).toEqual(expect.objectContaining({ id: 'pay1' }));
  });

  it('attachSession sets providerSessionId', async () => {
    const repo = createPaymentRepository(prisma as never);
    await repo.attachSession('pay1', 'sess_1');
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay1' },
        data: expect.objectContaining({ providerSessionId: 'sess_1' }),
      }),
    );
  });

  it('claimPaymentForSettlement returns true when updateMany flips one row', async () => {
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    const repo = createPaymentRepository(prisma as never);
    const result = await repo.claimPaymentForSettlement('pay1');
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'PAID', paidAt: expect.any(Date) }),
      }),
    );
    expect(result).toBe(true);
  });

  it('claimPaymentForSettlement returns false when updateMany flips zero rows (already claimed)', async () => {
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });
    const repo = createPaymentRepository(prisma as never);
    const result = await repo.claimPaymentForSettlement('pay1');
    expect(result).toBe(false);
  });
});
