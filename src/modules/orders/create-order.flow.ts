import type { Logger } from 'pino';
import type { Prisma, PrismaClient } from '../../generated/prisma';
import { ValidationError } from '../../shared/errors';
import type { OutboxPort } from '../../shared/outbox';
import type { CouponsService } from '../coupons';
import type { OrdersRepository } from './orders.repository';
import type { ServicesRepository } from './service.repository';
import type { ProviderSelectorPort } from './ports/provider-selector.port';
import {
  calculatePrice,
  validateService,
  validateQuantity,
  applyOrderCoupon,
  warnIfProviderBalanceLow,
  handleOrderCreationFailure,
  mapOrderToDetailed,
} from './orders.helpers';
import type { CreateOrderInput, OrderDetailed, ServiceRecord } from './orders.types';

export interface CreateOrderFlowDeps {
  prisma: PrismaClient;
  ordersRepo: OrdersRepository;
  servicesRepo: ServicesRepository;
  billing: {
    holdFunds(userId: string, amount: number, orderId: string): Promise<void>;
    releaseFunds(userId: string, amount: number, orderId: string): Promise<void>;
  };
  providerSelector: ProviderSelectorPort;
  couponsService: CouponsService;
  outbox: OutboxPort;
  logger: Logger;
}

async function submitOrderToProvider(
  providerSelector: ProviderSelectorPort,
  params: {
    service: ServiceRecord;
    input: CreateOrderInput;
    isDripFeed: boolean;
    dripFeedRuns: number | undefined;
  },
): Promise<{ providerId: string | null; externalOrderId: string }> {
  const { service, input, isDripFeed, dripFeedRuns } = params;

  if (!service.providerId || !service.externalServiceId) {
    throw new ValidationError('Service provider info missing', 'SERVICE_PROVIDER_MISSING');
  }

  const { providerId, client } = await providerSelector.selectProviderById(service.providerId);

  const submitQuantity =
    isDripFeed && dripFeedRuns ? Math.ceil(input.quantity / dripFeedRuns) : input.quantity;

  const submitResult = await client.submitOrder({
    serviceId: service.externalServiceId,
    link: input.link,
    quantity: submitQuantity,
  });

  return { providerId, externalOrderId: submitResult.externalOrderId };
}

async function emitOrderCreatedEvents(
  tx: Prisma.TransactionClient,
  outbox: OutboxPort,
  params: {
    orderId: string;
    userId: string;
    status: string;
    price: number;
    couponId: string | null;
  },
): Promise<void> {
  const { orderId, userId, status, price, couponId } = params;

  await outbox.emit(
    {
      type: 'order.created',
      aggregateType: 'order',
      aggregateId: orderId,
      userId,
      payload: { orderId, userId, status, price },
    },
    tx,
  );

  if (couponId) {
    await outbox.emit(
      {
        type: 'coupon.used',
        aggregateType: 'order',
        aggregateId: orderId,
        userId,
        payload: { couponId, orderId },
      },
      tx,
    );
  }
}

export async function executeCreateOrder(
  deps: CreateOrderFlowDeps,
  userId: string,
  input: CreateOrderInput,
): Promise<OrderDetailed> {
  const {
    prisma,
    ordersRepo,
    servicesRepo,
    billing,
    providerSelector,
    couponsService,
    outbox,
    logger,
  } = deps;

  const service = await servicesRepo.findServiceById(input.serviceId);
  validateService(service);
  const validatedService = service as ServiceRecord;
  validateQuantity(input.quantity, validatedService.minQuantity, validatedService.maxQuantity);

  const basePrice = calculatePrice(input.quantity, Number(validatedService.pricePer1000));
  const { finalPrice, couponId, discount } = await applyOrderCoupon(
    couponsService.validateCoupon,
    input.couponCode,
    basePrice,
  );

  const isDripFeed = input.isDripFeed ?? false;
  const dripFeedRuns = isDripFeed ? input.dripFeedRuns : undefined;
  const dripFeedInterval = isDripFeed ? input.dripFeedInterval : undefined;

  await warnIfProviderBalanceLow(
    { providerSelector, logger },
    validatedService.providerId,
    finalPrice,
  );

  const order = await ordersRepo.createOrder({
    userId,
    serviceId: input.serviceId,
    link: input.link,
    quantity: input.quantity,
    price: finalPrice,
    isDripFeed,
    dripFeedRuns,
    dripFeedInterval,
    dripFeedRunsCompleted: isDripFeed ? 1 : 0,
    couponId,
    discount,
  });

  try {
    await billing.holdFunds(userId, finalPrice, order.id);

    const { providerId, externalOrderId } = await submitOrderToProvider(providerSelector, {
      service: validatedService,
      input,
      isDripFeed,
      dripFeedRuns,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const next = await ordersRepo.updateOrderStatus(order.id, {
        status: 'PROCESSING',
        externalOrderId,
        ...(providerId ? { providerId } : {}),
        remains: input.quantity,
      });

      await emitOrderCreatedEvents(tx, outbox, {
        orderId: order.id,
        userId,
        status: next.status,
        price: finalPrice,
        couponId,
      });

      return next;
    });

    logger.info(
      { userId, orderId: order.id, price: finalPrice, discount, isDripFeed },
      'Order created',
    );

    return mapOrderToDetailed(updated);
  } catch (error) {
    await handleOrderCreationFailure(
      { ordersRepo, releaseFunds: billing.releaseFunds, logger },
      { userId, orderId: order.id, price: finalPrice, error },
    );
    throw error;
  }
}
