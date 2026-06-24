import type { Logger } from 'pino';
import type { OutboxHandler } from '../../../shared/outbox';
import type { NotificationsService } from '../notifications.service';
import { orderFailedEmail } from '../utils/email-templates';

interface HandlerDeps {
  notificationsService: NotificationsService;
  logger: Logger;
}

export function createOrderCreatedEmailHandler(deps: HandlerDeps): OutboxHandler<'order.created'> {
  const { notificationsService, logger } = deps;
  return {
    eventType: 'order.created',
    name: 'order-created-email',
    async handle(event): Promise<void> {
      logger.debug({ orderId: event.payload.orderId }, 'sending order.created email');
      await notificationsService.sendNotification({
        userId: event.userId,
        type: 'EMAIL',
        channel: 'user-email',
        subject: 'Order Created',
        body: `Your order ${event.payload.orderId} has been created.`,
        eventType: 'order.created',
        referenceType: 'order',
        referenceId: event.payload.orderId,
      });
    },
  };
}

export function createOrderCancelledEmailHandler(
  deps: HandlerDeps,
): OutboxHandler<'order.cancelled'> {
  const { notificationsService, logger } = deps;
  return {
    eventType: 'order.cancelled',
    name: 'order-cancelled-email',
    async handle(event): Promise<void> {
      logger.debug({ orderId: event.payload.orderId }, 'sending order.cancelled email');
      await notificationsService.sendNotification({
        userId: event.userId,
        type: 'EMAIL',
        channel: 'user-email',
        subject: 'Order Cancelled',
        body: `Your order ${event.payload.orderId} has been cancelled. Refund: $${event.payload.refundAmount}.`,
        eventType: 'order.cancelled',
        referenceType: 'order',
        referenceId: event.payload.orderId,
      });
    },
  };
}

export function createOrderCompletedEmailHandler(
  deps: HandlerDeps,
): OutboxHandler<'order.completed'> {
  const { notificationsService, logger } = deps;
  return {
    eventType: 'order.completed',
    name: 'order-completed-email',
    async handle(event): Promise<void> {
      logger.debug({ orderId: event.payload.orderId }, 'sending order.completed email');
      await notificationsService.sendNotification({
        userId: event.userId,
        type: 'EMAIL',
        channel: 'user-email',
        subject: 'Order Completed',
        body: `Your order ${event.payload.orderId} status: COMPLETED.`,
        eventType: 'order.completed',
        referenceType: 'order',
        referenceId: event.payload.orderId,
      });
    },
  };
}

export function createOrderFailedEmailHandler(deps: HandlerDeps): OutboxHandler<'order.failed'> {
  const { notificationsService, logger } = deps;
  return {
    eventType: 'order.failed',
    name: 'order-failed-email',
    async handle(event): Promise<void> {
      logger.debug({ orderId: event.payload.orderId }, 'sending order.failed email');
      const { subject, body } = orderFailedEmail({
        orderId: event.payload.orderId,
        reason: event.payload.reason,
        ...(typeof event.payload.refundAmount === 'number'
          ? { refundAmount: event.payload.refundAmount }
          : {}),
      });
      await notificationsService.sendNotification({
        userId: event.userId,
        type: 'EMAIL',
        channel: 'user-email',
        subject,
        body,
        eventType: 'order.failed',
        referenceType: 'order',
        referenceId: event.payload.orderId,
      });
    },
  };
}

export function createOrderPartialEmailHandler(deps: HandlerDeps): OutboxHandler<'order.partial'> {
  const { notificationsService, logger } = deps;
  return {
    eventType: 'order.partial',
    name: 'order-partial-email',
    async handle(event): Promise<void> {
      logger.debug({ orderId: event.payload.orderId }, 'sending order.partial email');
      await notificationsService.sendNotification({
        userId: event.userId,
        type: 'EMAIL',
        channel: 'user-email',
        subject: 'Order Partially Completed',
        body: `Your order ${event.payload.orderId} status: PARTIAL.`,
        eventType: 'order.partial',
        referenceType: 'order',
        referenceId: event.payload.orderId,
      });
    },
  };
}
