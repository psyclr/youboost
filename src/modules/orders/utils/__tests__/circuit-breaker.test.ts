import { createCircuitBreaker } from '../circuit-breaker';

describe('Circuit Breaker (factory)', () => {
  describe('isOpen', () => {
    it('should return false for unknown provider', () => {
      const cb = createCircuitBreaker();
      expect(cb.isOpen('provider-1', 5, 60_000)).toBe(false);
    });

    it('should return false when failures below threshold', () => {
      const cb = createCircuitBreaker();
      cb.recordFailure('provider-1');
      cb.recordFailure('provider-1');
      expect(cb.isOpen('provider-1', 5, 60_000)).toBe(false);
    });

    it('should return true when failures reach threshold within cooldown', () => {
      const cb = createCircuitBreaker();
      for (let i = 0; i < 5; i++) {
        cb.recordFailure('provider-1');
      }
      expect(cb.isOpen('provider-1', 5, 60_000)).toBe(true);
    });

    it('should return false when failures reach threshold but cooldown expired', () => {
      const cb = createCircuitBreaker();
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      for (let i = 0; i < 5; i++) {
        cb.recordFailure('provider-1');
      }

      jest.spyOn(Date, 'now').mockReturnValue(now + 60_001);
      expect(cb.isOpen('provider-1', 5, 60_000)).toBe(false);

      jest.restoreAllMocks();
    });

    it('should track providers independently', () => {
      const cb = createCircuitBreaker();
      for (let i = 0; i < 5; i++) {
        cb.recordFailure('provider-1');
      }
      expect(cb.isOpen('provider-1', 5, 60_000)).toBe(true);
      expect(cb.isOpen('provider-2', 5, 60_000)).toBe(false);
    });
  });

  describe('recordFailure', () => {
    it('should increment failure count', () => {
      const cb = createCircuitBreaker();
      cb.recordFailure('provider-1');
      expect(cb.isOpen('provider-1', 1, 60_000)).toBe(true);
    });

    it('should update lastFailure timestamp', () => {
      const cb = createCircuitBreaker();
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      cb.recordFailure('provider-1');

      jest.spyOn(Date, 'now').mockReturnValue(now + 60_001);
      expect(cb.isOpen('provider-1', 1, 60_000)).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('recordSuccess', () => {
    it('should reset breaker state', () => {
      const cb = createCircuitBreaker();
      for (let i = 0; i < 5; i++) {
        cb.recordFailure('provider-1');
      }
      expect(cb.isOpen('provider-1', 5, 60_000)).toBe(true);

      cb.recordSuccess('provider-1');
      expect(cb.isOpen('provider-1', 5, 60_000)).toBe(false);
    });

    it('should not affect other providers', () => {
      const cb = createCircuitBreaker();
      for (let i = 0; i < 5; i++) {
        cb.recordFailure('provider-1');
        cb.recordFailure('provider-2');
      }

      cb.recordSuccess('provider-1');
      expect(cb.isOpen('provider-1', 5, 60_000)).toBe(false);
      expect(cb.isOpen('provider-2', 5, 60_000)).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear all breaker states', () => {
      const cb = createCircuitBreaker();
      for (let i = 0; i < 5; i++) {
        cb.recordFailure('provider-1');
        cb.recordFailure('provider-2');
      }

      cb.reset();
      expect(cb.isOpen('provider-1', 5, 60_000)).toBe(false);
      expect(cb.isOpen('provider-2', 5, 60_000)).toBe(false);
    });
  });

  describe('isolation between instances', () => {
    it('should not share state between factory instances', () => {
      const a = createCircuitBreaker();
      const b = createCircuitBreaker();
      for (let i = 0; i < 5; i++) a.recordFailure('p');
      expect(a.isOpen('p', 5, 60_000)).toBe(true);
      expect(b.isOpen('p', 5, 60_000)).toBe(false);
    });
  });
});
