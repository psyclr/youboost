import { getPrisma, connectDatabase, disconnectDatabase, isDatabaseHealthy } from '../prisma';

jest.mock('../../../generated/prisma', () => {
  const mockConnect = jest.fn().mockResolvedValue(undefined);
  const mockDisconnect = jest.fn().mockResolvedValue(undefined);
  const mockQueryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);

  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      $connect: mockConnect,
      $disconnect: mockDisconnect,
      $queryRaw: mockQueryRaw,
      $on: jest.fn(),
    })),
  };
});

jest.mock('../../utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Prisma Database Module', () => {
  afterEach(async () => {
    await disconnectDatabase();
  });

  describe('getPrisma', () => {
    it('should return a PrismaClient instance', () => {
      const client = getPrisma();
      expect(client).toBeDefined();
      expect(typeof client.$connect).toBe('function');
      expect(typeof client.$disconnect).toBe('function');
    });

    it('should return the same instance (singleton)', () => {
      const client1 = getPrisma();
      const client2 = getPrisma();
      expect(client1).toBe(client2);
    });
  });

  describe('connectDatabase', () => {
    it('should connect to the database', async () => {
      const client = getPrisma();
      await connectDatabase();
      expect(client.$connect).toHaveBeenCalled();
    });
  });

  describe('disconnectDatabase', () => {
    it('should disconnect from the database', async () => {
      const client = getPrisma();
      await connectDatabase();
      await disconnectDatabase();
      expect(client.$disconnect).toHaveBeenCalled();
    });
  });

  describe('isDatabaseHealthy', () => {
    it('should return true when database is reachable', async () => {
      const healthy = await isDatabaseHealthy();
      expect(healthy).toBe(true);
    });

    it('should return false when query fails', async () => {
      const client = getPrisma();
      (client.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

      const healthy = await isDatabaseHealthy();
      expect(healthy).toBe(false);
    });
  });
});
