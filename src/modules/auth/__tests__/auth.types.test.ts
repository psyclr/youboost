import {
  registerSchema,
  loginSchema,
  refreshSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../auth.types';

describe('Auth Validation Schemas', () => {
  describe('registerSchema', () => {
    const valid = { email: 'test@test.com', password: 'Password1', username: 'john_doe' };

    it('should accept valid input', () => {
      expect(() => registerSchema.parse(valid)).not.toThrow();
    });

    it('should reject invalid email', () => {
      expect(() => registerSchema.parse({ ...valid, email: 'bad' })).toThrow();
    });

    it('should reject short password', () => {
      expect(() => registerSchema.parse({ ...valid, password: 'Abc1' })).toThrow();
    });

    it('should reject password without uppercase', () => {
      expect(() => registerSchema.parse({ ...valid, password: 'password1' })).toThrow();
    });

    it('should reject password without lowercase', () => {
      expect(() => registerSchema.parse({ ...valid, password: 'PASSWORD1' })).toThrow();
    });

    it('should reject password without digit', () => {
      expect(() => registerSchema.parse({ ...valid, password: 'Password' })).toThrow();
    });

    it('should reject short username', () => {
      expect(() => registerSchema.parse({ ...valid, username: 'ab' })).toThrow();
    });

    it('should reject username with special chars', () => {
      expect(() => registerSchema.parse({ ...valid, username: 'john@doe' })).toThrow();
    });

    it('should accept username with underscores', () => {
      expect(() => registerSchema.parse({ ...valid, username: 'john_doe_123' })).not.toThrow();
    });
  });

  describe('loginSchema', () => {
    it('should accept valid input', () => {
      expect(() => loginSchema.parse({ email: 'a@b.com', password: 'x' })).not.toThrow();
    });

    it('should reject empty password', () => {
      expect(() => loginSchema.parse({ email: 'a@b.com', password: '' })).toThrow();
    });
  });

  describe('refreshSchema', () => {
    it('should accept valid token', () => {
      expect(() => refreshSchema.parse({ refreshToken: 'abc123' })).not.toThrow();
    });

    it('should reject empty token', () => {
      expect(() => refreshSchema.parse({ refreshToken: '' })).toThrow();
    });
  });

  describe('verifyEmailSchema', () => {
    it('should accept valid token', () => {
      expect(() => verifyEmailSchema.parse({ token: 'abc' })).not.toThrow();
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should accept valid email', () => {
      expect(() => forgotPasswordSchema.parse({ email: 'a@b.com' })).not.toThrow();
    });

    it('should reject invalid email', () => {
      expect(() => forgotPasswordSchema.parse({ email: 'bad' })).toThrow();
    });
  });

  describe('resetPasswordSchema', () => {
    it('should accept valid input', () => {
      const input = { token: 'abc', newPassword: 'NewPass123' };
      expect(() => resetPasswordSchema.parse(input)).not.toThrow();
    });

    it('should reject weak new password', () => {
      expect(() => resetPasswordSchema.parse({ token: 'abc', newPassword: 'weak' })).toThrow();
    });
  });
});
