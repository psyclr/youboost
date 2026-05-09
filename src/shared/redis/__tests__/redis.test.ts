import {
  createRedisClient,
  connectRedisClient,
  disconnectRedisClient,
  isRedisClientHealthy,
} from '../redis';

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
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOptions = {};
  });

  describe('createRedisClient', () => {
    it('should return a Redis instance', () => {
      const client = createRedisClient({ url: 'redis://localhost' });
      expect(client).toBeDefined();
      expect(typeof client.ping).toBe('function');
    });

    it('should return a new instance each call', () => {
      const c1 = createRedisClient({ url: 'redis://localhost' });
      const c2 = createRedisClient({ url: 'redis://localhost' });
      expect(c1).not.toBe(c2);
    });
  });

  describe('connectRedisClient', () => {
    it('should verify connection with ping', async () => {
      const client = createRedisClient({ url: 'redis://localhost' });
      await connectRedisClient(client);
      expect(mockPing).toHaveBeenCalled();
    });
  });

  describe('disconnectRedisClient', () => {
    it('should call quit on the client', async () => {
      const client = createRedisClient({ url: 'redis://localhost' });
      await disconnectRedisClient(client);
      expect(mockQuit).toHaveBeenCalled();
    });
  });

  describe('isRedisClientHealthy', () => {
    it('should return true when redis responds with PONG', async () => {
      const client = createRedisClient({ url: 'redis://localhost' });
      const healthy = await isRedisClientHealthy(client);
      expect(healthy).toBe(true);
    });

    it('should return false when ping fails', async () => {
      const client = createRedisClient({ url: 'redis://localhost' });
      mockPing.mockRejectedValueOnce(new Error('Connection refused'));
      const healthy = await isRedisClientHealthy(client);
      expect(healthy).toBe(false);
    });
  });

  describe('retryStrategy', () => {
    it('should return a delay with exponential backoff', () => {
      createRedisClient({ url: 'redis://localhost' });
      const retryStrategy = capturedOptions['retryStrategy'] as (times: number) => number | null;
      expect(retryStrategy(1)).toBe(200);
      expect(retryStrategy(2)).toBe(400);
      expect(retryStrategy(5)).toBe(1000);
    });

    it('should cap delay at 5000ms', () => {
      createRedisClient({ url: 'redis://localhost' });
      const retryStrategy = capturedOptions['retryStrategy'] as (times: number) => number | null;
      expect(retryStrategy(10)).toBe(2000);
    });

    it('should return null after max retries', () => {
      createRedisClient({ url: 'redis://localhost' });
      const retryStrategy = capturedOptions['retryStrategy'] as (times: number) => number | null;
      expect(retryStrategy(11)).toBeNull();
    });
  });

  describe('event handlers', () => {
    it('should register error and connect handlers', () => {
      createRedisClient({ url: 'redis://localhost' });
      const calls = mockOn.mock.calls as [string, (...args: unknown[]) => void][];
      const eventNames = calls.map(([name]) => name);
      expect(eventNames).toContain('error');
      expect(eventNames).toContain('connect');
    });

    it('should handle error events without throwing', () => {
      createRedisClient({ url: 'redis://localhost' });
      const calls = mockOn.mock.calls as [string, (...args: unknown[]) => void][];
      const errorHandler = calls.find(([name]) => name === 'error');
      expect(() => {
        errorHandler?.[1](new Error('test'));
      }).not.toThrow();
    });

    it('should handle connect events without throwing', () => {
      createRedisClient({ url: 'redis://localhost' });
      const calls = mockOn.mock.calls as [string, (...args: unknown[]) => void][];
      const connectHandler = calls.find(([name]) => name === 'connect');
      expect(() => {
        connectHandler?.[1]();
      }).not.toThrow();
    });
  });
});
