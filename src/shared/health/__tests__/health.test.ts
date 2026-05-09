import type Redis from 'ioredis';
import type { PrismaClient } from '../../../generated/prisma';
import { createHealthCheck, type HealthStatus } from '../health';

const mockDbHealth = jest.fn();
const mockRedisHealth = jest.fn();

jest.mock('../../database/prisma', () => ({
  isPrismaHealthy: (...args: unknown[]): unknown => mockDbHealth(...args),
}));

jest.mock('../../redis/redis', () => ({
  isRedisClientHealthy: (...args: unknown[]): unknown => mockRedisHealth(...args),
}));

const fakePrisma = {} as PrismaClient;
const fakeRedis = {} as Redis;

describe('Health Check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return ok when all checks pass', async () => {
    mockDbHealth.mockResolvedValue(true);
    mockRedisHealth.mockResolvedValue(true);

    const checkHealth = createHealthCheck({ prisma: fakePrisma, redis: fakeRedis });
    const result = await checkHealth();

    expect(result.status).toBe('ok');
    expect(result.checks.database).toBe(true);
    expect(result.checks.redis).toBe(true);
    expect(result.timestamp).toBeDefined();
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should return degraded when database is down', async () => {
    mockDbHealth.mockResolvedValue(false);
    mockRedisHealth.mockResolvedValue(true);

    const checkHealth = createHealthCheck({ prisma: fakePrisma, redis: fakeRedis });
    const result = await checkHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.database).toBe(false);
    expect(result.checks.redis).toBe(true);
  });

  it('should return degraded when redis is down', async () => {
    mockDbHealth.mockResolvedValue(true);
    mockRedisHealth.mockResolvedValue(false);

    const checkHealth = createHealthCheck({ prisma: fakePrisma, redis: fakeRedis });
    const result = await checkHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.database).toBe(true);
    expect(result.checks.redis).toBe(false);
  });

  it('should return error when all checks fail', async () => {
    mockDbHealth.mockResolvedValue(false);
    mockRedisHealth.mockResolvedValue(false);

    const checkHealth = createHealthCheck({ prisma: fakePrisma, redis: fakeRedis });
    const result = await checkHealth();

    expect(result.status).toBe('error');
    expect(result.checks.database).toBe(false);
    expect(result.checks.redis).toBe(false);
  });

  it('should include memory usage', async () => {
    mockDbHealth.mockResolvedValue(true);
    mockRedisHealth.mockResolvedValue(true);

    const checkHealth = createHealthCheck({ prisma: fakePrisma, redis: fakeRedis });
    const result = await checkHealth();

    expect(result.checks.memory).toBeDefined();
    expect(result.checks.memory.rss).toBeGreaterThan(0);
    expect(result.checks.memory.heapUsed).toBeGreaterThan(0);
  });

  it('should satisfy HealthStatus type', async () => {
    mockDbHealth.mockResolvedValue(true);
    mockRedisHealth.mockResolvedValue(true);

    const checkHealth = createHealthCheck({ prisma: fakePrisma, redis: fakeRedis });
    const result: HealthStatus = await checkHealth();

    expect(result).toBeDefined();
  });
});
