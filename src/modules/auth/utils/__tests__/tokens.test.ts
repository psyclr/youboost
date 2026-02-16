import jwt from 'jsonwebtoken';
import {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  generateEmailToken,
  getRefreshExpiresAt,
} from '../tokens';

jest.mock('../../../../shared/config', () => ({
  getConfig: jest.fn().mockReturnValue({
    jwt: {
      secret: 'test-secret-at-least-32-chars-long!!',
      expiresIn: '1h',
      refreshSecret: 'test-refresh-secret-at-least-32chars!!',
      refreshExpiresIn: '30d',
    },
  }),
}));

const TEST_SECRET = 'test-secret-at-least-32-chars-long!!';

describe('Token Utils', () => {
  describe('generateAccessToken', () => {
    it('should generate a valid JWT', () => {
      const token = generateAccessToken({
        userId: '123',
        email: 'test@test.com',
        role: 'USER',
      });

      expect(token).toBeDefined();
      const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload;
      expect(decoded['userId']).toBe('123');
      expect(decoded['email']).toBe('test@test.com');
      expect(decoded['role']).toBe('USER');
      expect(decoded['jti']).toBeDefined();
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify and decode a valid token', () => {
      const token = generateAccessToken({
        userId: '456',
        email: 'a@b.com',
        role: 'ADMIN',
      });

      const result = verifyAccessToken(token);
      expect(result.userId).toBe('456');
      expect(result.email).toBe('a@b.com');
      expect(result.role).toBe('ADMIN');
      expect(result.jti).toBeDefined();
    });

    it('should throw on invalid token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });

    it('should throw on expired token', () => {
      const token = jwt.sign({ userId: '1' }, TEST_SECRET, { expiresIn: '0s' });
      expect(() => verifyAccessToken(token)).toThrow();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a 128-char hex string', () => {
      const token = generateRefreshToken();
      expect(token).toHaveLength(128);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it('should generate unique tokens', () => {
      const t1 = generateRefreshToken();
      const t2 = generateRefreshToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('hashToken', () => {
    it('should produce a consistent SHA-256 hash', () => {
      const hash1 = hashToken('mytoken');
      const hash2 = hashToken('mytoken');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('should produce different hashes for different tokens', () => {
      expect(hashToken('a')).not.toBe(hashToken('b'));
    });
  });

  describe('generateEmailToken', () => {
    it('should generate a 64-char hex string', () => {
      const token = generateEmailToken();
      expect(token).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });
  });

  describe('getRefreshExpiresAt', () => {
    it('should return a future date', () => {
      const expiresAt = getRefreshExpiresAt();
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return approximately 30 days in the future', () => {
      const expiresAt = getRefreshExpiresAt();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const diff = expiresAt.getTime() - Date.now();
      expect(diff).toBeGreaterThan(thirtyDaysMs - 5000);
      expect(diff).toBeLessThan(thirtyDaysMs + 5000);
    });
  });
});
