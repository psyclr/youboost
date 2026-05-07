import { register, login, refresh, logout, getMe } from '../auth.service';

const mockFindByEmail = jest.fn();
const mockFindByUsername = jest.fn();
const mockFindById = jest.fn();
const mockCreateUser = jest.fn();

jest.mock('../user.repository', () => ({
  findByEmail: (...args: unknown[]): unknown => mockFindByEmail(...args),
  findByUsername: (...args: unknown[]): unknown => mockFindByUsername(...args),
  findById: (...args: unknown[]): unknown => mockFindById(...args),
  createUser: (...args: unknown[]): unknown => mockCreateUser(...args),
}));

const mockSaveRefresh = jest.fn();
const mockFindRefresh = jest.fn();
const mockRevokeRefresh = jest.fn();
const mockRevokeAll = jest.fn();
const mockBlacklist = jest.fn();

jest.mock('../token.repository', () => ({
  saveRefreshToken: (...args: unknown[]): unknown => mockSaveRefresh(...args),
  findRefreshToken: (...args: unknown[]): unknown => mockFindRefresh(...args),
  revokeRefreshToken: (...args: unknown[]): unknown => mockRevokeRefresh(...args),
  revokeAllUserTokens: (...args: unknown[]): unknown => mockRevokeAll(...args),
  blacklistAccessToken: (...args: unknown[]): unknown => mockBlacklist(...args),
}));

jest.mock('../utils/password', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed'),
  comparePassword: jest.fn().mockResolvedValue(true),
}));

jest.mock('../utils/tokens', () => ({
  generateAccessToken: jest.fn().mockReturnValue('access-token'),
  generateRefreshToken: jest.fn().mockReturnValue('refresh-token'),
  hashToken: jest.fn().mockReturnValue('hashed-token'),
  getRefreshExpiresAt: jest.fn().mockReturnValue(new Date('2030-01-01')),
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
  email: 'test@test.com',
  username: 'testuser',
  passwordHash: 'hash',
  role: 'USER',
  status: 'ACTIVE',
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      mockFindByEmail.mockResolvedValue(null);
      mockFindByUsername.mockResolvedValue(null);
      mockCreateUser.mockResolvedValue(mockUser);

      const result = await register({
        email: 'test@test.com',
        password: 'Password1',
        username: 'testuser',
      });

      expect(result.userId).toBe('user-1');
      expect(result.email).toBe('test@test.com');
      expect(result.username).toBe('testuser');
    });

    it('should throw ConflictError if email taken', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);
      await expect(
        register({
          email: 'test@test.com',
          password: 'Password1',
          username: 'newuser',
        }),
      ).rejects.toThrow('Email or username already taken');
    });

    it('should throw ConflictError if username taken', async () => {
      mockFindByEmail.mockResolvedValue(null);
      mockFindByUsername.mockResolvedValue(mockUser);
      await expect(
        register({
          email: 'new@test.com',
          password: 'Password1',
          username: 'testuser',
        }),
      ).rejects.toThrow('Email or username already taken');
    });
  });

  describe('login', () => {
    it('should return token pair on valid credentials', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);

      const result = await login({ email: 'test@test.com', password: 'Password1' });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.tokenType).toBe('Bearer');
      expect(mockSaveRefresh).toHaveBeenCalled();
    });

    it('should throw UnauthorizedError if user not found', async () => {
      mockFindByEmail.mockResolvedValue(null);
      await expect(login({ email: 'no@test.com', password: 'x' })).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedError if account inactive', async () => {
      mockFindByEmail.mockResolvedValue({ ...mockUser, status: 'SUSPENDED' });
      await expect(login({ email: 'test@test.com', password: 'x' })).rejects.toThrow(
        'Account is not active',
      );
    });

    it('should throw UnauthorizedError if password wrong', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);
      const { comparePassword } = jest.requireMock('../utils/password') as {
        comparePassword: jest.Mock;
      };
      comparePassword.mockResolvedValueOnce(false);
      await expect(login({ email: 'test@test.com', password: 'wrong' })).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('refresh', () => {
    it('should return new access token', async () => {
      mockFindRefresh.mockResolvedValue({ userId: 'user-1', tokenHash: 'h' });
      mockFindById.mockResolvedValue(mockUser);

      const result = await refresh('old-refresh-token');

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(mockRevokeRefresh).toHaveBeenCalled();
      expect(mockSaveRefresh).toHaveBeenCalled();
    });

    it('should throw if refresh token not found', async () => {
      mockFindRefresh.mockResolvedValue(null);
      await expect(refresh('bad-token')).rejects.toThrow('Invalid refresh token');
    });

    it('should throw if user not found', async () => {
      mockFindRefresh.mockResolvedValue({ userId: 'gone', tokenHash: 'h' });
      mockFindById.mockResolvedValue(null);
      await expect(refresh('some-token')).rejects.toThrow('User not found');
    });
  });

  describe('logout', () => {
    it('should revoke tokens and blacklist access token', async () => {
      await logout('user-1', 'jti-123');
      expect(mockRevokeAll).toHaveBeenCalledWith('user-1');
      expect(mockBlacklist).toHaveBeenCalledWith('jti-123', 3600);
    });
  });

  describe('getMe', () => {
    it('should return user profile', async () => {
      mockFindById.mockResolvedValue(mockUser);
      const profile = await getMe('user-1');
      expect(profile.userId).toBe('user-1');
      expect(profile.email).toBe('test@test.com');
      expect(profile.username).toBe('testuser');
    });

    it('should throw NotFoundError if user not found', async () => {
      mockFindById.mockResolvedValue(null);
      await expect(getMe('gone')).rejects.toThrow('User not found');
    });
  });
});
