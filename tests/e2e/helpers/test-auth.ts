import type { FastifyInstance } from 'fastify';

interface RegisterData {
  email: string;
  password: string;
  username: string;
}

interface InjectResult {
  statusCode: number;
  body: Record<string, unknown>;
}

export function authHeaders(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

export async function registerUser(
  app: FastifyInstance,
  data: RegisterData,
): Promise<InjectResult> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: data,
  });
  return { statusCode: res.statusCode, body: JSON.parse(res.body) };
}

export async function loginUser(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<InjectResult> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  });
  return { statusCode: res.statusCode, body: JSON.parse(res.body) };
}

export async function registerAndLogin(
  app: FastifyInstance,
  overrides?: Partial<RegisterData>,
): Promise<{
  userId: string;
  email: string;
  username: string;
  accessToken: string;
  refreshToken: string;
}> {
  const ts = Date.now();
  const data: RegisterData = {
    email: overrides?.email ?? `user-${ts}@example.com`,
    password: overrides?.password ?? 'TestPass123',
    username: overrides?.username ?? `user_${ts}`,
  };

  const reg = await registerUser(app, data);
  const login = await loginUser(app, data.email, data.password);

  return {
    userId: (reg.body as { userId: string }).userId,
    email: data.email,
    username: data.username,
    accessToken: (login.body as { accessToken: string }).accessToken,
    refreshToken: (login.body as { refreshToken: string }).refreshToken,
  };
}
