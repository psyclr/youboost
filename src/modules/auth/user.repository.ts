import type { PrismaClient } from '../../generated/prisma';

const VALID_ROLES = ['USER', 'RESELLER', 'ADMIN'] as const;
const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED'] as const;

interface CreateUserData {
  email: string;
  username: string;
  passwordHash: string;
}

type UserRecord = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findByUsername(username: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  createUser(data: CreateUserData): Promise<UserRecord>;
  setEmailVerified(userId: string): Promise<void>;
  updatePassword(userId: string, hash: string): Promise<void>;
  updateUsername(userId: string, username: string): Promise<void>;
  findAllUsers(filters: {
    role?: string | undefined;
    status?: string | undefined;
    page: number;
    limit: number;
  }): Promise<{ users: UserRecord[]; total: number }>;
  updateUserRole(userId: string, role: string): Promise<UserRecord>;
  updateUserStatus(userId: string, status: string): Promise<UserRecord>;
}

export function createUserRepository(prisma: PrismaClient): UserRepository {
  async function findByEmail(email: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async function findByUsername(username: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { username } });
  }

  async function findById(id: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async function createUser(data: CreateUserData): Promise<UserRecord> {
    return prisma.user.create({ data });
  }

  async function setEmailVerified(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }

  async function updatePassword(userId: string, hash: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });
  }

  async function updateUsername(userId: string, username: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { username },
    });
  }

  async function findAllUsers(filters: {
    role?: string | undefined;
    status?: string | undefined;
    page: number;
    limit: number;
  }): Promise<{ users: UserRecord[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (filters.role) {
      where.role = filters.role;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  async function updateUserRole(userId: string, role: string): Promise<UserRecord> {
    // Validate role against whitelist to prevent SQL injection
    if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      throw new Error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    return prisma.user.update({
      where: { id: userId },
      data: { role: role as 'USER' | 'RESELLER' | 'ADMIN' },
    });
  }

  async function updateUserStatus(userId: string, status: string): Promise<UserRecord> {
    // Validate status against whitelist to prevent SQL injection
    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    return prisma.user.update({
      where: { id: userId },
      data: { status: status as 'ACTIVE' | 'SUSPENDED' | 'BANNED' },
    });
  }

  return {
    findByEmail,
    findByUsername,
    findById,
    createUser,
    setEmailVerified,
    updatePassword,
    updateUsername,
    findAllUsers,
    updateUserRole,
    updateUserStatus,
  };
}
