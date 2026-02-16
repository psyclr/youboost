import { z } from 'zod/v4';

const envSchema = z.object({
  DATABASE_URL: z.url(),
  REDIS_URL: z.string().min(1),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('3000')
    .transform((val) => {
      const parsed = Number.parseInt(val, 10);
      if (Number.isNaN(parsed)) {
        throw new Error(`Invalid PORT: ${val}`);
      }
      return parsed;
    }),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  BCRYPT_ROUNDS: z
    .string()
    .default('10')
    .transform((val) => Number.parseInt(val, 10)),
  RATE_LIMIT_MAX: z
    .string()
    .default('100')
    .transform((val) => Number.parseInt(val, 10)),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default('60000')
    .transform((val) => Number.parseInt(val, 10)),
  CORS_ORIGIN: z.string().default('*'),

  PROVIDER_ENCRYPTION_KEY: z.string().min(32),
  PROVIDER_MODE: z.enum(['stub', 'real']).default('stub'),

  ORDER_POLL_INTERVAL_MS: z
    .string()
    .default('30000')
    .transform((val) => Number.parseInt(val, 10)),
  ORDER_POLL_BATCH_SIZE: z
    .string()
    .default('100')
    .transform((val) => Number.parseInt(val, 10)),
  CIRCUIT_BREAKER_THRESHOLD: z
    .string()
    .default('5')
    .transform((val) => Number.parseInt(val, 10)),
  CIRCUIT_BREAKER_COOLDOWN_MS: z
    .string()
    .default('60000')
    .transform((val) => Number.parseInt(val, 10)),
});

export interface AppConfig {
  db: { url: string };
  redis: { url: string };
  app: {
    nodeEnv: 'development' | 'production' | 'test';
    port: number;
    logLevel: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  security: {
    bcryptRounds: number;
    rateLimitMax: number;
    rateLimitWindowMs: number;
    corsOrigin: string;
  };
  provider: {
    encryptionKey: string;
    mode: 'stub' | 'real';
  };
  polling: {
    intervalMs: number;
    batchSize: number;
    circuitBreakerThreshold: number;
    circuitBreakerCooldownMs: number;
  };
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.parse(env);

  const config: AppConfig = {
    db: { url: parsed.DATABASE_URL },
    redis: { url: parsed.REDIS_URL },
    app: {
      nodeEnv: parsed.NODE_ENV,
      port: parsed.PORT,
      logLevel: parsed.LOG_LEVEL,
    },
    jwt: {
      secret: parsed.JWT_SECRET,
      expiresIn: parsed.JWT_EXPIRES_IN,
      refreshSecret: parsed.JWT_REFRESH_SECRET,
      refreshExpiresIn: parsed.JWT_REFRESH_EXPIRES_IN,
    },
    security: {
      bcryptRounds: parsed.BCRYPT_ROUNDS,
      rateLimitMax: parsed.RATE_LIMIT_MAX,
      rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
      corsOrigin: parsed.CORS_ORIGIN,
    },
    provider: {
      encryptionKey: parsed.PROVIDER_ENCRYPTION_KEY,
      mode: parsed.PROVIDER_MODE,
    },
    polling: {
      intervalMs: parsed.ORDER_POLL_INTERVAL_MS,
      batchSize: parsed.ORDER_POLL_BATCH_SIZE,
      circuitBreakerThreshold: parsed.CIRCUIT_BREAKER_THRESHOLD,
      circuitBreakerCooldownMs: parsed.CIRCUIT_BREAKER_COOLDOWN_MS,
    },
  };

  return Object.freeze(config);
}

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

export function resetConfig(): void {
  _config = null;
}
