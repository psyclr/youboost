import type { Logger } from 'pino';
import type { OutboxHandler } from '../../../shared/outbox';
import type { CouponsService } from '../coupons.service';

interface HandlerDeps {
  couponsService: CouponsService;
  logger: Logger;
}

export function createCouponUsedHandler(deps: HandlerDeps): OutboxHandler<'coupon.used'> {
  const { couponsService, logger } = deps;
  return {
    eventType: 'coupon.used',
    name: 'coupon-used',
    async handle(event): Promise<void> {
      logger.debug(
        { couponId: event.payload.couponId, orderId: event.payload.orderId },
        'applying coupon usage',
      );
      await couponsService.applyCoupon(event.payload.couponId);
    },
  };
}
