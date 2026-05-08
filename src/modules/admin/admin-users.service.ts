import type { Logger } from 'pino';
import { NotFoundError } from '../../shared/errors';
import type { UserRepository } from '../auth';
import type { WalletRepository } from '../billing';
import type {
  AdminUsersQuery,
  AdminUpdateUserInput,
  AdminUserResponse,
  AdminUserDetailResponse,
  PaginatedUsers,
} from './admin.types';

export interface AdminUsersService {
  listUsers(query: AdminUsersQuery): Promise<PaginatedUsers>;
  getUser(userId: string): Promise<AdminUserDetailResponse>;
  updateUser(userId: string, data: AdminUpdateUserInput): Promise<AdminUserResponse>;
}

export interface AdminUsersServiceDeps {
  userRepo: UserRepository;
  walletRepo: WalletRepository;
  logger: Logger;
}

export function createAdminUsersService(deps: AdminUsersServiceDeps): AdminUsersService {
  const { userRepo, walletRepo, logger } = deps;

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

  async function listUsers(query: AdminUsersQuery): Promise<PaginatedUsers> {
    const { users, total } = await userRepo.findAllUsers({
      role: query.role,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });

    const totalPages = Math.ceil(total / query.limit);

    logger.info({ page: query.page, total }, 'Listed users');

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

  async function getUser(userId: string): Promise<AdminUserDetailResponse> {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const wallet = await walletRepo.findWalletByUserId(userId);

    let walletInfo: AdminUserDetailResponse['wallet'] = null;
    if (wallet) {
      const balance = Number(wallet.balance);
      const frozen = Number(wallet.holdAmount);
      walletInfo = { balance, frozen, available: balance - frozen };
    }

    logger.info({ userId }, 'Fetched user detail');

    return {
      ...toUserResponse(user),
      wallet: walletInfo,
    };
  }

  async function updateUser(
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

    logger.info({ userId, data }, 'Updated user');

    return toUserResponse(updated);
  }

  return { listUsers, getUser, updateUser };
}
