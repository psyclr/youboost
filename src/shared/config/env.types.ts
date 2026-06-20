/**
 * Shape of the validated application configuration. Kept separate from the
 * loader (`env.ts`) so the schema/parsing logic and the consumed type each stay
 * focused and under the file-size budget.
 */
export interface AppConfig {
  db: { url: string };
  redis: { url: string };
  app: {
    nodeEnv: 'development' | 'production' | 'test';
    port: number;
    logLevel: string;
    url: string;
    webUrl: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
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
    loginRateLimitMax: number;
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
  analytics: {
    yandexMetrika: {
      counterId: string;
      oauthToken: string | undefined;
      purchaseTarget: string;
      depositTarget: string;
    };
  };
  provider: {
    encryptionKey: string;
    mode: 'stub' | 'real';
  };
  payments: {
    fake: boolean;
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
    pendingPaymentTtlMinutes: number;
  };
}
