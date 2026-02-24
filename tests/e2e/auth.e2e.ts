import type { FastifyInstance } from 'fastify';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { truncateAllTables, flushTestRedis } from './helpers/test-db';
import { registerUser, loginUser, authHeaders } from './helpers/test-auth';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
  await truncateAllTables();
  await flushTestRedis();
});

afterAll(async () => {
  await closeTestApp(app);
});

describe('Auth E2E', () => {
  const testUser = {
    email: 'auth-test@example.com',
    password: 'TestPass123',
    username: 'auth_test_user',
  };

  let accessToken: string;
  let refreshToken: string;

  it('should register a new user', async () => {
    const { statusCode, body } = await registerUser(app, testUser);

    expect(statusCode).toBe(201);
    expect(body).toHaveProperty('userId');
    expect(body).toHaveProperty('email', testUser.email);
    expect(body).toHaveProperty('username', testUser.username);
  });

  it('should login with valid credentials', async () => {
    const { statusCode, body } = await loginUser(app, testUser.email, testUser.password);

    expect(statusCode).toBe(200);
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body).toHaveProperty('tokenType', 'Bearer');

    accessToken = body.accessToken as string;
    refreshToken = body.refreshToken as string;
  });

  it('should get profile with valid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('email', testUser.email);
    expect(body).toHaveProperty('username', testUser.username);
    expect(body).toHaveProperty('role', 'USER');
  });

  it('should refresh the access token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('accessToken');
    expect(body.accessToken).not.toBe(accessToken);

    accessToken = body.accessToken as string;
  });

  it('should logout successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(204);
  });

  it('should reject old token after logout', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(401);
  });

  it('should reject duplicate email registration', async () => {
    const { statusCode, body } = await registerUser(app, testUser);

    expect(statusCode).toBe(409);
    expect(body).toHaveProperty('error');
  });

  it('should reject login with wrong password', async () => {
    const { statusCode, body } = await loginUser(app, testUser.email, 'WrongPass999');

    expect(statusCode).toBe(401);
    expect(body).toHaveProperty('error');
  });
});
