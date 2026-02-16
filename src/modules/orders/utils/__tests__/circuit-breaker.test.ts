import { isCircuitOpen, recordFailure, recordSuccess, resetAllBreakers } from '../circuit-breaker';

describe('Circuit Breaker', () => {
  beforeEach(() => {
    resetAllBreakers();
  });

  describe('isCircuitOpen', () => {
    it('should return false for unknown provider', () => {
      expect(isCircuitOpen('provider-1', 5, 60_000)).toBe(false);
    });

    it('should return false when failures below threshold', () => {
      recordFailure('provider-1');
      recordFailure('provider-1');
      expect(isCircuitOpen('provider-1', 5, 60_000)).toBe(false);
    });

    it('should return true when failures reach threshold within cooldown', () => {
      for (let i = 0; i < 5; i++) {
        recordFailure('provider-1');
      }
      expect(isCircuitOpen('provider-1', 5, 60_000)).toBe(true);
    });

    it('should return false when failures reach threshold but cooldown expired', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      for (let i = 0; i < 5; i++) {
        recordFailure('provider-1');
      }

      jest.spyOn(Date, 'now').mockReturnValue(now + 60_001);
      expect(isCircuitOpen('provider-1', 5, 60_000)).toBe(false);

      jest.restoreAllMocks();
    });

    it('should track providers independently', () => {
      for (let i = 0; i < 5; i++) {
        recordFailure('provider-1');
      }
      expect(isCircuitOpen('provider-1', 5, 60_000)).toBe(true);
      expect(isCircuitOpen('provider-2', 5, 60_000)).toBe(false);
    });
  });

  describe('recordFailure', () => {
    it('should increment failure count', () => {
      recordFailure('provider-1');
      expect(isCircuitOpen('provider-1', 1, 60_000)).toBe(true);
    });

    it('should update lastFailure timestamp', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      recordFailure('provider-1');

      jest.spyOn(Date, 'now').mockReturnValue(now + 60_001);
      expect(isCircuitOpen('provider-1', 1, 60_000)).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('recordSuccess', () => {
    it('should reset breaker state', () => {
      for (let i = 0; i < 5; i++) {
        recordFailure('provider-1');
      }
      expect(isCircuitOpen('provider-1', 5, 60_000)).toBe(true);

      recordSuccess('provider-1');
      expect(isCircuitOpen('provider-1', 5, 60_000)).toBe(false);
    });

    it('should not affect other providers', () => {
      for (let i = 0; i < 5; i++) {
        recordFailure('provider-1');
        recordFailure('provider-2');
      }

      recordSuccess('provider-1');
      expect(isCircuitOpen('provider-1', 5, 60_000)).toBe(false);
      expect(isCircuitOpen('provider-2', 5, 60_000)).toBe(true);
    });
  });

  describe('resetAllBreakers', () => {
    it('should clear all breaker states', () => {
      for (let i = 0; i < 5; i++) {
        recordFailure('provider-1');
        recordFailure('provider-2');
      }

      resetAllBreakers();
      expect(isCircuitOpen('provider-1', 5, 60_000)).toBe(false);
      expect(isCircuitOpen('provider-2', 5, 60_000)).toBe(false);
    });
  });
});
