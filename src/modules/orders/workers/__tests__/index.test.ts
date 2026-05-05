import { startOrderPolling, stopOrderPolling } from '../index';

const mockStartNamedWorker = jest.fn().mockResolvedValue(undefined);
const mockStopNamedWorker = jest.fn().mockResolvedValue(undefined);
const mockQueueAdd = jest.fn().mockResolvedValue({});
const mockGetNamedQueue = jest.fn().mockReturnValue({ add: mockQueueAdd });

jest.mock('../../../../shared/queue', () => ({
  startNamedWorker: (...args: unknown[]): unknown => mockStartNamedWorker(...args),
  stopNamedWorker: (...args: unknown[]): unknown => mockStopNamedWorker(...args),
  getNamedQueue: (...args: unknown[]): unknown => mockGetNamedQueue(...args),
}));

jest.mock('../../../../shared/config', () => ({
  getConfig: jest.fn().mockReturnValue({
    polling: {
      intervalMs: 30_000,
    },
  }),
}));

jest.mock('../../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../status-poll.worker', () => ({
  pollOrderStatuses: jest.fn().mockResolvedValue(undefined),
}));

describe('Order Polling Bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startOrderPolling', () => {
    it('should start a named worker for order-polling', async () => {
      await startOrderPolling();

      expect(mockStartNamedWorker).toHaveBeenCalledWith(
        'order-polling',
        expect.any(Function),
        expect.objectContaining({ retryable: false, concurrency: 1 }),
      );
    });

    it('should schedule a repeating job on the named queue', async () => {
      await startOrderPolling();

      expect(mockGetNamedQueue).toHaveBeenCalledWith('order-polling');
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'poll-order-statuses',
        {},
        { repeat: { every: 30_000 } },
      );
    });
  });

  describe('stopOrderPolling', () => {
    it('should stop the named worker', async () => {
      await stopOrderPolling();

      expect(mockStopNamedWorker).toHaveBeenCalledWith('order-polling');
    });

    it('should resolve without errors', async () => {
      await expect(stopOrderPolling()).resolves.toBeUndefined();
    });
  });
});
