import { z } from 'zod/v4';

const envSchema = z.object({
  DATABASE_URL: z.url(),
  REDIS_URL: z.string().min(1),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // SMTP (optional — falls back to stub email provider)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z
    .string()
    .default('587')
    .transform((val) => Number.parseInt(val, 10)),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('YouBoost <noreply@youboost.io>'),
  APP_URL: z.string().default('http://localhost:3000'),

  // Stripe (optional)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Cryptomus (optional)
  CRYPTOMUS_MERCHANT_ID: z.string().optional(),
  CRYPTOMUS_PAYMENT_KEY: z.string().optional(),
  // Public URL for Cryptomus webhook callback (required in prod, ngrok URL in dev)
  CRYPTOMUS_CALLBACK_URL: z.string().optional(),
  PORT: z
    .string()
    .default('3000')
    .transform((val) => {
      const parsed = Number.parseInt(val, 10);
      if (Number.isNaN(parsed)) {
        throw new TypeError(`Invalid PORT: ${val}`);
      }
      return parsed;
    }),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  BCRYPT_ROUNDS: z
    .string()
    .default('12')
    .transform((val) => Number.parseInt(val, 10)),
  RATE_LIMIT_MAX: z
    .string()
    .default('100')
    .transform((val) => Number.parseInt(val, 10)),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default('60000')
    .transform((val) => Number.parseInt(val, 10)),
  CORS_ORIGIN: z.string().min(1),

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
  ORDER_TIMEOUT_HOURS: z
    .string()
    .default('72')
    .transform((val) => Number.parseInt(val, 10)),
  API_KEY_RATE_BASIC: z
    .string()
    .default('100')
    .transform((val) => Number.parseInt(val, 10)),
  API_KEY_RATE_PRO: z
    .string()
    .default('500')
    .transform((val) => Number.parseInt(val, 10)),
  API_KEY_RATE_ENTERPRISE: z
    .string()
    .default('2000')
    .transform((val) => Number.parseInt(val, 10)),
  BILLING_MIN_DEPOSIT: z
    .string()
    .default('5')
    .transform((val) => Number.parseInt(val, 10)),
  BILLING_MAX_DEPOSIT: z
    .string()
    .default('10000')
    .transform((val) => Number.parseInt(val, 10)),
  BILLING_DEPOSIT_EXPIRY_MS: z
    .string()
    .default('3600000')
    .transform((val) => Number.parseInt(val, 10)),
});

export interface AppConfig {
  db: { url: string };
  redis: { url: string };
  app: {
    nodeEnv: 'development' | 'production' | 'test';
    port: number;
    logLevel: string;
    url: string;
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
  smtp: {
    host: string | undefined;
    port: number;
    user: string | undefined;
    pass: string | undefined;
    from: string;
  };
  stripe: {
    secretKey: string | undefined;
    webhookSecret: string | undefined;
  };
  cryptomus: {
    merchantId: string | undefined;
    paymentKey: string | undefined;
    callbackUrl: string | undefined;
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
    orderTimeoutHours: number;
  };
  apiKeys: {
    rateBasic: number;
    ratePro: number;
    rateEnterprise: number;
  };
  billing: {
    minDeposit: number;
    maxDeposit: number;
    depositExpiryMs: number;
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
      url: parsed.APP_URL,
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
    smtp: {
      host: parsed.SMTP_HOST,
      port: parsed.SMTP_PORT,
      user: parsed.SMTP_USER,
      pass: parsed.SMTP_PASS,
      from: parsed.SMTP_FROM,
    },
    stripe: {
      secretKey: parsed.STRIPE_SECRET_KEY,
      webhookSecret: parsed.STRIPE_WEBHOOK_SECRET,
    },
    cryptomus: {
      merchantId: parsed.CRYPTOMUS_MERCHANT_ID,
      paymentKey: parsed.CRYPTOMUS_PAYMENT_KEY,
      callbackUrl: parsed.CRYPTOMUS_CALLBACK_URL,
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
      orderTimeoutHours: parsed.ORDER_TIMEOUT_HOURS,
    },
    apiKeys: {
      rateBasic: parsed.API_KEY_RATE_BASIC,
      ratePro: parsed.API_KEY_RATE_PRO,
      rateEnterprise: parsed.API_KEY_RATE_ENTERPRISE,
    },
    billing: {
      minDeposit: parsed.BILLING_MIN_DEPOSIT,
      maxDeposit: parsed.BILLING_MAX_DEPOSIT,
      depositExpiryMs: parsed.BILLING_DEPOSIT_EXPIRY_MS,
    },
  };

  return Object.freeze(config);
}

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  _config ??= loadConfig();
  return _config;
}

export function resetConfig(): void {
  _config = null;
}
