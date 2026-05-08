import { listUsers, getUser, updateUser } from '../admin-users.service';

const mockFindAllUsers = jest.fn();
const mockFindById = jest.fn();
const mockUpdateUserRole = jest.fn();
const mockUpdateUserStatus = jest.fn();

jest.mock('../../auth/user.repository', () => ({
  findAllUsers: (...args: unknown[]): unknown => mockFindAllUsers(...args),
  findById: (...args: unknown[]): unknown => mockFindById(...args),
  updateUserRole: (...args: unknown[]): unknown => mockUpdateUserRole(...args),
  updateUserStatus: (...args: unknown[]): unknown => mockUpdateUserStatus(...args),
}));

const mockFindWalletByUserId = jest.fn();

jest.mock('../../billing', () => ({
  walletRepo: {
    findWalletByUserId: (...args: unknown[]): unknown => mockFindWalletByUserId(...args),
  },
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockUser = {
  id: 'user-1',
  email: 'user@test.com',
  username: 'testuser',
  passwordHash: 'hash',
  role: 'USER',
  status: 'ACTIVE',
  emailVerified: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('Admin Users Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listUsers', () => {
    it('should return paginated users', async () => {
      mockFindAllUsers.mockResolvedValue({ users: [mockUser], total: 1 });

      const result = await listUsers({ page: 1, limit: 20 });

      expect(result.users).toHaveLength(1);
      const first = result.users[0];
      expect(first?.userId).toBe('user-1');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should pass role and status filters', async () => {
      mockFindAllUsers.mockResolvedValue({ users: [], total: 0 });

      await listUsers({ page: 1, limit: 20, role: 'ADMIN', status: 'ACTIVE' });

      expect(mockFindAllUsers).toHaveBeenCalledWith({
        role: 'ADMIN',
        status: 'ACTIVE',
        page: 1,
        limit: 20,
      });
    });

    it('should calculate totalPages correctly', async () => {
      mockFindAllUsers.mockResolvedValue({ users: [], total: 45 });

      const result = await listUsers({ page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });

    it('should return empty list when no users match', async () => {
      mockFindAllUsers.mockResolvedValue({ users: [], total: 0 });

      const result = await listUsers({ page: 1, limit: 20 });

      expect(result.users).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should not include passwordHash in response', async () => {
      mockFindAllUsers.mockResolvedValue({ users: [mockUser], total: 1 });

      const result = await listUsers({ page: 1, limit: 20 });

      expect(result.users[0]).not.toHaveProperty('passwordHash');
    });
  });

  describe('getUser', () => {
    it('should return user detail with wallet info', async () => {
      mockFindById.mockResolvedValue(mockUser);
      mockFindWalletByUserId.mockResolvedValue({
        id: 'w-1',
        userId: 'user-1',
        balance: 100,
        holdAmount: 20,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await getUser('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.wallet).toEqual({ balance: 100, frozen: 20, available: 80 });
    });

    it('should return null wallet when no wallet exists', async () => {
      mockFindById.mockResolvedValue(mockUser);
      mockFindWalletByUserId.mockResolvedValue(null);

      const result = await getUser('user-1');

      expect(result.wallet).toBeNull();
    });

    it('should throw NotFoundError when user not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(getUser('nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('updateUser', () => {
    it('should update user role', async () => {
      mockFindById.mockResolvedValue(mockUser);
      mockUpdateUserRole.mockResolvedValue({ ...mockUser, role: 'ADMIN' });

      const result = await updateUser('user-1', { role: 'ADMIN' });

      expect(result.role).toBe('ADMIN');
      expect(mockUpdateUserRole).toHaveBeenCalledWith('user-1', 'ADMIN');
    });

    it('should update user status', async () => {
      mockFindById.mockResolvedValue(mockUser);
      mockUpdateUserStatus.mockResolvedValue({ ...mockUser, status: 'SUSPENDED' });

      const result = await updateUser('user-1', { status: 'SUSPENDED' });

      expect(result.status).toBe('SUSPENDED');
      expect(mockUpdateUserStatus).toHaveBeenCalledWith('user-1', 'SUSPENDED');
    });

    it('should update both role and status', async () => {
      mockFindById.mockResolvedValue(mockUser);
      mockUpdateUserRole.mockResolvedValue({ ...mockUser, role: 'RESELLER' });
      mockUpdateUserStatus.mockResolvedValue({ ...mockUser, role: 'RESELLER', status: 'BANNED' });

      const result = await updateUser('user-1', { role: 'RESELLER', status: 'BANNED' });

      expect(result.role).toBe('RESELLER');
      expect(result.status).toBe('BANNED');
    });

    it('should throw NotFoundError when user not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(updateUser('nonexistent', { role: 'ADMIN' })).rejects.toThrow('User not found');
    });

    it('should return user unchanged when no fields provided', async () => {
      mockFindById.mockResolvedValue(mockUser);

      const result = await updateUser('user-1', {});

      expect(result.userId).toBe('user-1');
      expect(mockUpdateUserRole).not.toHaveBeenCalled();
      expect(mockUpdateUserStatus).not.toHaveBeenCalled();
    });
  });
});
