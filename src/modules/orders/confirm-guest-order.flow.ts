import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type { OutboxPort } from '../../shared/outbox';
import type { OrdersRepository } from './orders.repository';
import type { ServicesRepository } from './service.repository';
import type { ProviderSelectorPort } from './ports/provider-selector.port';

export interface ConfirmGuestOrderDeps {
  prisma: PrismaClient;
  ordersRepo: OrdersRepository;
  servicesRepo: ServicesRepository;
  providerSelector: ProviderSelectorPort;
  outbox: OutboxPort;
  logger: Logger;
}

export interface ConfirmGuestOrderInput {
  orderId: string;
  userId: string;
  stripeSessionId: string;
}

/**
 * Invoked by Stripe webhook when a guest-order session completes.
 * Idempotent: if the order is already past PENDING_PAYMENT, returns
 * without error.
 */
export async function confirmGuestOrderPayment(
  deps: ConfirmGuestOrderDeps,
  input: ConfirmGuestOrderInput,
): Promise<void> {
  const { prisma, ordersRepo, servicesRepo, providerSelector, outbox, logger } = deps;

  const existing = await ordersRepo.findOrderByStripeSessionId(input.stripeSessionId);
  if (!existing) {
    throw new NotFoundError('Order not found for Stripe session', 'ORDER_NOT_FOUND');
  }
  if (existing.id !== input.orderId || existing.userId !== input.userId) {
    throw new ValidationError('Order metadata mismatch', 'ORDER_METADATA_MISMATCH');
  }
  if (existing.status !== 'PENDING_PAYMENT') {
    logger.info(
      { orderId: existing.id, status: existing.status },
      'Guest order already processed — skipping',
    );
    return;
  }

  const service = await servicesRepo.findServiceById(existing.serviceId);
  if (!service?.providerId || !service?.externalServiceId) {
    throw new ValidationError('Service provider info missing', 'SERVICE_PROVIDER_MISSING');
  }

  const { providerId, client } = await providerSelector.selectProviderById(service.providerId);
  const submitResult = await client.submitOrder({
    serviceId: service.externalServiceId,
    link: existing.link,
    quantity: existing.quantity,
  });

  await prisma.$transaction(async (tx) => {
    await ordersRepo.updateOrderStatus(existing.id, {
      status: 'PROCESSING',
      externalOrderId: submitResult.externalOrderId,
      ...(providerId ? { providerId } : {}),
      remains: existing.quantity,
    });
    await outbox.emit(
      {
        type: 'order.created',
        aggregateType: 'order',
        aggregateId: existing.id,
        userId: existing.userId,
        payload: {
          orderId: existing.id,
          userId: existing.userId,
          status: 'PROCESSING',
          price: Number(existing.price),
        },
      },
      tx,
    );
  });

  logger.info(
    {
      orderId: existing.id,
      userId: existing.userId,
      externalOrderId: submitResult.externalOrderId,
    },
    'Guest order confirmed + submitted',
  );
}
