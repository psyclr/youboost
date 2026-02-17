import {
  findByEmail,
  findByUsername,
  findById,
  createUser,
  setEmailVerified,
  updatePassword,
  findAllUsers,
  updateUserRole,
  updateUserStatus,
} from '../user.repository';

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

const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

const mockFindMany = jest.fn();
const mockCount = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: jest.fn().mockReturnValue({
    user: {
      findUnique: (...args: unknown[]): unknown => mockFindUnique(...args),
      create: (...args: unknown[]): unknown => mockCreate(...args),
      update: (...args: unknown[]): unknown => mockUpdate(...args),
      findMany: (...args: unknown[]): unknown => mockFindMany(...args),
      count: (...args: unknown[]): unknown => mockCount(...args),
    },
  }),
}));

describe('User Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      mockFindUnique.mockResolvedValue(mockUser);
      const result = await findByEmail('test@test.com');
      expect(result).toEqual(mockUser);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { email: 'test@test.com' } });
    });

    it('should return null when not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      const result = await findByEmail('nope@test.com');
      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should find user by username', async () => {
      mockFindUnique.mockResolvedValue(mockUser);
      const result = await findByUsername('testuser');
      expect(result).toEqual(mockUser);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { username: 'testuser' } });
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      mockFindUnique.mockResolvedValue(mockUser);
      const result = await findById('123');
      expect(result).toEqual(mockUser);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: '123' } });
    });
  });

  describe('createUser', () => {
    it('should create a user', async () => {
      mockCreate.mockResolvedValue(mockUser);
      const data = { email: 'test@test.com', username: 'testuser', passwordHash: 'hash' };
      const result = await createUser(data);
      expect(result).toEqual(mockUser);
      expect(mockCreate).toHaveBeenCalledWith({ data });
    });
  });

  describe('setEmailVerified', () => {
    it('should update emailVerified to true', async () => {
      mockUpdate.mockResolvedValue(mockUser);
      await setEmailVerified('123');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { emailVerified: true },
      });
    });
  });

  describe('updatePassword', () => {
    it('should update password hash', async () => {
      mockUpdate.mockResolvedValue(mockUser);
      await updatePassword('123', 'newhash');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { passwordHash: 'newhash' },
      });
    });
  });

  describe('findAllUsers', () => {
    it('should return paginated users', async () => {
      mockFindMany.mockResolvedValue([mockUser]);
      mockCount.mockResolvedValue(1);
      const result = await findAllUsers({ page: 1, limit: 20 });
      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by role and status', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      await findAllUsers({ page: 1, limit: 20, role: 'ADMIN', status: 'ACTIVE' });
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'ADMIN', status: 'ACTIVE' } }),
      );
    });

    it('should apply pagination offset', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      await findAllUsers({ page: 2, limit: 10 });
      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    });
  });

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      mockUpdate.mockResolvedValue({ ...mockUser, role: 'ADMIN' });
      const result = await updateUserRole('123', 'ADMIN');
      expect(result.role).toBe('ADMIN');
      expect(mockUpdate).toHaveBeenCalledWith({ where: { id: '123' }, data: { role: 'ADMIN' } });
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status', async () => {
      mockUpdate.mockResolvedValue({ ...mockUser, status: 'SUSPENDED' });
      const result = await updateUserStatus('123', 'SUSPENDED');
      expect(result.status).toBe('SUSPENDED');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { status: 'SUSPENDED' },
      });
    });
  });
});
