import { getQueue, startWorker, scheduleRepeatingJob, closeQueue } from '../queue';

const mockAdd = jest.fn().mockResolvedValue({});
const mockClose = jest.fn().mockResolvedValue(undefined);
const mockOn = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockAdd,
    close: mockClose,
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: mockOn,
    close: mockClose,
  })),
}));

const { Worker } = jest.requireMock<typeof import('bullmq')>('bullmq');

const mockDuplicate = jest.fn().mockReturnValue({});

jest.mock('../../redis/redis', () => ({
  getRedis: (): { duplicate: (...args: unknown[]) => unknown } => ({
    duplicate: (...args: unknown[]): unknown => mockDuplicate(...args),
  }),
}));

jest.mock('../../utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Queue Infrastructure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await closeQueue();
  });

  describe('getQueue', () => {
    it('should create a queue on first call', () => {
      const queue = getQueue();
      expect(queue).toBeDefined();
    });

    it('should return the same queue on subsequent calls', () => {
      const q1 = getQueue();
      const q2 = getQueue();
      expect(q1).toBe(q2);
    });

    it('should use redis connection with maxRetriesPerRequest: null', () => {
      getQueue();
      expect(mockDuplicate).toHaveBeenCalledWith({ maxRetriesPerRequest: null });
    });
  });

  describe('startWorker', () => {
    it('should create a worker', async () => {
      const processor = jest.fn();
      await startWorker(processor);

      expect(Worker).toHaveBeenCalledWith(
        'order-polling',
        expect.any(Function),
        expect.objectContaining({ concurrency: 1 }),
      );
    });

    it('should register error and completed event handlers', async () => {
      await startWorker(jest.fn());

      expect(mockOn).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('completed', expect.any(Function));
    });

    it('should not create a second worker if already started', async () => {
      await startWorker(jest.fn());
      const callCount = (Worker as unknown as jest.Mock).mock.calls.length;

      await startWorker(jest.fn());
      expect((Worker as unknown as jest.Mock).mock.calls.length).toBe(callCount);
    });
  });

  describe('scheduleRepeatingJob', () => {
    it('should add a repeating job to the queue', async () => {
      await scheduleRepeatingJob('test-job', 5000);

      expect(mockAdd).toHaveBeenCalledWith('test-job', {}, { repeat: { every: 5000 } });
    });
  });

  describe('closeQueue', () => {
    it('should close worker and queue', async () => {
      await startWorker(jest.fn());
      getQueue();
      await closeQueue();

      expect(mockClose).toHaveBeenCalled();
    });

    it('should handle close when nothing is initialized', async () => {
      await expect(closeQueue()).resolves.toBeUndefined();
    });
  });
});
