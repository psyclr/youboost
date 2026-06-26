import type { Prisma, PrismaClient } from '../../generated/prisma';

export interface PaymentOrderItemInput {
  serviceId: string;
  link: string;
  quantity: number;
  price: number;
}

export interface CreatePaymentWithOrdersInput {
  userId: string;
  provider: 'STRIPE' | 'CRYPTOMUS';
  amount: number;
  items: PaymentOrderItemInput[];
  metrikaClientId?: string | null;
}

export interface PaymentWithOrders {
  id: string;
  userId: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  amount: number;
  metrikaClientId: string | null;
  orders: {
    id: string;
    status: string;
    serviceId: string;
    link: string;
    quantity: number;
    price?: number;
  }[];
}

export interface PaymentRepository {
  createPaymentWithOrders(
    input: CreatePaymentWithOrdersInput,
  ): Promise<{ paymentId: string; orderIds: string[] }>;
  findPaymentWithOrders(paymentId: string): Promise<PaymentWithOrders | null>;
  attachSession(paymentId: string, providerSessionId: string): Promise<void>;
  /**
   * Atomically claim a PENDING payment for settlement.
   * Returns true iff THIS call flipped the status from PENDING → PAID.
   * Returns false if the payment was already PAID or otherwise not PENDING,
   * meaning another concurrent delivery already claimed it — the caller must
   * NOT submit orders in that case.
   */
  claimPaymentForSettlement(paymentId: string): Promise<boolean>;
}

export function createPaymentRepository(prisma: PrismaClient): PaymentRepository {
  return {
    async createPaymentWithOrders(input): Promise<{ paymentId: string; orderIds: string[] }> {
      return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const payment = await tx.payment.create({
          data: {
            userId: input.userId,
            amount: input.amount,
            provider: input.provider,
            status: 'PENDING',
            metrikaClientId: input.metrikaClientId ?? null,
          },
        });
        const orderIds: string[] = [];
        for (const it of input.items) {
          const order = await tx.order.create({
            data: {
              userId: input.userId,
              serviceId: it.serviceId,
              link: it.link,
              quantity: it.quantity,
              price: it.price,
              status: 'PENDING_PAYMENT',
              paymentId: payment.id,
            },
          });
          orderIds.push(order.id);
        }
        return { paymentId: payment.id, orderIds };
      });
    },

    async findPaymentWithOrders(paymentId): Promise<PaymentWithOrders | null> {
      return prisma.payment.findUnique({
        where: { id: paymentId },
        include: { orders: true },
      }) as unknown as PaymentWithOrders | null;
    },

    async attachSession(paymentId, providerSessionId): Promise<void> {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { providerSessionId },
      });
    },

    async claimPaymentForSettlement(paymentId): Promise<boolean> {
      const res = await prisma.payment.updateMany({
        where: { id: paymentId, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date() },
      });
      return res.count === 1;
    },
  };
}
