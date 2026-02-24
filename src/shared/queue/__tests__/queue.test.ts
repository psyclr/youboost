import { getQueue, startWorker, scheduleRepeatingJob, closeQueue } from '../queue';

const mockAdd = jest.fn().mockResolvedValue({});
const mockClose = jest.fn().mockResolvedValue(undefined);

let capturedProcessor: ((job: unknown) => Promise<void>) | null = null;
const capturedEventHandlers: Record<string, (...args: unknown[]) => void> = {};

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockAdd,
    close: mockClose,
  })),
  Worker: jest
    .fn()
    .mockImplementation((_name: string, processor: (job: unknown) => Promise<void>) => {
      capturedProcessor = processor;
      return {
        on: jest.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
          capturedEventHandlers[event] = handler;
        }),
        close: mockClose,
      };
    }),
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
    capturedProcessor = null;
    for (const key of Object.keys(capturedEventHandlers)) {
      delete capturedEventHandlers[key];
    }
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

      expect(capturedEventHandlers['failed']).toBeDefined();
      expect(capturedEventHandlers['completed']).toBeDefined();
    });

    it('should not create a second worker if already started', async () => {
      await startWorker(jest.fn());
      const callCount = (Worker as unknown as jest.Mock).mock.calls.length;

      await startWorker(jest.fn());
      expect((Worker as unknown as jest.Mock).mock.calls.length).toBe(callCount);
    });
  });

  describe('worker processor and event handlers', () => {
    it('should call the provided processor function via worker wrapper', async () => {
      const processor = jest.fn().mockResolvedValue(undefined);
      await startWorker(processor);
      expect(capturedProcessor).toBeDefined();

      const fakeJob = { name: 'test-job' };
      await capturedProcessor!(fakeJob);
      expect(processor).toHaveBeenCalledWith(fakeJob);
    });

    it('should not throw from failed event handler', async () => {
      await startWorker(jest.fn());
      const handler = capturedEventHandlers['failed'];
      if (!handler) throw new Error('failed handler not registered');
      expect(() => {
        handler({ name: 'test-job' }, new Error('fail'));
      }).not.toThrow();
    });

    it('should not throw from completed event handler', async () => {
      await startWorker(jest.fn());
      const handler = capturedEventHandlers['completed'];
      if (!handler) throw new Error('completed handler not registered');
      expect(() => {
        handler({ name: 'test-job' });
      }).not.toThrow();
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
