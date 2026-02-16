interface BreakerState {
  failures: number;
  lastFailure: number;
}

const breakers = new Map<string, BreakerState>();

export function isCircuitOpen(providerId: string, threshold: number, cooldownMs: number): boolean {
  const state = breakers.get(providerId);
  if (!state) return false;
  if (state.failures < threshold) return false;
  return Date.now() - state.lastFailure < cooldownMs;
}

export function recordFailure(providerId: string): void {
  const state = breakers.get(providerId) ?? { failures: 0, lastFailure: 0 };
  state.failures += 1;
  state.lastFailure = Date.now();
  breakers.set(providerId, state);
}

export function recordSuccess(providerId: string): void {
  breakers.delete(providerId);
}

export function resetAllBreakers(): void {
  breakers.clear();
}
