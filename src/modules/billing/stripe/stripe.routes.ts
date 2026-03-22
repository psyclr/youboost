import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError, ValidationError } from '../../../shared/errors';
import { authenticate } from '../../auth/auth.middleware';
import * as stripeService from './stripe.service';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { z } from 'zod/v4';

// Extend FastifyRequest to include rawBody for webhook processing
declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

const checkoutSchema = z.object({
  amount: z.number().min(5).max(10_000),
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
  // Add content type parser for Stripe webhooks to capture raw body
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    // Store raw body as Buffer for webhook route
    if (req.url === '/webhook') {
      // Type assertion to ensure body is a Buffer
      const bufferBody = body as Buffer;
      req.rawBody = bufferBody;
      try {
        const json = JSON.parse(bufferBody.toString('utf8'));
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    } else {
      // For non-webhook routes, parse normally
      const bufferBody = body as Buffer;
      try {
        const json = JSON.parse(bufferBody.toString('utf8'));
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
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
