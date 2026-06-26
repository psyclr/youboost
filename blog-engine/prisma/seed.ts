import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { randomBytes } from 'crypto';

const databaseUrl = process.env.DATABASE_URL;
// The driver adapter ignores the `?schema=` URL param (that's a Prisma-engine
// param), so pass it explicitly or all queries hit `public`.
const schema = databaseUrl
  ? (new URL(databaseUrl).searchParams.get('schema') ?? undefined)
  : undefined;
const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool, schema ? { schema } : undefined);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding blog-engine database...');

  // Idempotent: upsert youboost as first client
  const existing = await prisma.blogSite.findUnique({ where: { subdomain: 'youboost' } });

  if (!existing) {
    const site = await prisma.blogSite.create({
      data: {
        apiKey: `sk_live_youboost_${randomBytes(16).toString('hex')}`,
        subdomain: 'youboost',
        domain: 'youboost.io',
        domainVerified: true,
        verifyToken: `blog-verify=${randomBytes(8).toString('hex')}`,
        ownerEmail: 'admin@youboost.dev',
        businessDescription:
          'YouBoost — SMM-панель для продвижения YouTube-каналов: накрутка просмотров, подписчиков, лайков и комментариев от реальных пользователей.',
        targetAudience: 'Владельцы YouTube-каналов, блогеры, маркетологи',
        tone: 'PROFESSIONAL',
        postsPerWeek: 3,
        defaultLanguage: 'ru',
        topics: [
          'Продвижение YouTube',
          'SEO для YouTube',
          'Накрутка просмотров',
          'Монетизация YouTube',
          'SMM маркетинг',
          'Алгоритмы YouTube',
          'Создание контента',
        ],
        claudeModel: 'claude-sonnet-4-6',
        autoPublish: false,
        planTier: 'PRO',
      },
    });
    console.log(`✓ Created YouBoost site: ${site.id} (apiKey: ${site.apiKey})`);
    console.log(`  → Blog URL: https://youboost.blog-engine.io`);
    console.log(`  → Save this API key to youboost .env: BLOG_ENGINE_API_KEY=${site.apiKey}`);
  } else {
    console.log(`✓ YouBoost site already exists: ${existing.id}`);
    console.log(`  → API key: ${existing.apiKey}`);
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
