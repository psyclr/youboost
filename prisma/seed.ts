import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] ?? '' });
const prisma = new PrismaClient({ adapter });

async function seed(): Promise<void> {
  console.log('Seeding database...');

  // Create admin user (password: admin123 - bcrypt hash placeholder)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@youboost.dev' },
    update: {},
    create: {
      email: 'admin@youboost.dev',
      username: 'admin',
      passwordHash: '$2b$10$IljWvd0vjhdHWvEfPTA58evZu8SwUfHrPTKLWXbXOyp/1CH/sl5zK', // admin123
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  console.log(`Admin user: ${admin.email} (${admin.id})`);

  // Create sample provider (before services so we can link them)
  const PROVIDER_ID = 'a0000000-0000-4000-8000-000000000001';
  const provider = await prisma.provider.upsert({
    where: { id: PROVIDER_ID },
    update: {},
    create: {
      id: PROVIDER_ID,
      name: 'SMMPanel Provider',
      apiEndpoint: 'https://api.example-provider.com/v2',
      apiKeyEncrypted: 'encrypted_placeholder_key',
      isActive: true,
      priority: 1,
    },
  });

  console.log(`Provider: ${provider.name} (${provider.id})`);

  // Create sample services linked to provider
  const services = [
    {
      name: 'YouTube Views',
      description: 'High-quality YouTube video views',
      platform: 'YOUTUBE' as const,
      type: 'VIEWS' as const,
      pricePer1000: 1.5,
      minQuantity: 100,
      maxQuantity: 1000000,
      providerId: PROVIDER_ID,
      externalServiceId: '1',
    },
    {
      name: 'YouTube Subscribers',
      description: 'Real YouTube channel subscribers',
      platform: 'YOUTUBE' as const,
      type: 'SUBSCRIBERS' as const,
      pricePer1000: 15.0,
      minQuantity: 50,
      maxQuantity: 100000,
      providerId: PROVIDER_ID,
      externalServiceId: '2',
    },
    {
      name: 'YouTube Likes',
      description: 'YouTube video likes',
      platform: 'YOUTUBE' as const,
      type: 'LIKES' as const,
      pricePer1000: 3.0,
      minQuantity: 50,
      maxQuantity: 500000,
      providerId: PROVIDER_ID,
      externalServiceId: '3',
    },
  ];

  for (const svc of services) {
    const existing = await prisma.service.findFirst({
      where: { name: svc.name, platform: svc.platform },
    });

    if (!existing) {
      const created = await prisma.service.create({ data: svc });
      console.log(`Service created: ${created.name} (${created.id})`);
    } else {
      console.log(`Service exists: ${existing.name}`);
    }
  }
  console.log('Seeding complete!');
}

seed()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
