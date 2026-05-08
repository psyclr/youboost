import type { Logger } from 'pino';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type { OrdersRepository, OrderRecord } from '../orders';
import type { AdminOrdersQuery, AdminOrderResponse, PaginatedAdminOrders } from './admin.types';

export interface AdminOrdersService {
  listAllOrders(query: AdminOrdersQuery): Promise<PaginatedAdminOrders>;
  getAnyOrder(orderId: string): Promise<AdminOrderResponse>;
  forceOrderStatus(orderId: string, status: string): Promise<AdminOrderResponse>;
  refundOrder(orderId: string): Promise<AdminOrderResponse>;
  pauseDripFeed(orderId: string): Promise<AdminOrderResponse>;
  resumeDripFeed(orderId: string): Promise<AdminOrderResponse>;
}

export interface AdminOrdersServiceDeps {
  ordersRepo: OrdersRepository;
  billing: {
    chargeFunds(userId: string, amount: number, orderId: string): Promise<void>;
    releaseFunds(userId: string, amount: number, orderId: string): Promise<void>;
    refundFunds(userId: string, amount: number, orderId: string): Promise<void>;
  };
  logger: Logger;
}

export function createAdminOrdersService(deps: AdminOrdersServiceDeps): AdminOrdersService {
  const { ordersRepo, billing, logger } = deps;

  async function settleFinances(
    ctx: { userId: string; amount: number; orderId: string },
    status: string,
  ): Promise<void> {
    const CHARGE_STATUSES = ['COMPLETED', 'PARTIAL'];
    const RELEASE_STATUSES = ['FAILED', 'CANCELLED'];

    if (CHARGE_STATUSES.includes(status)) {
      await billing.chargeFunds(ctx.userId, ctx.amount, ctx.orderId);
    } else if (RELEASE_STATUSES.includes(status)) {
      await billing.releaseFunds(ctx.userId, ctx.amount, ctx.orderId);
    } else if (status === 'REFUNDED') {
      await billing.releaseFunds(ctx.userId, ctx.amount, ctx.orderId);
      await billing.refundFunds(ctx.userId, ctx.amount, ctx.orderId);
    }
  }

  function toOrderResponse(record: OrderRecord): AdminOrderResponse {
    return {
      orderId: record.id,
      userId: record.userId,
      serviceId: record.serviceId,
      status: record.status,
      quantity: record.quantity,
      price: Number(record.price),
      link: record.link,
      startCount: record.startCount,
      remains: record.remains,
      isDripFeed: record.isDripFeed,
      dripFeedRuns: record.dripFeedRuns,
      dripFeedRunsCompleted: record.dripFeedRunsCompleted,
      dripFeedInterval: record.dripFeedInterval,
      dripFeedPausedAt: record.dripFeedPausedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      completedAt: record.completedAt,
    };
  }

  async function listAllOrders(query: AdminOrdersQuery): Promise<PaginatedAdminOrders> {
    const { orders, total } = await ordersRepo.findAllOrders({
      status: query.status,
      userId: query.userId,
      isDripFeed: query.isDripFeed,
      page: query.page,
      limit: query.limit,
    });

    const totalPages = Math.ceil(total / query.limit);

    logger.info({ page: query.page, total }, 'Listed all orders');

    return {
      orders: orders.map(toOrderResponse),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async function getAnyOrder(orderId: string): Promise<AdminOrderResponse> {
    const order = await ordersRepo.findOrderByIdAdmin(orderId);
    if (!order) {
      throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
    }

    logger.info({ orderId }, 'Fetched order detail');

    return toOrderResponse(order);
  }

  async function forceOrderStatus(orderId: string, status: string): Promise<AdminOrderResponse> {
    const order = await ordersRepo.findOrderByIdAdmin(orderId);
    if (!order) {
      throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
    }

    if (order.status === status) {
      throw new ValidationError('Order already has this status', 'STATUS_UNCHANGED');
    }

    // Settle finances based on status transition
    if (order.status === 'PROCESSING') {
      await settleFinances({ userId: order.userId, amount: Number(order.price), orderId }, status);
    }

    const TERMINAL = ['COMPLETED', 'PARTIAL', 'CANCELLED', 'FAILED', 'REFUNDED'];
    const completedAt = TERMINAL.includes(status) ? new Date() : undefined;

    const updated = await ordersRepo.updateOrderStatus(orderId, {
      status,
      completedAt: completedAt ?? null,
    });

    logger.info({ orderId, status }, 'Forced order status');

    return toOrderResponse(updated);
  }

  async function refundOrder(orderId: string): Promise<AdminOrderResponse> {
    const order = await ordersRepo.findOrderByIdAdmin(orderId);
    if (!order) {
      throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
    }

    if (order.status === 'REFUNDED') {
      throw new ValidationError('Order already refunded', 'ALREADY_REFUNDED');
    }

    const amount = Number(order.price);

    // Release hold first if order was still processing
    if (order.status === 'PROCESSING') {
      await billing.releaseFunds(order.userId, amount, orderId);
    }

    await billing.refundFunds(order.userId, amount, orderId);

    const updated = await ordersRepo.updateOrderStatus(orderId, {
      status: 'REFUNDED',
      completedAt: new Date(),
    });

    logger.info({ orderId, amount }, 'Refunded order');

    return toOrderResponse(updated);
  }

  async function pauseDripFeed(orderId: string): Promise<AdminOrderResponse> {
    const order = await ordersRepo.findOrderByIdAdmin(orderId);
    if (!order) {
      throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
    }
    if (!order.isDripFeed) {
      throw new ValidationError('Order is not a drip-feed order', 'NOT_DRIP_FEED');
    }
    if (order.status !== 'PROCESSING') {
      throw new ValidationError('Only processing orders can be paused', 'INVALID_STATUS');
    }
    if (order.dripFeedPausedAt) {
      throw new ValidationError('Order is already paused', 'ALREADY_PAUSED');
    }

    const updated = await ordersRepo.pauseDripFeed(orderId);
    logger.info({ orderId }, 'Drip-feed paused');
    return toOrderResponse(updated);
  }

  async function resumeDripFeed(orderId: string): Promise<AdminOrderResponse> {
    const order = await ordersRepo.findOrderByIdAdmin(orderId);
    if (!order) {
      throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
    }
    if (!order.isDripFeed) {
      throw new ValidationError('Order is not a drip-feed order', 'NOT_DRIP_FEED');
    }
    if (order.status !== 'PROCESSING') {
      throw new ValidationError('Only processing orders can be resumed', 'INVALID_STATUS');
    }
    if (!order.dripFeedPausedAt) {
      throw new ValidationError('Order is not paused', 'NOT_PAUSED');
    }

    const updated = await ordersRepo.resumeDripFeed(orderId);
    logger.info({ orderId }, 'Drip-feed resumed');
    return toOrderResponse(updated);
  }

  return {
    listAllOrders,
    getAnyOrder,
    forceOrderStatus,
    refundOrder,
    pauseDripFeed,
    resumeDripFeed,
  };
}
