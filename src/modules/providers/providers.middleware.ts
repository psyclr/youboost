import type { FastifyRequest } from 'fastify';
import { ForbiddenError } from '../../shared/errors';

export function requireAdmin(request: FastifyRequest): void {
  const user = request.user;
  if (user?.role !== 'ADMIN') {
    throw new ForbiddenError('Admin access required', 'ADMIN_REQUIRED');
  }
}
