import type { FastifyInstance } from 'fastify';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { truncateAllTables, flushTestRedis, seedService } from './helpers/test-db';

let app: FastifyInstance;

let youtubeServiceId: string;
let instagramServiceId: string;
let tiktokServiceId: string;

beforeAll(async () => {
  app = await createTestApp();
  await truncateAllTables();
  await flushTestRedis();

  const youtube = await seedService({
    name: 'YouTube Views',
    platform: 'YOUTUBE',
    type: 'VIEWS',
    pricePer1000: 2.5,
  });
  youtubeServiceId = youtube.id;

  const instagram = await seedService({
    name: 'Instagram Likes',
    platform: 'INSTAGRAM',
    type: 'LIKES',
    pricePer1000: 3.0,
  });
  instagramServiceId = instagram.id;

  const tiktok = await seedService({
    name: 'TikTok Views',
    platform: 'TIKTOK',
    type: 'VIEWS',
    pricePer1000: 1.5,
  });
  tiktokServiceId = tiktok.id;
});

afterAll(async () => {
  await closeTestApp(app);
});

describe('Catalog E2E', () => {
  it('GET /catalog/services should return all 3 services', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/catalog/services',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('services');
    expect(body).toHaveProperty('pagination');
    expect(body.pagination).toHaveProperty('page');
    expect(body.pagination).toHaveProperty('limit');
    expect(body.pagination).toHaveProperty('total');
    expect(body.pagination).toHaveProperty('totalPages');
    expect(body.services).toHaveLength(3);

    const serviceIds = body.services.map((s: { id: string }) => s.id);
    expect(serviceIds).toContain(youtubeServiceId);
    expect(serviceIds).toContain(instagramServiceId);
    expect(serviceIds).toContain(tiktokServiceId);
  });

  it('GET /catalog/services?platform=YOUTUBE should return 1 result', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/catalog/services?platform=YOUTUBE',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.services).toHaveLength(1);
    expect(body.services[0].platform).toBe('YOUTUBE');
    expect(body.services[0].id).toBe(youtubeServiceId);
  });

  it('GET /catalog/services?type=VIEWS should return 2 results', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/catalog/services?type=VIEWS',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.services).toHaveLength(2);

    const serviceIds = body.services.map((s: { id: string }) => s.id);
    expect(serviceIds).toContain(youtubeServiceId);
    expect(serviceIds).toContain(tiktokServiceId);

    for (const service of body.services) {
      expect(service.type).toBe('VIEWS');
    }
  });

  it('GET /catalog/services/:serviceId should return service detail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/catalog/services/${youtubeServiceId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('id', youtubeServiceId);
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('description');
    expect(body).toHaveProperty('platform', 'YOUTUBE');
    expect(body).toHaveProperty('type', 'VIEWS');
    expect(body).toHaveProperty('pricePer1000', 2.5);
    expect(body).toHaveProperty('minQuantity');
    expect(body).toHaveProperty('maxQuantity');
  });

  it('GET /catalog/services/:randomUuid should return 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/catalog/services/00000000-0000-0000-0000-000000000000',
    });

    expect(res.statusCode).toBe(404);
  });
});
