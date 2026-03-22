import {
  createCoupon,
  validateCoupon,
  applyCoupon,
  listCoupons,
  deactivateCoupon,
} from '../coupons.service';

const mockCreateCoupon = jest.fn();
const mockFindCouponByCode = jest.fn();
const mockFindCouponById = jest.fn();
const mockListCoupons = jest.fn();
const mockIncrementUsedCount = jest.fn();
const mockDeactivateCoupon = jest.fn();

jest.mock('../coupons.repository', () => ({
  createCoupon: (...args: unknown[]): unknown => mockCreateCoupon(...args),
  findCouponByCode: (...args: unknown[]): unknown => mockFindCouponByCode(...args),
  findCouponById: (...args: unknown[]): unknown => mockFindCouponById(...args),
  listCoupons: (...args: unknown[]): unknown => mockListCoupons(...args),
  incrementUsedCount: (...args: unknown[]): unknown => mockIncrementUsedCount(...args),
  deactivateCoupon: (...args: unknown[]): unknown => mockDeactivateCoupon(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

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
};

describe('Coupons Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCoupon', () => {
    it('should create a coupon successfully', async () => {
      mockFindCouponByCode.mockResolvedValue(null);
      mockCreateCoupon.mockResolvedValue(baseCoupon);

      const result = await createCoupon({
        code: 'SAVE10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        maxUses: 100,
      });

      expect(result.id).toBe('coupon-1');
      expect(result.code).toBe('SAVE10');
      expect(result.discountType).toBe('PERCENTAGE');
      expect(result.discountValue).toBe(10);
    });

    it('should throw ConflictError when code already exists', async () => {
      mockFindCouponByCode.mockResolvedValue(baseCoupon);

      await expect(
        createCoupon({
          code: 'SAVE10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
        }),
      ).rejects.toThrow('Coupon code already exists');
    });

    it('should throw ValidationError when percentage exceeds 100', async () => {
      mockFindCouponByCode.mockResolvedValue(null);

      await expect(
        createCoupon({
          code: 'BAD',
          discountType: 'PERCENTAGE',
          discountValue: 150,
        }),
      ).rejects.toThrow('Percentage discount cannot exceed 100');
    });

    it('should allow fixed discount of any positive amount', async () => {
      mockFindCouponByCode.mockResolvedValue(null);
      mockCreateCoupon.mockResolvedValue({
        ...baseCoupon,
        discountType: 'FIXED',
        discountValue: 500,
      });

      const result = await createCoupon({
        code: 'BIG500',
        discountType: 'FIXED',
        discountValue: 500,
      });

      expect(result.discountValue).toBe(500);
    });
  });

  describe('validateCoupon', () => {
    it('should return valid result for active coupon', async () => {
      mockFindCouponByCode.mockResolvedValue(baseCoupon);

      const result = await validateCoupon('SAVE10', 50);

      expect(result.valid).toBe(true);
      expect(result.discount).toBe(5); // 10% of 50
      expect(result.couponId).toBe('coupon-1');
      expect(result.discountType).toBe('PERCENTAGE');
      expect(result.discountValue).toBe(10);
    });

    it('should return invalid for non-existent coupon', async () => {
      mockFindCouponByCode.mockResolvedValue(null);

      const result = await validateCoupon('NONEXISTENT');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Coupon not found');
    });

    it('should return invalid for inactive coupon', async () => {
      mockFindCouponByCode.mockResolvedValue({ ...baseCoupon, isActive: false });

      const result = await validateCoupon('SAVE10');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Coupon is inactive');
    });

    it('should return invalid for expired coupon', async () => {
      mockFindCouponByCode.mockResolvedValue({
        ...baseCoupon,
        expiresAt: new Date('2020-01-01'),
      });

      const result = await validateCoupon('SAVE10');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Coupon has expired');
    });

    it('should return invalid when usage limit reached', async () => {
      mockFindCouponByCode.mockResolvedValue({
        ...baseCoupon,
        maxUses: 5,
        usedCount: 5,
      });

      const result = await validateCoupon('SAVE10');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Coupon usage limit reached');
    });

    it('should return invalid when order below minimum', async () => {
      mockFindCouponByCode.mockResolvedValue({
        ...baseCoupon,
        minOrderAmount: 25,
      });

      const result = await validateCoupon('SAVE10', 10);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Minimum order amount is $25.00');
    });

    it('should calculate fixed discount capped at order amount', async () => {
      mockFindCouponByCode.mockResolvedValue({
        ...baseCoupon,
        discountType: 'FIXED',
        discountValue: 50,
      });

      const result = await validateCoupon('SAVE10', 30);

      expect(result.valid).toBe(true);
      expect(result.discount).toBe(30); // capped at order amount
    });

    it('should calculate percentage discount', async () => {
      mockFindCouponByCode.mockResolvedValue({
        ...baseCoupon,
        discountType: 'PERCENTAGE',
        discountValue: 25,
      });

      const result = await validateCoupon('SAVE10', 80);

      expect(result.valid).toBe(true);
      expect(result.discount).toBe(20); // 25% of 80
    });

    it('should return 0 discount when no order amount provided', async () => {
      mockFindCouponByCode.mockResolvedValue(baseCoupon);

      const result = await validateCoupon('SAVE10');

      expect(result.valid).toBe(true);
      expect(result.discount).toBe(0);
    });
  });

  describe('applyCoupon', () => {
    it('should increment usage count', async () => {
      mockFindCouponById.mockResolvedValue(baseCoupon);

      await applyCoupon('coupon-1');

      expect(mockIncrementUsedCount).toHaveBeenCalledWith('coupon-1');
    });

    it('should throw NotFoundError for non-existent coupon', async () => {
      mockFindCouponById.mockResolvedValue(null);

      await expect(applyCoupon('nonexistent')).rejects.toThrow('Coupon not found');
    });
  });

  describe('listCoupons', () => {
    it('should return paginated coupons', async () => {
      mockListCoupons.mockResolvedValue({
        coupons: [baseCoupon],
        total: 1,
      });

      const result = await listCoupons({ page: 1, limit: 20 });

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
      mockListCoupons.mockResolvedValue({ coupons: [], total: 0 });

      await listCoupons({ page: 1, limit: 20, isActive: true });

      expect(mockListCoupons).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        isActive: true,
      });
    });

    it('should calculate totalPages correctly', async () => {
      mockListCoupons.mockResolvedValue({ coupons: [], total: 45 });

      const result = await listCoupons({ page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('deactivateCoupon', () => {
    it('should deactivate existing coupon', async () => {
      mockFindCouponById.mockResolvedValue(baseCoupon);

      await deactivateCoupon('coupon-1');

      expect(mockDeactivateCoupon).toHaveBeenCalledWith('coupon-1');
    });

    it('should throw NotFoundError for non-existent coupon', async () => {
      mockFindCouponById.mockResolvedValue(null);

      await expect(deactivateCoupon('nonexistent')).rejects.toThrow('Coupon not found');
    });
  });
});
