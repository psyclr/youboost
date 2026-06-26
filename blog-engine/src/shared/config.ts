import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export interface BlogEngineConfig {
  port: number;
  host: string;
  databaseUrl: string;
  redisUrl: string;
  anthropicApiKey: string;
  openaiApiKey: string | null;
  unsplashAccessKey: string | null;
  youboostRevalidateUrl: string | null;
  youboostRevalidateSecret: string | null;
  skipDomainVerify: boolean;
}

export function loadConfig(): BlogEngineConfig {
  return {
    port: Number(optional('PORT', '3200')),
    host: optional('HOST', '0.0.0.0'),
    databaseUrl: required('DATABASE_URL'),
    redisUrl: optional('REDIS_URL', 'redis://localhost:6380'),
    anthropicApiKey: required('ANTHROPIC_API_KEY'),
    openaiApiKey: process.env.OPENAI_API_KEY ?? null,
    unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY ?? null,
    youboostRevalidateUrl: process.env.YOUBOOST_REVALIDATE_URL ?? null,
    youboostRevalidateSecret: process.env.YOUBOOST_REVALIDATE_SECRET ?? null,
    skipDomainVerify: process.env.SKIP_DOMAIN_VERIFY === 'true',
  };
}
