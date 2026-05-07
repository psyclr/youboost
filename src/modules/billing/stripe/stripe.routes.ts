import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError, ValidationError } from '../../../shared/errors';
import { authenticate } from '../../auth';
import * as stripeService from './stripe.service';
import type { AuthenticatedUser } from '../../auth';
import { z } from 'zod/v4';

// Extend FastifyRequest to include rawBody for webhook processing
declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

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

export async function stripeRoutes(app: FastifyInstance): Promise<void> {
  // Capture raw body for all JSON requests in this plugin scope.
  // Fastify plugin encapsulation limits this parser to /billing/stripe/* routes,
  // so other modules keep their default JSON parsing.
  // rawBody is required by Stripe webhook signature verification (constructEvent).
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    const buf = body as Buffer;
    req.rawBody = buf;
    try {
      done(null, JSON.parse(buf.toString('utf8')));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Create Stripe checkout session (authenticated)
  app.post(
    '/checkout',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const input = validateBody(checkoutSchema, request.body);
      const result = await stripeService.createCheckoutSession(user.userId, input);
      return reply.status(StatusCodes.OK).send(result);
    },
  );

  // Stripe webhook handler (no auth - Stripe signature verification)
  app.post('/webhook', {}, async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers['stripe-signature'] as string;
    if (!signature) {
      return reply
        .status(StatusCodes.BAD_REQUEST)
        .send({ error: 'Missing stripe-signature header' });
    }

    if (!request.rawBody) {
      return reply
        .status(StatusCodes.BAD_REQUEST)
        .send({ error: 'Missing raw body for signature verification' });
    }

    const rawBody = request.rawBody.toString('utf8');

    try {
      await stripeService.handleWebhookEvent(rawBody, signature);
      return reply.status(StatusCodes.OK).send({ received: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook processing failed';
      return reply.status(StatusCodes.BAD_REQUEST).send({ error: message });
    }
  });
}
