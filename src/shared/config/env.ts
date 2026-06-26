import { z } from 'zod/v4';
import type { AppConfig } from './env.types';

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

  // Ops alerts (optional — exhausted-order alerts are logged but not emailed when unset)
  ADMIN_ALERT_EMAIL: z.string().optional(),

  // Yandex.Metrika server-side conversions (optional — disabled when OAuth token unset)
  YANDEX_METRIKA_COUNTER_ID: z.string().default('109942271'),
  YANDEX_METRIKA_OAUTH_TOKEN: z.string().optional(),
  YANDEX_METRIKA_PURCHASE_TARGET: z.string().default('purchase'),
  YANDEX_METRIKA_DEPOSIT_TARGET: z.string().default('deposit'),

  // Cryptomus (optional)
  CRYPTOMUS_MERCHANT_ID: z.string().optional(),
  CRYPTOMUS_PAYMENT_API_KEY: z.string().optional(),
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

  // Google OAuth (optional — feature disabled when unset)
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_REDIRECT_URI: z.string().default(''),
  WEB_URL: z.string().default('http://localhost:3001'),

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
  // Max POST /auth/login attempts per 15-min window. Defaults to 10 (prod
  // brute-force guard); raise in the dev/test backend so the e2e suite, which
  // logs in many times, does not flake on the limit.
  LOGIN_RATE_LIMIT_MAX: z
    .string()
    .default('10')
    .transform((val) => Number.parseInt(val, 10)),
  CORS_ORIGIN: z.string().min(1),

  PROVIDER_ENCRYPTION_KEY: z.string().min(32),
  PROVIDER_MODE: z.enum(['stub', 'real']).default('stub'),
  // Test-only: when 'true', guest checkout returns a deterministic provider
  // checkout URL without calling Stripe/Cryptomus. For the isolated e2e stack —
  // NEVER enable in prod. Default false.
  PAYMENTS_FAKE: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),

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
  BILLING_PENDING_PAYMENT_TTL_MINUTES: z
    .string()
    .default('60')
    .transform((val) => Number.parseInt(val, 10)),
});

export type { AppConfig };

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
      webUrl: parsed.WEB_URL,
    },
    google: {
      clientId: parsed.GOOGLE_CLIENT_ID,
      clientSecret: parsed.GOOGLE_CLIENT_SECRET,
      redirectUri: parsed.GOOGLE_REDIRECT_URI,
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
      loginRateLimitMax: parsed.LOGIN_RATE_LIMIT_MAX,
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
      paymentKey: parsed.CRYPTOMUS_PAYMENT_API_KEY,
      callbackUrl: parsed.CRYPTOMUS_CALLBACK_URL,
    },
    analytics: {
      yandexMetrika: {
        counterId: parsed.YANDEX_METRIKA_COUNTER_ID,
        oauthToken: parsed.YANDEX_METRIKA_OAUTH_TOKEN,
        purchaseTarget: parsed.YANDEX_METRIKA_PURCHASE_TARGET,
        depositTarget: parsed.YANDEX_METRIKA_DEPOSIT_TARGET,
      },
    },
    alerts: {
      adminEmail: parsed.ADMIN_ALERT_EMAIL,
    },
    payments: {
      fake: parsed.PAYMENTS_FAKE,
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
      pendingPaymentTtlMinutes: parsed.BILLING_PENDING_PAYMENT_TTL_MINUTES,
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
