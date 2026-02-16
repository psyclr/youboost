import type { FastifyRequest } from 'fastify';
import { requireAdmin } from '../providers.middleware';

describe('requireAdmin', () => {
  it('should pass for ADMIN role', () => {
    const request = {
      user: { userId: 'u1', email: 'a@b.com', role: 'ADMIN', jti: 'j1' },
    } as FastifyRequest;
    expect(() => requireAdmin(request)).not.toThrow();
  });

  it('should throw ForbiddenError for USER role', () => {
    const request = {
      user: { userId: 'u1', email: 'a@b.com', role: 'USER', jti: 'j1' },
    } as FastifyRequest;
    expect(() => requireAdmin(request)).toThrow('Admin access required');
  });

  it('should throw ForbiddenError for RESELLER role', () => {
    const request = {
      user: { userId: 'u1', email: 'a@b.com', role: 'RESELLER', jti: 'j1' },
    } as FastifyRequest;
    expect(() => requireAdmin(request)).toThrow('Admin access required');
  });

  it('should throw ForbiddenError when no user', () => {
    const request = {} as FastifyRequest;
    expect(() => requireAdmin(request)).toThrow('Admin access required');
  });
});
