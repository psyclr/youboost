import { startOrderPolling, stopOrderPolling } from '../index';

const mockStartWorker = jest.fn().mockResolvedValue(undefined);
const mockScheduleRepeatingJob = jest.fn().mockResolvedValue(undefined);
const mockCloseQueue = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../../shared/queue', () => ({
  startWorker: (...args: unknown[]): unknown => mockStartWorker(...args),
  scheduleRepeatingJob: (...args: unknown[]): unknown => mockScheduleRepeatingJob(...args),
  closeQueue: (...args: unknown[]): unknown => mockCloseQueue(...args),
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
    it('should start the worker', async () => {
      await startOrderPolling();

      expect(mockStartWorker).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should schedule a repeating job', async () => {
      await startOrderPolling();

      expect(mockScheduleRepeatingJob).toHaveBeenCalledWith('poll-order-statuses', 30_000);
    });

    it('should use interval from config', async () => {
      await startOrderPolling();

      expect(mockScheduleRepeatingJob).toHaveBeenCalledWith('poll-order-statuses', 30_000);
    });
  });

  describe('stopOrderPolling', () => {
    it('should close the queue', async () => {
      await stopOrderPolling();

      expect(mockCloseQueue).toHaveBeenCalled();
    });

    it('should resolve without errors', async () => {
      await expect(stopOrderPolling()).resolves.toBeUndefined();
    });
  });
});
