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

export interface CreateLoggerOptions {
  level?: string;
  nodeEnv?: string;
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const nodeEnv = options.nodeEnv ?? process.env['NODE_ENV'] ?? 'development';
  const isDevelopment = nodeEnv !== 'production' && nodeEnv !== 'test';
  const isTest = nodeEnv === 'test';

  const baseConfig: pino.LoggerOptions = {
    level: isTest ? 'silent' : (options.level ?? process.env['LOG_LEVEL'] ?? 'info'),
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
    base: {
      env: nodeEnv,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (isDevelopment) {
    const devTransport: pino.TransportSingleOptions = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
    return pino({ ...baseConfig, transport: devTransport });
  }

  return pino(baseConfig);
}

// Default shared logger — used by modules not yet converted to factory DI.
// Delete in Phase 18 (sweep).
export const logger: Logger = createLogger();

export function createServiceLogger(serviceName: string): Logger {
  return logger.child({ service: serviceName });
}

export function createRequestLogger(requestId: string): Logger {
  return logger.child({ requestId });
}
