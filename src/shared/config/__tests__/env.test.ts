import { loadConfig, getConfig, resetConfig, type AppConfig } from '../env';

describe('Environment Config', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
    REDIS_URL: 'redis://localhost:6379',
    NODE_ENV: 'test',
    PORT: '3000',
    LOG_LEVEL: 'info',
    JWT_SECRET: 'test-secret-at-least-32-chars-long!!',
    JWT_EXPIRES_IN: '7d',
    JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32chars!!',
    JWT_REFRESH_EXPIRES_IN: '30d',
    BCRYPT_ROUNDS: '10',
    RATE_LIMIT_MAX: '100',
    RATE_LIMIT_WINDOW_MS: '60000',
    CORS_ORIGIN: 'http://localhost:3000',
    PROVIDER_ENCRYPTION_KEY: 'test-encryption-key-at-least-32-chars!',
    PROVIDER_MODE: 'stub',
  };

  it('should parse valid environment variables', () => {
    const config = loadConfig(validEnv);

    expect(config.db.url).toBe(validEnv.DATABASE_URL);
    expect(config.redis.url).toBe(validEnv.REDIS_URL);
    expect(config.app.nodeEnv).toBe('test');
    expect(config.app.port).toBe(3000);
    expect(config.app.logLevel).toBe('info');
    expect(config.jwt.secret).toBe(validEnv.JWT_SECRET);
    expect(config.jwt.expiresIn).toBe('7d');
    expect(config.jwt.refreshSecret).toBe(validEnv.JWT_REFRESH_SECRET);
    expect(config.jwt.refreshExpiresIn).toBe('30d');
    expect(config.security.bcryptRounds).toBe(10);
    expect(config.security.rateLimitMax).toBe(100);
    expect(config.security.rateLimitWindowMs).toBe(60000);
    expect(config.security.corsOrigin).toBe('http://localhost:3000');
    expect(config.provider.encryptionKey).toBe(validEnv.PROVIDER_ENCRYPTION_KEY);
    expect(config.provider.mode).toBe('stub');
  });

  it('should coerce string PORT to number', () => {
    const config = loadConfig({ ...validEnv, PORT: '8080' });
    expect(config.app.port).toBe(8080);
  });

  it('should apply defaults for optional fields', () => {
    const minimal = {
      DATABASE_URL: validEnv.DATABASE_URL,
      REDIS_URL: validEnv.REDIS_URL,
      JWT_SECRET: validEnv.JWT_SECRET,
      JWT_REFRESH_SECRET: validEnv.JWT_REFRESH_SECRET,
      PROVIDER_ENCRYPTION_KEY: validEnv.PROVIDER_ENCRYPTION_KEY,
    };

    const config = loadConfig(minimal);

    expect(config.app.nodeEnv).toBe('development');
    expect(config.app.port).toBe(3000);
    expect(config.app.logLevel).toBe('info');
    expect(config.jwt.expiresIn).toBe('7d');
    expect(config.jwt.refreshExpiresIn).toBe('30d');
    expect(config.security.bcryptRounds).toBe(10);
    expect(config.security.rateLimitMax).toBe(100);
    expect(config.security.rateLimitWindowMs).toBe(60000);
    expect(config.security.corsOrigin).toBe('*');
    expect(config.provider.mode).toBe('stub');
  });

  it('should throw on missing DATABASE_URL', () => {
    const { DATABASE_URL: _, ...env } = validEnv;
    expect(() => loadConfig(env)).toThrow();
  });

  it('should throw on missing REDIS_URL', () => {
    const { REDIS_URL: _, ...env } = validEnv;
    expect(() => loadConfig(env)).toThrow();
  });

  it('should throw on missing JWT_SECRET', () => {
    const { JWT_SECRET: _, ...env } = validEnv;
    expect(() => loadConfig(env)).toThrow();
  });

  it('should throw on invalid NODE_ENV', () => {
    expect(() => loadConfig({ ...validEnv, NODE_ENV: 'invalid' })).toThrow();
  });

  it('should throw on invalid PORT (non-numeric)', () => {
    expect(() => loadConfig({ ...validEnv, PORT: 'abc' })).toThrow();
  });

  it('should return a frozen config object', () => {
    const config = loadConfig(validEnv);
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('should return typed AppConfig', () => {
    const config: AppConfig = loadConfig(validEnv);
    expect(config).toBeDefined();
    expect(config.db).toBeDefined();
    expect(config.redis).toBeDefined();
    expect(config.app).toBeDefined();
    expect(config.jwt).toBeDefined();
    expect(config.security).toBeDefined();
  });

  it('should throw on missing PROVIDER_ENCRYPTION_KEY', () => {
    const { PROVIDER_ENCRYPTION_KEY: _, ...env } = validEnv;
    expect(() => loadConfig(env)).toThrow();
  });

  it('should throw on PROVIDER_ENCRYPTION_KEY shorter than 32 chars', () => {
    expect(() => loadConfig({ ...validEnv, PROVIDER_ENCRYPTION_KEY: 'short-key' })).toThrow();
  });

  it('should default PROVIDER_MODE to stub', () => {
    const { PROVIDER_MODE: _, ...env } = validEnv;
    const config = loadConfig(env);
    expect(config.provider.mode).toBe('stub');
  });

  it('should accept PROVIDER_MODE real', () => {
    const config = loadConfig({ ...validEnv, PROVIDER_MODE: 'real' });
    expect(config.provider.mode).toBe('real');
  });

  it('should throw on invalid PROVIDER_MODE', () => {
    expect(() => loadConfig({ ...validEnv, PROVIDER_MODE: 'invalid' })).toThrow();
  });

  describe('polling config', () => {
    it('should apply polling defaults', () => {
      const config = loadConfig(validEnv);
      expect(config.polling.intervalMs).toBe(30_000);
      expect(config.polling.batchSize).toBe(100);
      expect(config.polling.circuitBreakerThreshold).toBe(5);
      expect(config.polling.circuitBreakerCooldownMs).toBe(60_000);
    });

    it('should accept custom ORDER_POLL_INTERVAL_MS', () => {
      const config = loadConfig({ ...validEnv, ORDER_POLL_INTERVAL_MS: '15000' });
      expect(config.polling.intervalMs).toBe(15_000);
    });

    it('should accept custom ORDER_POLL_BATCH_SIZE', () => {
      const config = loadConfig({ ...validEnv, ORDER_POLL_BATCH_SIZE: '50' });
      expect(config.polling.batchSize).toBe(50);
    });

    it('should accept custom CIRCUIT_BREAKER_THRESHOLD', () => {
      const config = loadConfig({ ...validEnv, CIRCUIT_BREAKER_THRESHOLD: '10' });
      expect(config.polling.circuitBreakerThreshold).toBe(10);
    });

    it('should accept custom CIRCUIT_BREAKER_COOLDOWN_MS', () => {
      const config = loadConfig({ ...validEnv, CIRCUIT_BREAKER_COOLDOWN_MS: '120000' });
      expect(config.polling.circuitBreakerCooldownMs).toBe(120_000);
    });

    it('should include polling in frozen config', () => {
      const config = loadConfig(validEnv);
      expect(config.polling).toBeDefined();
      expect(Object.isFrozen(config)).toBe(true);
    });
  });

  describe('apiKeys config', () => {
    it('should apply apiKeys defaults', () => {
      const config = loadConfig(validEnv);
      expect(config.apiKeys.rateBasic).toBe(100);
      expect(config.apiKeys.ratePro).toBe(500);
      expect(config.apiKeys.rateEnterprise).toBe(2000);
    });

    it('should accept custom API_KEY_RATE_BASIC', () => {
      const config = loadConfig({ ...validEnv, API_KEY_RATE_BASIC: '200' });
      expect(config.apiKeys.rateBasic).toBe(200);
    });

    it('should accept custom API_KEY_RATE_PRO', () => {
      const config = loadConfig({ ...validEnv, API_KEY_RATE_PRO: '1000' });
      expect(config.apiKeys.ratePro).toBe(1000);
    });

    it('should accept custom API_KEY_RATE_ENTERPRISE', () => {
      const config = loadConfig({ ...validEnv, API_KEY_RATE_ENTERPRISE: '5000' });
      expect(config.apiKeys.rateEnterprise).toBe(5000);
    });

    it('should include apiKeys in frozen config', () => {
      const config = loadConfig(validEnv);
      expect(config.apiKeys).toBeDefined();
      expect(Object.isFrozen(config)).toBe(true);
    });

    it('should coerce string rate limits to numbers', () => {
      const config = loadConfig({
        ...validEnv,
        API_KEY_RATE_BASIC: '50',
        API_KEY_RATE_PRO: '250',
        API_KEY_RATE_ENTERPRISE: '1500',
      });
      expect(typeof config.apiKeys.rateBasic).toBe('number');
      expect(typeof config.apiKeys.ratePro).toBe('number');
      expect(typeof config.apiKeys.rateEnterprise).toBe('number');
    });
  });

  describe('getConfig / resetConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      resetConfig();
      process.env = { ...originalEnv, ...validEnv };
    });

    afterEach(() => {
      resetConfig();
      process.env = originalEnv;
    });

    it('should return config from process.env via getConfig', () => {
      const config = getConfig();
      expect(config.db.url).toBe(validEnv.DATABASE_URL);
    });

    it('should return the same config on subsequent calls (cached)', () => {
      const config1 = getConfig();
      const config2 = getConfig();
      expect(config1).toBe(config2);
    });

    it('should return fresh config after resetConfig', () => {
      const config1 = getConfig();
      resetConfig();
      const config2 = getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});
