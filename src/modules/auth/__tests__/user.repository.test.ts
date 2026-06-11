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

function makePrismaMock(): {
  prisma: PrismaClient;
  user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
} {
  const user = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const prisma = { user } as unknown as PrismaClient;
  return { prisma, user };
}

describe('UserRepository Google methods', () => {
  it('findByGoogleId queries by googleId', async () => {
    const { prisma, user } = makePrismaMock();
    user.findUnique.mockResolvedValue({ id: 'u1' });
    const repo = createUserRepository(prisma);
    const found = await repo.findByGoogleId('g-123');
    expect(user.findUnique).toHaveBeenCalledWith({ where: { googleId: 'g-123' } });
    expect(found).toEqual({ id: 'u1' });
  });

  it('createGoogleUser creates a verified, password-less user', async () => {
    const { prisma, user } = makePrismaMock();
    user.create.mockResolvedValue({ id: 'u2' });
    const repo = createUserRepository(prisma);
    await repo.createGoogleUser({ email: 'a@b.com', username: 'ab', googleId: 'g-9' });
    expect(user.create).toHaveBeenCalledWith({
      data: {
        email: 'a@b.com',
        username: 'ab',
        googleId: 'g-9',
        passwordHash: null,
        emailVerified: true,
      },
    });
  });

  it('createGoogleUser recovers from a concurrent-create unique violation (P2002) by refetching', async () => {
    const { prisma, user } = makePrismaMock();
    const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    user.create.mockRejectedValue(p2002);
    user.findUnique.mockResolvedValueOnce({ id: 'u-existing' });
    const repo = createUserRepository(prisma);
    const result = await repo.createGoogleUser({ email: 'a@b.com', username: 'ab', googleId: 'g-9' });
    expect(result).toEqual({ id: 'u-existing' });
    expect(user.findUnique).toHaveBeenCalledWith({ where: { googleId: 'g-9' } });
  });

  it('createGoogleUser falls back to email lookup when googleId refetch misses', async () => {
    const { prisma, user } = makePrismaMock();
    const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    user.create.mockRejectedValue(p2002);
    user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'u-by-email' });
    const repo = createUserRepository(prisma);
    const result = await repo.createGoogleUser({ email: 'a@b.com', username: 'ab', googleId: 'g-9' });
    expect(result).toEqual({ id: 'u-by-email' });
    expect(user.findUnique).toHaveBeenCalledWith({ where: { email: 'a@b.com' } });
  });

  it('createGoogleUser rethrows non-P2002 errors', async () => {
    const { prisma, user } = makePrismaMock();
    user.create.mockRejectedValue(new Error('connection lost'));
    const repo = createUserRepository(prisma);
    await expect(
      repo.createGoogleUser({ email: 'a@b.com', username: 'ab', googleId: 'g-9' }),
    ).rejects.toThrow('connection lost');
  });

  it('linkGoogleId sets googleId on an existing user', async () => {
    const { prisma, user } = makePrismaMock();
    user.update.mockResolvedValue({ id: 'u3', googleId: 'g-1' });
    const repo = createUserRepository(prisma);
    await repo.linkGoogleId('u3', 'g-1');
    expect(user.update).toHaveBeenCalledWith({
      where: { id: 'u3' },
      data: { googleId: 'g-1' },
    });
  });
});
