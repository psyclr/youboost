import { getPrisma } from '../../shared/database';

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

export async function findByEmail(email: string): Promise<UserRecord | null> {
  const prisma = getPrisma();
  return prisma.user.findUnique({ where: { email } });
}

export async function findByUsername(username: string): Promise<UserRecord | null> {
  const prisma = getPrisma();
  return prisma.user.findUnique({ where: { username } });
}

export async function findById(id: string): Promise<UserRecord | null> {
  const prisma = getPrisma();
  return prisma.user.findUnique({ where: { id } });
}

export async function createUser(data: CreateUserData): Promise<UserRecord> {
  const prisma = getPrisma();
  return prisma.user.create({ data });
}

export async function setEmailVerified(userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true },
  });
}

export async function updatePassword(userId: string, hash: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hash },
  });
}

export async function updateUsername(userId: string, username: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: { username },
  });
}

export async function findAllUsers(filters: {
  role?: string | undefined;
  status?: string | undefined;
  page: number;
  limit: number;
}): Promise<{ users: UserRecord[]; total: number }> {
  const prisma = getPrisma();
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

export async function updateUserRole(userId: string, role: string): Promise<UserRecord> {
  // Validate role against whitelist to prevent SQL injection
  if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    throw new Error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`);
  }

  const prisma = getPrisma();
  return prisma.user.update({
    where: { id: userId },
    data: { role: role as 'USER' | 'RESELLER' | 'ADMIN' },
  });
}

export async function updateUserStatus(userId: string, status: string): Promise<UserRecord> {
  // Validate status against whitelist to prevent SQL injection
  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    throw new Error(`Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const prisma = getPrisma();
  return prisma.user.update({
    where: { id: userId },
    data: { status: status as 'ACTIVE' | 'SUSPENDED' | 'BANNED' },
  });
}
