import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type { OutboxPort } from '../../shared/outbox';
import type { ProviderSelectorPort } from './ports/provider-selector.port';
import type { CouponsService } from '../coupons';
import type { OrdersRepository } from './orders.repository';
import type { ServicesRepository } from './service.repository';
import { mapOrderToDetailed, mapOrderToResponse } from './orders.helpers';
import { executeCreateOrder } from './create-order.flow';
import { confirmGuestOrderPayment } from './confirm-guest-order.flow';
import type {
  CreateOrderInput,
  OrdersQuery,
  OrderDetailed,
  PaginatedOrders,
  CancelOrderResponse,
  BulkOrderInput,
  BulkOrderResult,
} from './orders.types';

export interface CreatePendingPaymentOrderInput {
  userId: string;
  serviceId: string;
  link: string;
  quantity: number;
  price: number;
}

export interface OrdersService {
  createOrder(userId: string, input: CreateOrderInput): Promise<OrderDetailed>;
  getOrder(userId: string, orderId: string): Promise<OrderDetailed>;
  listOrders(userId: string, query: OrdersQuery): Promise<PaginatedOrders>;
  cancelOrder(userId: string, orderId: string): Promise<CancelOrderResponse>;
  refillOrder(userId: string, orderId: string): Promise<OrderDetailed>;
  setRefillEligibility(orderId: string, refillDays: number): Promise<void>;
  createBulkOrders(userId: string, input: BulkOrderInput): Promise<BulkOrderResult>;
  createPendingPaymentOrder(input: CreatePendingPaymentOrderInput): Promise<{ orderId: string }>;
  attachStripeSessionId(orderId: string, sessionId: string): Promise<void>;
  confirmGuestOrderPayment(params: {
    orderId: string;
    userId: string;
    stripeSessionId: string;
  }): Promise<void>;
}

export interface OrdersServiceDeps {
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

const CANCELLABLE_STATUSES = new Set(['PENDING', 'PROCESSING']);

export function createOrdersService(deps: OrdersServiceDeps): OrdersService {
  const { prisma, ordersRepo, servicesRepo, billing, providerSelector, outbox, logger } = deps;

  async function createOrder(userId: string, input: CreateOrderInput): Promise<OrderDetailed> {
    return executeCreateOrder(deps, userId, input);
  }

  async function getOrder(userId: string, orderId: string): Promise<OrderDetailed> {
    const order = await ordersRepo.findOrderById(orderId, userId);
    if (!order) {
      throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
    }
    return mapOrderToDetailed(order);
  }

  async function listOrders(userId: string, query: OrdersQuery): Promise<PaginatedOrders> {
    const { orders, total } = await ordersRepo.findOrders(userId, {
      status: query.status,
      serviceId: query.serviceId,
      page: query.page,
      limit: query.limit,
    });

    return {
      orders: orders.map(mapOrderToResponse),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async function cancelOrder(userId: string, orderId: string): Promise<CancelOrderResponse> {
    const order = await ordersRepo.findOrderById(orderId, userId);
    if (!order) {
      throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
    }

    if (!CANCELLABLE_STATUSES.has(order.status)) {
      throw new ValidationError('Order cannot be cancelled', 'ORDER_NOT_CANCELLABLE');
    }

    const refundAmount = Number(order.price);
    // releaseFunds owns its own transaction (separate from status+outbox tx).
    await billing.releaseFunds(userId, refundAmount, orderId);

    const updated = await prisma.$transaction(async (tx) => {
      const next = await ordersRepo.updateOrderStatus(orderId, {
        status: 'CANCELLED',
        completedAt: new Date(),
      });

      await outbox.emit(
        {
          type: 'order.cancelled',
          aggregateType: 'order',
          aggregateId: orderId,
          userId,
          payload: { orderId, userId, refundAmount },
        },
        tx,
      );

      return next;
    });

    logger.info({ userId, orderId, refundAmount }, 'Order cancelled');

    return {
      orderId: updated.id,
      status: updated.status,
      refundAmount,
      cancelledAt: updated.completedAt ?? new Date(),
    };
  }

  async function refillOrder(userId: string, orderId: string): Promise<OrderDetailed> {
    const order = await ordersRepo.findOrderById(orderId, userId);
    if (!order) {
      throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
    }
    if (order.status !== 'COMPLETED') {
      throw new ValidationError('Only completed orders can be refilled', 'ORDER_NOT_COMPLETED');
    }
    if (!order.refillEligibleUntil || order.refillEligibleUntil < new Date()) {
      throw new ValidationError('Order is not eligible for refill', 'REFILL_EXPIRED');
    }

    const service = await servicesRepo.findServiceById(order.serviceId);
    if (!service?.providerId || !service?.externalServiceId) {
      throw new ValidationError('Service is no longer available for refill', 'SERVICE_UNAVAILABLE');
    }

    // Create a new order at $0 for the refill
    const refillOrderRecord = await ordersRepo.createOrder({
      userId,
      serviceId: order.serviceId,
      link: order.link,
      quantity: order.quantity,
      price: 0,
    });

    const { providerId, client } = await providerSelector.selectProviderById(service.providerId);
    const submitResult = await client.submitOrder({
      serviceId: service.externalServiceId,
      link: order.link,
      quantity: order.quantity,
    });

    const updated = await ordersRepo.updateOrderStatus(refillOrderRecord.id, {
      status: 'PROCESSING',
      externalOrderId: submitResult.externalOrderId,
      ...(providerId ? { providerId } : {}),
      remains: order.quantity,
    });

    await ordersRepo.incrementRefillCount(orderId);

    logger.info({ userId, orderId, refillOrderId: refillOrderRecord.id }, 'Order refill created');
    return mapOrderToDetailed(updated);
  }

  async function setRefillEligibility(orderId: string, refillDays: number): Promise<void> {
    const eligibleUntil = new Date();
    eligibleUntil.setDate(eligibleUntil.getDate() + refillDays);
    await ordersRepo.updateOrderStatus(orderId, {
      status: 'COMPLETED',
      refillEligibleUntil: eligibleUntil,
      completedAt: new Date(),
    });
  }

  async function createBulkOrders(userId: string, input: BulkOrderInput): Promise<BulkOrderResult> {
    const results: BulkOrderResult['results'] = [];

    for (const item of input.links) {
      try {
        const order = await createOrder(userId, {
          serviceId: input.serviceId,
          link: item.link,
          quantity: item.quantity ?? input.defaultQuantity,
          isDripFeed: false,
          comments: input.comments,
        });
        results.push({ link: item.link, orderId: order.orderId, status: 'success' });
      } catch (error) {
        results.push({
          link: item.link,
          orderId: null,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const totalCreated = results.filter((r) => r.status === 'success').length;
    const totalFailed = results.length - totalCreated;
    logger.info({ userId, totalCreated, totalFailed }, 'Bulk orders created');

    return { results, totalCreated, totalFailed };
  }

  async function createPendingPaymentOrder(
    input: CreatePendingPaymentOrderInput,
  ): Promise<{ orderId: string }> {
    const order = await ordersRepo.createOrder({
      userId: input.userId,
      serviceId: input.serviceId,
      link: input.link,
      quantity: input.quantity,
      price: input.price,
      status: 'PENDING_PAYMENT',
    });
    logger.info({ orderId: order.id, userId: input.userId }, 'Pending-payment order created');
    return { orderId: order.id };
  }

  async function attachStripeSessionId(orderId: string, sessionId: string): Promise<void> {
    await ordersRepo.attachStripeSession(orderId, sessionId);
  }

  async function confirmGuest(params: {
    orderId: string;
    userId: string;
    stripeSessionId: string;
  }): Promise<void> {
    await confirmGuestOrderPayment(
      { prisma, ordersRepo, servicesRepo, providerSelector, outbox, logger },
      params,
    );
  }

  return {
    createOrder,
    getOrder,
    listOrders,
    cancelOrder,
    refillOrder,
    setRefillEligibility,
    createBulkOrders,
    createPendingPaymentOrder,
    attachStripeSessionId,
    confirmGuestOrderPayment: confirmGuest,
  };
}
