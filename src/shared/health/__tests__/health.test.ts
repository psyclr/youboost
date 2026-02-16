import { checkHealth, type HealthStatus } from '../health';

jest.mock('../../database/prisma', () => ({
  isDatabaseHealthy: jest.fn(),
}));

jest.mock('../../redis/redis', () => ({
  isRedisHealthy: jest.fn(),
}));

import { isDatabaseHealthy } from '../../database/prisma';
import { isRedisHealthy } from '../../redis/redis';

const mockDbHealth = isDatabaseHealthy as jest.MockedFunction<typeof isDatabaseHealthy>;
const mockRedisHealth = isRedisHealthy as jest.MockedFunction<typeof isRedisHealthy>;

describe('Health Check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return ok when all checks pass', async () => {
    mockDbHealth.mockResolvedValue(true);
    mockRedisHealth.mockResolvedValue(true);

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

    const result = await checkHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.database).toBe(false);
    expect(result.checks.redis).toBe(true);
  });

  it('should return degraded when redis is down', async () => {
    mockDbHealth.mockResolvedValue(true);
    mockRedisHealth.mockResolvedValue(false);

    const result = await checkHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.database).toBe(true);
    expect(result.checks.redis).toBe(false);
  });

  it('should return error when all checks fail', async () => {
    mockDbHealth.mockResolvedValue(false);
    mockRedisHealth.mockResolvedValue(false);

    const result = await checkHealth();

    expect(result.status).toBe('error');
    expect(result.checks.database).toBe(false);
    expect(result.checks.redis).toBe(false);
  });

  it('should include memory usage', async () => {
    mockDbHealth.mockResolvedValue(true);
    mockRedisHealth.mockResolvedValue(true);

    const result = await checkHealth();

    expect(result.checks.memory).toBeDefined();
    expect(result.checks.memory.rss).toBeGreaterThan(0);
    expect(result.checks.memory.heapUsed).toBeGreaterThan(0);
  });

  it('should satisfy HealthStatus type', async () => {
    mockDbHealth.mockResolvedValue(true);
    mockRedisHealth.mockResolvedValue(true);

    const result: HealthStatus = await checkHealth();

    expect(result).toBeDefined();
  });
});
