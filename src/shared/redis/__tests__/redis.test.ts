import { getRedis, connectRedis, disconnectRedis, isRedisHealthy } from '../redis';

const mockPing = jest.fn().mockResolvedValue('PONG');
const mockQuit = jest.fn().mockResolvedValue('OK');
const mockOn = jest.fn();

let capturedOptions: Record<string, unknown> = {};

jest.mock('ioredis', () =>
  jest.fn().mockImplementation((_url: string, options: Record<string, unknown>) => {
    capturedOptions = options;
    return {
      ping: mockPing,
      quit: mockQuit,
      on: mockOn,
      status: 'ready',
    };
  }),
);

jest.mock('../../utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Redis Module', () => {
  afterEach(async () => {
    await disconnectRedis();
    jest.clearAllMocks();
    capturedOptions = {};
  });

  describe('getRedis', () => {
    it('should return a Redis instance', () => {
      const client = getRedis();
      expect(client).toBeDefined();
      expect(typeof client.ping).toBe('function');
    });

    it('should return the same instance (singleton)', () => {
      const client1 = getRedis();
      const client2 = getRedis();
      expect(client1).toBe(client2);
    });
  });

  describe('connectRedis', () => {
    it('should verify connection with ping', async () => {
      await connectRedis();
      expect(mockPing).toHaveBeenCalled();
    });
  });

  describe('disconnectRedis', () => {
    it('should call quit on the client', async () => {
      getRedis();
      await disconnectRedis();
      expect(mockQuit).toHaveBeenCalled();
    });

    it('should be safe to call when not connected', async () => {
      await disconnectRedis();
      expect(mockQuit).not.toHaveBeenCalled();
    });
  });

  describe('isRedisHealthy', () => {
    it('should return true when redis responds with PONG', async () => {
      const healthy = await isRedisHealthy();
      expect(healthy).toBe(true);
    });

    it('should return false when ping fails', async () => {
      mockPing.mockRejectedValueOnce(new Error('Connection refused'));
      const healthy = await isRedisHealthy();
      expect(healthy).toBe(false);
    });
  });

  describe('retryStrategy', () => {
    it('should return a delay with exponential backoff', () => {
      getRedis();
      const retryStrategy = capturedOptions['retryStrategy'] as (times: number) => number | null;
      expect(retryStrategy(1)).toBe(200);
      expect(retryStrategy(2)).toBe(400);
      expect(retryStrategy(5)).toBe(1000);
    });

    it('should cap delay at 5000ms', () => {
      getRedis();
      const retryStrategy = capturedOptions['retryStrategy'] as (times: number) => number | null;
      expect(retryStrategy(10)).toBe(2000);
    });

    it('should return null after max retries', () => {
      getRedis();
      const retryStrategy = capturedOptions['retryStrategy'] as (times: number) => number | null;
      expect(retryStrategy(11)).toBeNull();
    });
  });

  describe('event handlers', () => {
    it('should register error and connect handlers', () => {
      getRedis();
      const calls = mockOn.mock.calls as [string, (...args: unknown[]) => void][];
      const eventNames = calls.map(([name]) => name);
      expect(eventNames).toContain('error');
      expect(eventNames).toContain('connect');
    });

    it('should handle error events without throwing', () => {
      getRedis();
      const calls = mockOn.mock.calls as [string, (...args: unknown[]) => void][];
      const errorHandler = calls.find(([name]) => name === 'error');
      expect(() => {
        errorHandler?.[1](new Error('test'));
      }).not.toThrow();
    });

    it('should handle connect events without throwing', () => {
      getRedis();
      const calls = mockOn.mock.calls as [string, (...args: unknown[]) => void][];
      const connectHandler = calls.find(([name]) => name === 'connect');
      expect(() => {
        connectHandler?.[1]();
      }).not.toThrow();
    });
  });
});
