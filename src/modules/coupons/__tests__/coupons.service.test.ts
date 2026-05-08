import { createCouponsService } from '../coupons.service';
import { createFakeCouponsRepository, silentLogger } from './fakes';
import type { Coupon } from '../../../generated/prisma';

const baseCoupon = {
  id: 'coupon-1',
  code: 'SAVE10',
  discountType: 'PERCENTAGE',
  discountValue: 10,
  maxUses: 100,
  usedCount: 5,
  minOrderAmount: null,
  expiresAt: null,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as Coupon;

describe('Coupons Service', () => {
  describe('createCoupon', () => {
    it('should create a coupon successfully', async () => {
      const couponsRepo = createFakeCouponsRepository();
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      const result = await service.createCoupon({
        code: 'SAVE10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        maxUses: 100,
      });

      expect(result.code).toBe('SAVE10');
      expect(result.discountType).toBe('PERCENTAGE');
      expect(result.discountValue).toBe(10);
      expect(result.maxUses).toBe(100);
      expect(couponsRepo.calls.findCouponByCode).toEqual(['SAVE10']);
      expect(couponsRepo.calls.createCoupon).toHaveLength(1);
    });

    it('should throw ConflictError when code already exists', async () => {
      const couponsRepo = createFakeCouponsRepository({ coupons: [baseCoupon] });
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      await expect(
        service.createCoupon({
          code: 'SAVE10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
        }),
      ).rejects.toThrow('Coupon code already exists');
      expect(couponsRepo.calls.createCoupon).toHaveLength(0);
    });

    it('should throw ValidationError when percentage exceeds 100', async () => {
      const couponsRepo = createFakeCouponsRepository();
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      await expect(
        service.createCoupon({
          code: 'BAD',
          discountType: 'PERCENTAGE',
          discountValue: 150,
        }),
      ).rejects.toThrow('Percentage discount cannot exceed 100');
      expect(couponsRepo.calls.createCoupon).toHaveLength(0);
    });

    it('should allow fixed discount of any positive amount', async () => {
      const couponsRepo = createFakeCouponsRepository();
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      const result = await service.createCoupon({
        code: 'BIG500',
        discountType: 'FIXED',
        discountValue: 500,
      });

      expect(result.discountValue).toBe(500);
      expect(result.discountType).toBe('FIXED');
    });
  });

  describe('validateCoupon', () => {
    it('should return valid result for active coupon', async () => {
      const couponsRepo = createFakeCouponsRepository({ coupons: [baseCoupon] });
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      const result = await service.validateCoupon('SAVE10', 50);

      expect(result.valid).toBe(true);
      expect(result.discount).toBe(5); // 10% of 50
      expect(result.couponId).toBe('coupon-1');
      expect(result.discountType).toBe('PERCENTAGE');
      expect(result.discountValue).toBe(10);
    });

    it('should return invalid for non-existent coupon', async () => {
      const couponsRepo = createFakeCouponsRepository();
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      const result = await service.validateCoupon('NONEXISTENT');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Coupon not found');
    });

    it('should return invalid for inactive coupon', async () => {
      const inactiveCoupon = { ...baseCoupon, isActive: false } as Coupon;
      const couponsRepo = createFakeCouponsRepository({ coupons: [inactiveCoupon] });
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      const result = await service.validateCoupon('SAVE10');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Coupon is inactive');
    });

    it('should return invalid for expired coupon', async () => {
      const expiredCoupon = { ...baseCoupon, expiresAt: new Date('2020-01-01') } as Coupon;
      const couponsRepo = createFakeCouponsRepository({ coupons: [expiredCoupon] });
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      const result = await service.validateCoupon('SAVE10');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Coupon has expired');
    });

    it('should return invalid when usage limit reached', async () => {
      const maxedCoupon = { ...baseCoupon, maxUses: 5, usedCount: 5 } as Coupon;
      const couponsRepo = createFakeCouponsRepository({ coupons: [maxedCoupon] });
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      const result = await service.validateCoupon('SAVE10');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Coupon usage limit reached');
    });

    it('should return invalid when order below minimum', async () => {
      const minCoupon = { ...baseCoupon, minOrderAmount: 25 } as unknown as Coupon;
      const couponsRepo = createFakeCouponsRepository({ coupons: [minCoupon] });
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      const result = await service.validateCoupon('SAVE10', 10);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Minimum order amount is $25.00');
    });

    it('should calculate fixed discount capped at order amount', async () => {
      const fixedCoupon = {
        ...baseCoupon,
        discountType: 'FIXED',
        discountValue: 50,
      } as unknown as Coupon;
      const couponsRepo = createFakeCouponsRepository({ coupons: [fixedCoupon] });
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      const result = await service.validateCoupon('SAVE10', 30);

      expect(result.valid).toBe(true);
      expect(result.discount).toBe(30); // capped at order amount
    });

    it('should calculate percentage discount', async () => {
      const pctCoupon = {
        ...baseCoupon,
        discountType: 'PERCENTAGE',
        discountValue: 25,
      } as unknown as Coupon;
      const couponsRepo = createFakeCouponsRepository({ coupons: [pctCoupon] });
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      const result = await service.validateCoupon('SAVE10', 80);

      expect(result.valid).toBe(true);
      expect(result.discount).toBe(20); // 25% of 80
    });

    it('should return 0 discount when no order amount provided', async () => {
      const couponsRepo = createFakeCouponsRepository({ coupons: [baseCoupon] });
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      const result = await service.validateCoupon('SAVE10');

      expect(result.valid).toBe(true);
      expect(result.discount).toBe(0);
    });
  });

  describe('applyCoupon', () => {
    it('should increment usage count', async () => {
      const couponsRepo = createFakeCouponsRepository({ coupons: [baseCoupon] });
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      await service.applyCoupon('coupon-1');

      expect(couponsRepo.calls.incrementUsedCount).toEqual(['coupon-1']);
    });

    it('should throw NotFoundError for non-existent coupon', async () => {
      const couponsRepo = createFakeCouponsRepository();
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      await expect(service.applyCoupon('nonexistent')).rejects.toThrow('Coupon not found');
      expect(couponsRepo.calls.incrementUsedCount).toHaveLength(0);
    });
  });

  describe('listCoupons', () => {
    it('should return paginated coupons', async () => {
      const couponsRepo = createFakeCouponsRepository({
        listResult: { coupons: [baseCoupon], total: 1 },
      });
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      const result = await service.listCoupons({ page: 1, limit: 20 });

      expect(result.coupons).toHaveLength(1);
      expect(result.coupons[0]?.code).toBe('SAVE10');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should pass isActive filter', async () => {
      const couponsRepo = createFakeCouponsRepository({
        listResult: { coupons: [], total: 0 },
      });
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      await service.listCoupons({ page: 1, limit: 20, isActive: true });

      expect(couponsRepo.calls.listCoupons).toEqual([
        {
          page: 1,
          limit: 20,
          isActive: true,
        },
      ]);
    });

    it('should calculate totalPages correctly', async () => {
      const couponsRepo = createFakeCouponsRepository({
        listResult: { coupons: [], total: 45 },
      });
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      const result = await service.listCoupons({ page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('deactivateCoupon', () => {
    it('should deactivate existing coupon', async () => {
      const couponsRepo = createFakeCouponsRepository({ coupons: [baseCoupon] });
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      await service.deactivateCoupon('coupon-1');

      expect(couponsRepo.calls.deactivateCoupon).toEqual(['coupon-1']);
    });

    it('should throw NotFoundError for non-existent coupon', async () => {
      const couponsRepo = createFakeCouponsRepository();
      const service = createCouponsService({ couponsRepo, logger: silentLogger });

      await expect(service.deactivateCoupon('nonexistent')).rejects.toThrow('Coupon not found');
      expect(couponsRepo.calls.deactivateCoupon).toHaveLength(0);
    });
  });
});
