import { verifyEmail, forgotPassword, resetPassword } from '../auth-email.service';

const mockFindByEmail = jest.fn();
const mockSetEmailVerified = jest.fn();
const mockUpdatePassword = jest.fn();

jest.mock('../user.repository', () => ({
  findByEmail: (...args: unknown[]): unknown => mockFindByEmail(...args),
  setEmailVerified: (...args: unknown[]): unknown => mockSetEmailVerified(...args),
  updatePassword: (...args: unknown[]): unknown => mockUpdatePassword(...args),
}));

jest.mock('../utils/password', () => ({
  hashPassword: jest.fn().mockResolvedValue('new-hash'),
}));

const mockEmailTokenCreate = jest.fn();
const mockEmailTokenFindUnique = jest.fn();
const mockEmailTokenUpdate = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: () => ({
    emailToken: {
      create: (...args: unknown[]): unknown => mockEmailTokenCreate(...args),
      findUnique: (...args: unknown[]): unknown => mockEmailTokenFindUnique(...args),
      update: (...args: unknown[]): unknown => mockEmailTokenUpdate(...args),
    },
  }),
}));

const mockEmailSend = jest.fn();

jest.mock('../../notifications/utils/email-provider-factory', () => ({
  getEmailProvider: () => ({
    send: (...args: unknown[]): unknown => mockEmailSend(...args),
  }),
}));

jest.mock('../../notifications/utils/email-templates', () => ({
  verificationEmail: jest.fn().mockReturnValue({ subject: 'Verify', body: '<html>verify</html>' }),
  passwordResetEmail: jest.fn().mockReturnValue({ subject: 'Reset', body: '<html>reset</html>' }),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

describe('Auth Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      mockEmailTokenFindUnique.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        type: 'VERIFY_EMAIL',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });
      mockEmailTokenUpdate.mockResolvedValue({});
      mockSetEmailVerified.mockResolvedValue({});

      const result = await verifyEmail('some-valid-token');

      expect(result.success).toBe(true);
      expect(mockSetEmailVerified).toHaveBeenCalledWith('user-1');
      expect(mockEmailTokenUpdate).toHaveBeenCalled();
    });

    it('should throw on invalid token', async () => {
      mockEmailTokenFindUnique.mockResolvedValue(null);

      await expect(verifyEmail('bad-token')).rejects.toThrow('Invalid or expired');
    });

    it('should throw on expired token', async () => {
      mockEmailTokenFindUnique.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        type: 'VERIFY_EMAIL',
        expiresAt: new Date(Date.now() - 60_000),
        usedAt: null,
      });

      await expect(verifyEmail('expired-token')).rejects.toThrow('Invalid or expired');
    });

    it('should throw on already used token', async () => {
      mockEmailTokenFindUnique.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        type: 'VERIFY_EMAIL',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
      });

      await expect(verifyEmail('used-token')).rejects.toThrow('Invalid or expired');
    });
  });

  describe('forgotPassword', () => {
    it('should send reset email for existing user', async () => {
      mockFindByEmail.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
      mockEmailTokenCreate.mockResolvedValue({});
      mockEmailSend.mockResolvedValue(undefined);

      const result = await forgotPassword('a@b.com');

      expect(result.success).toBe(true);
      expect(mockEmailTokenCreate).toHaveBeenCalled();
      expect(mockEmailSend).toHaveBeenCalled();
    });

    it('should return success even for non-existing user', async () => {
      mockFindByEmail.mockResolvedValue(null);

      const result = await forgotPassword('nope@test.com');

      expect(result.success).toBe(true);
      expect(mockEmailTokenCreate).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      mockEmailTokenFindUnique.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        type: 'RESET_PASSWORD',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });
      mockEmailTokenUpdate.mockResolvedValue({});
      mockUpdatePassword.mockResolvedValue({});

      const result = await resetPassword('valid-token', 'NewPassword1');

      expect(result.success).toBe(true);
      expect(mockUpdatePassword).toHaveBeenCalledWith('user-1', 'new-hash');
    });

    it('should throw on invalid token', async () => {
      mockEmailTokenFindUnique.mockResolvedValue(null);

      await expect(resetPassword('bad', 'NewPassword1')).rejects.toThrow('Invalid or expired');
    });
  });
});
