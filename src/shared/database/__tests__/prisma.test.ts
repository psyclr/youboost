import { createPrismaClient, connectPrisma, disconnectPrisma, isPrismaHealthy } from '../prisma';
import type { PrismaClient } from '../../../generated/prisma';

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

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Prisma Database Module', () => {
  describe('createPrismaClient', () => {
    it('should return a PrismaClient instance', () => {
      const client = createPrismaClient({ databaseUrl: 'postgres://test' });
      expect(client).toBeDefined();
      expect(typeof client.$connect).toBe('function');
    });
  });

  describe('connectPrisma', () => {
    it('should connect the given client', async () => {
      const client = createPrismaClient({ databaseUrl: 'postgres://test' });
      await connectPrisma(client);
      expect(client.$connect).toHaveBeenCalled();
    });
  });

  describe('disconnectPrisma', () => {
    it('should disconnect the given client', async () => {
      const client = createPrismaClient({ databaseUrl: 'postgres://test' });
      await disconnectPrisma(client);
      expect(client.$disconnect).toHaveBeenCalled();
    });
  });

  describe('isPrismaHealthy', () => {
    it('should return true when query succeeds', async () => {
      const client = createPrismaClient({ databaseUrl: 'postgres://test' });
      const healthy = await isPrismaHealthy(client);
      expect(healthy).toBe(true);
    });

    it('should return false when query fails', async () => {
      const client = createPrismaClient({ databaseUrl: 'postgres://test' }) as PrismaClient & {
        $queryRaw: jest.Mock;
      };
      client.$queryRaw.mockRejectedValueOnce(new Error('Connection refused'));

      const healthy = await isPrismaHealthy(client);
      expect(healthy).toBe(false);
    });
  });
});
