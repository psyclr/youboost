import type { Logger } from 'pino';

interface FireAndForgetContext {
  operation: string;
  logger: Logger;
  extra?: Record<string, unknown>;
}

export function fireAndForget(promise: Promise<unknown>, context: FireAndForgetContext): void {
  promise.catch((err: unknown) => {
    context.logger.warn({ err, ...context.extra }, `fire-and-forget: ${context.operation}`);
  });
}
