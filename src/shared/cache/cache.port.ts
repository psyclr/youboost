/**
 * Narrow key-value cache contract. Consumers depend on this interface,
 * not directly on ioredis, so cache implementations can swap (in-memory
 * for tests, Redis in prod, multi-tier in the future) without touching
 * domain code.
 */
export interface CachePort {
  get(key: string): Promise<string | null>;
  /** Set value with TTL in seconds. */
  setex(key: string, ttlSeconds: number, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
