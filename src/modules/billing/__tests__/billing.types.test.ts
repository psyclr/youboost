import { depositSchema, transactionsQuerySchema, transactionIdSchema } from '../billing.types';

describe('Billing Validation Schemas', () => {
  describe('depositSchema', () => {
    const valid = {
      amount: 50,
      currency: 'USD' as const,
      paymentMethod: 'crypto' as const,
      cryptoCurrency: 'USDT' as const,
    };

    it('should accept valid input', () => {
      expect(() => depositSchema.parse(valid)).not.toThrow();
    });

    it('should accept minimum amount of 10', () => {
      expect(() => depositSchema.parse({ ...valid, amount: 10 })).not.toThrow();
    });

    it('should reject amount below 10', () => {
      expect(() => depositSchema.parse({ ...valid, amount: 9 })).toThrow();
    });

    it('should reject zero amount', () => {
      expect(() => depositSchema.parse({ ...valid, amount: 0 })).toThrow();
    });

    it('should reject negative amount', () => {
      expect(() => depositSchema.parse({ ...valid, amount: -5 })).toThrow();
    });

    it('should reject non-USD currency', () => {
      expect(() => depositSchema.parse({ ...valid, currency: 'EUR' })).toThrow();
    });

    it('should reject non-crypto payment method', () => {
      expect(() => depositSchema.parse({ ...valid, paymentMethod: 'card' })).toThrow();
    });

    it('should accept BTC crypto currency', () => {
      expect(() => depositSchema.parse({ ...valid, cryptoCurrency: 'BTC' })).not.toThrow();
    });

    it('should accept ETH crypto currency', () => {
      expect(() => depositSchema.parse({ ...valid, cryptoCurrency: 'ETH' })).not.toThrow();
    });

    it('should reject unsupported crypto currency', () => {
      expect(() => depositSchema.parse({ ...valid, cryptoCurrency: 'DOGE' })).toThrow();
    });
  });

  describe('transactionsQuerySchema', () => {
    it('should accept empty object with defaults', () => {
      const result = transactionsQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should coerce string numbers', () => {
      const result = transactionsQuerySchema.parse({ page: '2', limit: '50' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it('should accept valid type filter', () => {
      const result = transactionsQuerySchema.parse({ type: 'DEPOSIT' });
      expect(result.type).toBe('DEPOSIT');
    });

    it('should reject page less than 1', () => {
      expect(() => transactionsQuerySchema.parse({ page: 0 })).toThrow();
    });

    it('should reject limit above 100', () => {
      expect(() => transactionsQuerySchema.parse({ limit: 101 })).toThrow();
    });

    it('should reject invalid type', () => {
      expect(() => transactionsQuerySchema.parse({ type: 'INVALID' })).toThrow();
    });

    it('should accept all valid ledger types', () => {
      for (const type of ['DEPOSIT', 'WITHDRAW', 'HOLD', 'RELEASE', 'REFUND', 'FEE']) {
        expect(() => transactionsQuerySchema.parse({ type })).not.toThrow();
      }
    });
  });

  describe('transactionIdSchema', () => {
    it('should accept valid UUID', () => {
      expect(() =>
        transactionIdSchema.parse({ transactionId: '550e8400-e29b-41d4-a716-446655440000' }),
      ).not.toThrow();
    });

    it('should reject non-UUID string', () => {
      expect(() => transactionIdSchema.parse({ transactionId: 'not-a-uuid' })).toThrow();
    });

    it('should reject empty string', () => {
      expect(() => transactionIdSchema.parse({ transactionId: '' })).toThrow();
    });
  });
});
