import Redis from 'ioredis';
import { createServiceLogger } from '../utils/logger';

const log = createServiceLogger('redis');

export interface CreateRedisOptions {
  url: string;
}

export function createRedisClient(options: CreateRedisOptions): Redis {
  const client = new Redis(options.url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number): number | null {
      if (times > 10) {
        log.error('Redis max reconnection attempts reached');
        return null;
      }
      const delay = Math.min(times * 200, 5000);
      log.warn({ attempt: times, delay }, 'Redis reconnecting');
      return delay;
    },
    lazyConnect: true,
  });

  client.on('error', (err) => {
    log.error({ err }, 'Redis connection error');
  });

  client.on('connect', () => {
    log.info('Redis connected');
  });

  return client;
}

export async function connectRedisClient(client: Redis): Promise<void> {
  await client.ping();
  log.info('Redis connection verified');
}

export async function disconnectRedisClient(client: Redis): Promise<void> {
  await client.quit();
  log.info('Redis disconnected');
}

export async function isRedisClientHealthy(client: Redis): Promise<boolean> {
  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    log.error({ err: error }, 'Redis health check failed');
    return false;
  }
}

// Deprecated — singleton shim kept during Phase F1-F2 so unconverted modules still compile.
// Delete in Phase 18 (sweep) after every module is factory-based.
let sharedRedis: Redis | null = null;

export function setSharedRedis(client: Redis): void {
  sharedRedis = client;
}

export function getRedis(): Redis {
  if (!sharedRedis) {
    sharedRedis = createRedisClient({
      url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    });
  }
  return sharedRedis;
}

export async function connectRedis(): Promise<void> {
  await connectRedisClient(getRedis());
}

export async function disconnectRedis(): Promise<void> {
  if (sharedRedis) {
    await disconnectRedisClient(sharedRedis);
    sharedRedis = null;
  }
}

export async function isRedisHealthy(): Promise<boolean> {
  return isRedisClientHealthy(getRedis());
}
