import pino from 'pino';

export const logger = pino({ name: 'blog-engine' });

export function createLogger(module: string) {
  return logger.child({ module });
}
