interface BreakerState {
  failures: number;
  lastFailure: number;
}

export interface CircuitBreaker {
  isOpen(providerId: string, threshold: number, cooldownMs: number): boolean;
  recordSuccess(providerId: string): void;
  recordFailure(providerId: string): void;
  /** For tests — resets the internal map. */
  reset(): void;
}

export function createCircuitBreaker(): CircuitBreaker {
  const breakers = new Map<string, BreakerState>();

  function isOpen(providerId: string, threshold: number, cooldownMs: number): boolean {
    const state = breakers.get(providerId);
    if (!state) return false;
    if (state.failures < threshold) return false;
    return Date.now() - state.lastFailure < cooldownMs;
  }

  function recordFailure(providerId: string): void {
    const state = breakers.get(providerId) ?? { failures: 0, lastFailure: 0 };
    state.failures += 1;
    state.lastFailure = Date.now();
    breakers.set(providerId, state);
  }

  function recordSuccess(providerId: string): void {
    breakers.delete(providerId);
  }

  function reset(): void {
    breakers.clear();
  }

  return { isOpen, recordSuccess, recordFailure, reset };
}
