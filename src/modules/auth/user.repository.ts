import { getPrisma } from '../../shared/database';

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
