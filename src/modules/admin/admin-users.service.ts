import { NotFoundError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import * as userRepo from '../auth/user.repository';
import * as walletRepo from '../billing/wallet.repository';
import { toNumber } from '../billing/utils/decimal';
import type {
  AdminUsersQuery,
  AdminUpdateUserInput,
  AdminUserResponse,
  AdminUserDetailResponse,
  PaginatedUsers,
} from './admin.types';

const log = createServiceLogger('admin-users');

function toUserResponse(record: {
  id: string;
  email: string;
  username: string;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AdminUserResponse {
  return {
    userId: record.id,
    email: record.email,
    username: record.username,
    role: record.role,
    status: record.status,
    emailVerified: record.emailVerified,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function listUsers(query: AdminUsersQuery): Promise<PaginatedUsers> {
  const { users, total } = await userRepo.findAllUsers({
    role: query.role,
    status: query.status,
    page: query.page,
    limit: query.limit,
  });

  const totalPages = Math.ceil(total / query.limit);

  log.info({ page: query.page, total }, 'Listed users');

  return {
    users: users.map(toUserResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
    },
  };
}

export async function getUser(userId: string): Promise<AdminUserDetailResponse> {
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  }

  const wallet = await walletRepo.findWalletByUserId(userId);

  let walletInfo: AdminUserDetailResponse['wallet'] = null;
  if (wallet) {
    const balance = toNumber(wallet.balance);
    const frozen = toNumber(wallet.holdAmount);
    walletInfo = { balance, frozen, available: balance - frozen };
  }

  log.info({ userId }, 'Fetched user detail');

  return {
    ...toUserResponse(user),
    wallet: walletInfo,
  };
}

export async function updateUser(
  userId: string,
  data: AdminUpdateUserInput,
): Promise<AdminUserResponse> {
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  }

  let updated = user;
  if (data.role != null) {
    updated = await userRepo.updateUserRole(userId, data.role);
  }
  if (data.status != null) {
    updated = await userRepo.updateUserStatus(userId, data.status);
  }

  log.info({ userId, data }, 'Updated user');

  return toUserResponse(updated);
}
