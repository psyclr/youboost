import { authenticate } from '../auth.middleware';
import type { FastifyRequest, FastifyReply } from 'fastify';

const mockVerifyAccessToken = jest.fn();
const mockIsBlacklisted = jest.fn();

jest.mock('../utils/tokens', () => ({
  verifyAccessToken: (...args: unknown[]): unknown => mockVerifyAccessToken(...args),
}));

jest.mock('../token.repository', () => ({
  isAccessTokenBlacklisted: (...args: unknown[]): unknown => mockIsBlacklisted(...args),
}));

function createMockRequest(authHeader?: string): FastifyRequest {
  return {
    headers: {
      authorization: authHeader,
    },
  } as unknown as FastifyRequest;
}

const mockReply = {} as FastifyReply;

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should attach user to request on valid token', async () => {
    const user = { userId: 'u1', email: 'a@b.com', role: 'USER', jti: 'jti-1' };
    mockVerifyAccessToken.mockReturnValue(user);
    mockIsBlacklisted.mockResolvedValue(false);

    const req = createMockRequest('Bearer valid-token');
    await authenticate(req, mockReply);

    expect(req.user).toEqual(user);
    expect(mockVerifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect(mockIsBlacklisted).toHaveBeenCalledWith('jti-1');
  });

  it('should throw if no Authorization header', async () => {
    const req = createMockRequest(undefined);
    await expect(authenticate(req, mockReply)).rejects.toThrow(
      'Missing or invalid Authorization header',
    );
  });

  it('should throw if Authorization header is not Bearer', async () => {
    const req = createMockRequest('Basic abc');
    await expect(authenticate(req, mockReply)).rejects.toThrow(
      'Missing or invalid Authorization header',
    );
  });

  it('should throw if token verification fails', async () => {
    mockVerifyAccessToken.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const req = createMockRequest('Bearer expired-token');
    await expect(authenticate(req, mockReply)).rejects.toThrow('Invalid or expired access token');
  });

  it('should throw if token is blacklisted', async () => {
    const user = { userId: 'u1', email: 'a@b.com', role: 'USER', jti: 'jti-2' };
    mockVerifyAccessToken.mockReturnValue(user);
    mockIsBlacklisted.mockResolvedValue(true);

    const req = createMockRequest('Bearer blacklisted-token');
    await expect(authenticate(req, mockReply)).rejects.toThrow('Token has been revoked');
  });
});
