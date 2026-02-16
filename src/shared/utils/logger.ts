import pino, { type Logger } from 'pino';

const REDACT_PATHS = [
  'password',
  'passwordHash',
  'token',
  'secret',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
];

const isDevelopment =
  process.env['NODE_ENV'] !== 'production' && process.env['NODE_ENV'] !== 'test';
const isTest = process.env['NODE_ENV'] === 'test';

const baseConfig: pino.LoggerOptions = {
  level: isTest ? 'silent' : (process.env['LOG_LEVEL'] ?? 'info'),
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  base: {
    env: process.env['NODE_ENV'] ?? 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

const devTransport: pino.TransportSingleOptions = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
  },
};

export const logger: Logger = isDevelopment
  ? pino({ ...baseConfig, transport: devTransport })
  : pino(baseConfig);

export function createServiceLogger(serviceName: string): Logger {
  return logger.child({ service: serviceName });
}

export function createRequestLogger(requestId: string): Logger {
  return logger.child({ requestId });
}

export default logger;
