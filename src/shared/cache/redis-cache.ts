import type Redis from 'ioredis';
import type { CachePort } from './cache.port';

export function createRedisCache(redis: Redis): CachePort {
  async function get(key: string): Promise<string | null> {
    return redis.get(key);
  }
  async function setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await redis.setex(key, ttlSeconds, value);
  }
  async function deleteKey(key: string): Promise<void> {
    await redis.del(key);
  }
  return { get, setex, delete: deleteKey };
}
