import { createUserRepository } from '../user.repository';
import type { PrismaClient } from '../../../generated/prisma';

const mockUser = {
  id: '123',
  email: 'test@test.com',
  username: 'testuser',
  passwordHash: 'hash',
  role: 'USER',
  status: 'ACTIVE',
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockPrisma(): {
  prisma: PrismaClient;
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
} {
  const user = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const prisma = { user } as unknown as PrismaClient;
  return { prisma, user };
}

describe('User Repository', () => {
  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const { prisma, user } = createMockPrisma();
      user.findUnique.mockResolvedValue(mockUser);
      const repo = createUserRepository(prisma);

      const result = await repo.findByEmail('test@test.com');

      expect(result).toEqual(mockUser);
      expect(user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@test.com' } });
    });

    it('should return null when not found', async () => {
      const { prisma, user } = createMockPrisma();
      user.findUnique.mockResolvedValue(null);
      const repo = createUserRepository(prisma);

      const result = await repo.findByEmail('nope@test.com');

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should find user by username', async () => {
      const { prisma, user } = createMockPrisma();
      user.findUnique.mockResolvedValue(mockUser);
      const repo = createUserRepository(prisma);

      const result = await repo.findByUsername('testuser');

      expect(result).toEqual(mockUser);
      expect(user.findUnique).toHaveBeenCalledWith({ where: { username: 'testuser' } });
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const { prisma, user } = createMockPrisma();
      user.findUnique.mockResolvedValue(mockUser);
      const repo = createUserRepository(prisma);

      const result = await repo.findById('123');

      expect(result).toEqual(mockUser);
      expect(user.findUnique).toHaveBeenCalledWith({ where: { id: '123' } });
    });
  });

  describe('createUser', () => {
    it('should create a user', async () => {
      const { prisma, user } = createMockPrisma();
      user.create.mockResolvedValue(mockUser);
      const repo = createUserRepository(prisma);

      const data = { email: 'test@test.com', username: 'testuser', passwordHash: 'hash' };
      const result = await repo.createUser(data);

      expect(result).toEqual(mockUser);
      expect(user.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('setEmailVerified', () => {
    it('should update emailVerified to true', async () => {
      const { prisma, user } = createMockPrisma();
      user.update.mockResolvedValue(mockUser);
      const repo = createUserRepository(prisma);

      await repo.setEmailVerified('123');

      expect(user.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { emailVerified: true },
      });
    });
  });

  describe('updatePassword', () => {
    it('should update password hash', async () => {
      const { prisma, user } = createMockPrisma();
      user.update.mockResolvedValue(mockUser);
      const repo = createUserRepository(prisma);

      await repo.updatePassword('123', 'newhash');

      expect(user.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { passwordHash: 'newhash' },
      });
    });
  });

  describe('updateUsername', () => {
    it('should update username', async () => {
      const { prisma, user } = createMockPrisma();
      user.update.mockResolvedValue(mockUser);
      const repo = createUserRepository(prisma);

      await repo.updateUsername('123', 'new_name');

      expect(user.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { username: 'new_name' },
      });
    });
  });

  describe('findAllUsers', () => {
    it('should return paginated users', async () => {
      const { prisma, user } = createMockPrisma();
      user.findMany.mockResolvedValue([mockUser]);
      user.count.mockResolvedValue(1);
      const repo = createUserRepository(prisma);

      const result = await repo.findAllUsers({ page: 1, limit: 20 });

      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by role and status', async () => {
      const { prisma, user } = createMockPrisma();
      user.findMany.mockResolvedValue([]);
      user.count.mockResolvedValue(0);
      const repo = createUserRepository(prisma);

      await repo.findAllUsers({ page: 1, limit: 20, role: 'ADMIN', status: 'ACTIVE' });

      expect(user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'ADMIN', status: 'ACTIVE' } }),
      );
    });

    it('should apply pagination offset', async () => {
      const { prisma, user } = createMockPrisma();
      user.findMany.mockResolvedValue([]);
      user.count.mockResolvedValue(0);
      const repo = createUserRepository(prisma);

      await repo.findAllUsers({ page: 2, limit: 10 });

      expect(user.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    });
  });

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      const { prisma, user } = createMockPrisma();
      user.update.mockResolvedValue({ ...mockUser, role: 'ADMIN' });
      const repo = createUserRepository(prisma);

      const result = await repo.updateUserRole('123', 'ADMIN');

      expect(result.role).toBe('ADMIN');
      expect(user.update).toHaveBeenCalledWith({ where: { id: '123' }, data: { role: 'ADMIN' } });
    });

    it('should reject invalid role', async () => {
      const { prisma } = createMockPrisma();
      const repo = createUserRepository(prisma);

      await expect(repo.updateUserRole('123', 'HACKER')).rejects.toThrow('Invalid role');
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status', async () => {
      const { prisma, user } = createMockPrisma();
      user.update.mockResolvedValue({ ...mockUser, status: 'SUSPENDED' });
      const repo = createUserRepository(prisma);

      const result = await repo.updateUserStatus('123', 'SUSPENDED');

      expect(result.status).toBe('SUSPENDED');
      expect(user.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { status: 'SUSPENDED' },
      });
    });

    it('should reject invalid status', async () => {
      const { prisma } = createMockPrisma();
      const repo = createUserRepository(prisma);

      await expect(repo.updateUserStatus('123', 'INVALID')).rejects.toThrow('Invalid status');
    });
  });
});
