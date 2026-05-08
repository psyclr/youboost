import { createAuthenticate } from '../auth.middleware';
import { createFakeTokenRepository } from './fakes';
import type { FastifyRequest, FastifyReply } from 'fastify';

// preHandlerAsyncHookHandler requires `this: FastifyInstance`; when invoking
// directly from tests we don't bind `this`, so wrap each call via this helper
// that satisfies TS while delegating to the real middleware function.
function invoke(
  mw: ReturnType<typeof createAuthenticate>,
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  return (mw as unknown as (r: FastifyRequest, rp: FastifyReply) => Promise<void>)(req, reply);
}

const mockVerifyAccessToken = jest.fn();

jest.mock('../utils/tokens', () => ({
  verifyAccessToken: (...args: unknown[]): unknown => mockVerifyAccessToken(...args),
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
    const tokenStore = createFakeTokenRepository();
    const authenticate = createAuthenticate({ tokenStore });

    const req = createMockRequest('Bearer valid-token');
    await invoke(authenticate, req, mockReply);

    expect(req.user).toEqual(user);
    expect(mockVerifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect(tokenStore.calls.isAccessTokenBlacklisted).toEqual(['jti-1']);
  });

  it('should throw if no Authorization header', async () => {
    const tokenStore = createFakeTokenRepository();
    const authenticate = createAuthenticate({ tokenStore });
    const req = createMockRequest(undefined);
    await expect(invoke(authenticate, req, mockReply)).rejects.toThrow(
      'Missing or invalid Authorization header',
    );
  });

  it('should throw if Authorization header is not Bearer', async () => {
    const tokenStore = createFakeTokenRepository();
    const authenticate = createAuthenticate({ tokenStore });
    const req = createMockRequest('Basic abc');
    await expect(invoke(authenticate, req, mockReply)).rejects.toThrow(
      'Missing or invalid Authorization header',
    );
  });

  it('should throw if token verification fails', async () => {
    mockVerifyAccessToken.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const tokenStore = createFakeTokenRepository();
    const authenticate = createAuthenticate({ tokenStore });

    const req = createMockRequest('Bearer expired-token');
    await expect(invoke(authenticate, req, mockReply)).rejects.toThrow(
      'Invalid or expired access token',
    );
  });

  it('should throw if token is blacklisted', async () => {
    const user = { userId: 'u1', email: 'a@b.com', role: 'USER', jti: 'jti-2' };
    mockVerifyAccessToken.mockReturnValue(user);
    const tokenStore = createFakeTokenRepository();
    tokenStore.blacklist.add('jti-2');
    const authenticate = createAuthenticate({ tokenStore });

    const req = createMockRequest('Bearer blacklisted-token');
    await expect(invoke(authenticate, req, mockReply)).rejects.toThrow('Token has been revoked');
  });
});
