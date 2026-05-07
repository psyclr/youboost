import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError, ValidationError } from '../../../shared/errors';
import { authenticate } from '../../auth';
import * as cryptomusService from './cryptomus.service';
import type { AuthenticatedUser } from '../../auth';
import { z } from 'zod/v4';

const checkoutSchema = z.object({
  amount: z.coerce.number().min(5).max(10_000),
});

function validateBody<T>(
  schema: {
    safeParse: (data: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } };
  },
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', result.error?.issues);
  }
  return result.data as T;
}

function getAuthUser(request: FastifyRequest): AuthenticatedUser {
  const user = request.user;
  if (!user) {
    throw new UnauthorizedError('Authentication required', 'MISSING_USER');
  }
  return user;
}

export async function cryptomusRoutes(app: FastifyInstance): Promise<void> {
  // Capture raw body for all JSON requests in this plugin scope.
  // Fastify plugin encapsulation limits this parser to /billing/cryptomus/* routes.
  // rawBody is required so webhook signature verification sees the exact payload.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    const buf = body as Buffer;
    req.rawBody = buf;
    try {
      done(null, JSON.parse(buf.toString('utf8')));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.post(
    '/checkout',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const input = validateBody(checkoutSchema, request.body);
      const result = await cryptomusService.createCheckoutSession(user.userId, input);
      return reply.status(StatusCodes.OK).send(result);
    },
  );

  app.post(
    '/webhook',
    { config: { rateLimit: false } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.rawBody) {
        return reply
          .status(StatusCodes.BAD_REQUEST)
          .send({ error: 'Missing raw body for signature verification' });
      }
      const rawBody = request.rawBody.toString('utf8');
      try {
        await cryptomusService.handleWebhookEvent(rawBody);
        return reply.status(StatusCodes.OK).send({ received: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Webhook processing failed';
        return reply.status(StatusCodes.BAD_REQUEST).send({ error: message });
      }
    },
  );
}
