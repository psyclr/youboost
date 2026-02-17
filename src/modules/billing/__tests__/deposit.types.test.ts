import {
  createDepositSchema,
  confirmDepositSchema,
  depositIdSchema,
  depositsQuerySchema,
} from '../deposit.types';

describe('Deposit Types', () => {
  describe('createDepositSchema', () => {
    it('should accept valid input', () => {
      const result = createDepositSchema.safeParse({ amount: 50, cryptoCurrency: 'USDT' });
      expect(result.success).toBe(true);
    });

    it('should accept BTC', () => {
      const result = createDepositSchema.safeParse({ amount: 100, cryptoCurrency: 'BTC' });
      expect(result.success).toBe(true);
    });

    it('should accept ETH', () => {
      const result = createDepositSchema.safeParse({ amount: 10, cryptoCurrency: 'ETH' });
      expect(result.success).toBe(true);
    });

    it('should reject amount below 10', () => {
      const result = createDepositSchema.safeParse({ amount: 5, cryptoCurrency: 'USDT' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid crypto currency', () => {
      const result = createDepositSchema.safeParse({ amount: 50, cryptoCurrency: 'DOGE' });
      expect(result.success).toBe(false);
    });

    it('should reject missing amount', () => {
      const result = createDepositSchema.safeParse({ cryptoCurrency: 'USDT' });
      expect(result.success).toBe(false);
    });

    it('should reject missing cryptoCurrency', () => {
      const result = createDepositSchema.safeParse({ amount: 50 });
      expect(result.success).toBe(false);
    });
  });

  describe('confirmDepositSchema', () => {
    it('should accept valid txHash', () => {
      const result = confirmDepositSchema.safeParse({ txHash: '0xabc123' });
      expect(result.success).toBe(true);
    });

    it('should reject empty txHash', () => {
      const result = confirmDepositSchema.safeParse({ txHash: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing txHash', () => {
      const result = confirmDepositSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('depositIdSchema', () => {
    it('should accept valid UUID', () => {
      const result = depositIdSchema.safeParse({
        depositId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = depositIdSchema.safeParse({ depositId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    it('should reject missing depositId', () => {
      const result = depositIdSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('depositsQuerySchema', () => {
    it('should accept empty query with defaults', () => {
      const result = depositsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should accept valid status PENDING', () => {
      const result = depositsQuerySchema.safeParse({ status: 'PENDING' });
      expect(result.success).toBe(true);
    });

    it('should accept valid status CONFIRMED', () => {
      const result = depositsQuerySchema.safeParse({ status: 'CONFIRMED' });
      expect(result.success).toBe(true);
    });

    it('should accept valid status EXPIRED', () => {
      const result = depositsQuerySchema.safeParse({ status: 'EXPIRED' });
      expect(result.success).toBe(true);
    });

    it('should accept valid status FAILED', () => {
      const result = depositsQuerySchema.safeParse({ status: 'FAILED' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = depositsQuerySchema.safeParse({ status: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('should reject page below 1', () => {
      const result = depositsQuerySchema.safeParse({ page: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject limit above 100', () => {
      const result = depositsQuerySchema.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
    });

    it('should coerce string numbers', () => {
      const result = depositsQuerySchema.safeParse({ page: '2', limit: '10' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(10);
      }
    });
  });
});
