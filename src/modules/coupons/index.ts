import { getPrisma } from '../../shared/database';
import { createServiceLogger } from '../../shared/utils/logger';
import { createCouponsRepository } from './coupons.repository';
import { createCouponsService } from './coupons.service';

export type { CouponsService } from './coupons.service';
export { createCouponsService } from './coupons.service';
export { createCouponsRepository } from './coupons.repository';
export type { CouponsRepository } from './coupons.repository';

// Transitional shims for unconverted callers (orders). Delete when orders converts (phase F15).
let _transitionalService: ReturnType<typeof createCouponsService> | null = null;
function getTransitionalService(): ReturnType<typeof createCouponsService> {
  if (!_transitionalService) {
    _transitionalService = createCouponsService({
      couponsRepo: createCouponsRepository(getPrisma()),
      logger: createServiceLogger('coupons'),
    });
  }
  return _transitionalService;
}

export async function validateCoupon(
  code: string,
  orderAmount?: number,
): ReturnType<ReturnType<typeof createCouponsService>['validateCoupon']> {
  return getTransitionalService().validateCoupon(code, orderAmount);
}

export async function applyCoupon(couponId: string): Promise<void> {
  return getTransitionalService().applyCoupon(couponId);
}
