import { createAdminUsersService } from '../admin-users.service';
import { createFakeUserRepo, createFakeWalletRepo, makeUserRecord, silentLogger } from './fakes';

describe('Admin Users Service', () => {
  describe('listUsers', () => {
    it('should return paginated users', async () => {
      const userRepo = createFakeUserRepo({ users: [makeUserRecord({ id: 'user-1' })] });
      const walletRepo = createFakeWalletRepo();
      const service = createAdminUsersService({ userRepo, walletRepo, logger: silentLogger });

      const result = await service.listUsers({ page: 1, limit: 20 });

      expect(result.users).toHaveLength(1);
      expect(result.users[0]?.userId).toBe('user-1');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should pass role and status filters', async () => {
      const userRepo = createFakeUserRepo({
        users: [
          makeUserRecord({ id: 'user-1', role: 'ADMIN', status: 'ACTIVE' }),
          makeUserRecord({ id: 'user-2', role: 'USER', status: 'ACTIVE' }),
        ],
      });
      const walletRepo = createFakeWalletRepo();
      const service = createAdminUsersService({ userRepo, walletRepo, logger: silentLogger });

      const result = await service.listUsers({
        page: 1,
        limit: 20,
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      expect(result.users).toHaveLength(1);
      expect(result.users[0]?.userId).toBe('user-1');
    });

    it('should calculate totalPages correctly', async () => {
      const users = Array.from({ length: 45 }, (_, i) => makeUserRecord({ id: `user-${i}` }));
      const userRepo = createFakeUserRepo({ users });
      const walletRepo = createFakeWalletRepo();
      const service = createAdminUsersService({ userRepo, walletRepo, logger: silentLogger });

      const result = await service.listUsers({ page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });

    it('should return empty list when no users match', async () => {
      const userRepo = createFakeUserRepo();
      const walletRepo = createFakeWalletRepo();
      const service = createAdminUsersService({ userRepo, walletRepo, logger: silentLogger });

      const result = await service.listUsers({ page: 1, limit: 20 });

      expect(result.users).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should not include passwordHash in response', async () => {
      const userRepo = createFakeUserRepo({ users: [makeUserRecord({ id: 'user-1' })] });
      const walletRepo = createFakeWalletRepo();
      const service = createAdminUsersService({ userRepo, walletRepo, logger: silentLogger });

      const result = await service.listUsers({ page: 1, limit: 20 });

      expect(result.users[0]).not.toHaveProperty('passwordHash');
    });
  });

  describe('getUser', () => {
    it('should return user detail with wallet info', async () => {
      const userRepo = createFakeUserRepo({ users: [makeUserRecord({ id: 'user-1' })] });
      const walletRepo = createFakeWalletRepo({ userId: 'user-1', balance: 100, holdAmount: 20 });
      const service = createAdminUsersService({ userRepo, walletRepo, logger: silentLogger });

      const result = await service.getUser('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.wallet).toEqual({ balance: 100, frozen: 20, available: 80 });
    });

    it('should return null wallet when no wallet exists', async () => {
      const userRepo = createFakeUserRepo({ users: [makeUserRecord({ id: 'user-1' })] });
      const walletRepo = createFakeWalletRepo();
      const service = createAdminUsersService({ userRepo, walletRepo, logger: silentLogger });

      const result = await service.getUser('user-1');

      expect(result.wallet).toBeNull();
    });

    it('should throw NotFoundError when user not found', async () => {
      const userRepo = createFakeUserRepo();
      const walletRepo = createFakeWalletRepo();
      const service = createAdminUsersService({ userRepo, walletRepo, logger: silentLogger });

      await expect(service.getUser('nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('updateUser', () => {
    it('should update user role', async () => {
      const userRepo = createFakeUserRepo({
        users: [makeUserRecord({ id: 'user-1', role: 'USER' })],
      });
      const walletRepo = createFakeWalletRepo();
      const service = createAdminUsersService({ userRepo, walletRepo, logger: silentLogger });

      const result = await service.updateUser('user-1', { role: 'ADMIN' });

      expect(result.role).toBe('ADMIN');
      expect(userRepo.users[0]?.role).toBe('ADMIN');
    });

    it('should update user status', async () => {
      const userRepo = createFakeUserRepo({
        users: [makeUserRecord({ id: 'user-1', status: 'ACTIVE' })],
      });
      const walletRepo = createFakeWalletRepo();
      const service = createAdminUsersService({ userRepo, walletRepo, logger: silentLogger });

      const result = await service.updateUser('user-1', { status: 'SUSPENDED' });

      expect(result.status).toBe('SUSPENDED');
      expect(userRepo.users[0]?.status).toBe('SUSPENDED');
    });

    it('should update both role and status', async () => {
      const userRepo = createFakeUserRepo({
        users: [makeUserRecord({ id: 'user-1', role: 'USER', status: 'ACTIVE' })],
      });
      const walletRepo = createFakeWalletRepo();
      const service = createAdminUsersService({ userRepo, walletRepo, logger: silentLogger });

      const result = await service.updateUser('user-1', { role: 'RESELLER', status: 'BANNED' });

      expect(result.role).toBe('RESELLER');
      expect(result.status).toBe('BANNED');
    });

    it('should throw NotFoundError when user not found', async () => {
      const userRepo = createFakeUserRepo();
      const walletRepo = createFakeWalletRepo();
      const service = createAdminUsersService({ userRepo, walletRepo, logger: silentLogger });

      await expect(service.updateUser('nonexistent', { role: 'ADMIN' })).rejects.toThrow(
        'User not found',
      );
    });

    it('should return user unchanged when no fields provided', async () => {
      const userRepo = createFakeUserRepo({ users: [makeUserRecord({ id: 'user-1' })] });
      const walletRepo = createFakeWalletRepo();
      const service = createAdminUsersService({ userRepo, walletRepo, logger: silentLogger });

      const result = await service.updateUser('user-1', {});

      expect(result.userId).toBe('user-1');
    });
  });
});
