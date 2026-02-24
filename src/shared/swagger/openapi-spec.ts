import type { OpenAPIV3 } from 'openapi-types';
import { schemas } from './schemas';
import { authPaths } from './paths/auth.paths';
import { billingPaths } from './paths/billing.paths';
import { ordersPaths } from './paths/orders.paths';
import { providersPaths } from './paths/providers.paths';
import { apiKeysPaths } from './paths/api-keys.paths';
import { webhooksPaths } from './paths/webhooks.paths';
import { catalogPaths } from './paths/catalog.paths';
import { adminPaths } from './paths/admin.paths';
import { notificationsPaths } from './paths/notifications.paths';

export const openapiSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'YouBoost API',
    version: '0.1.0-alpha',
    description: 'YouBoost SMM Panel — social media marketing automation platform.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local dev' }],
  tags: [
    { name: 'Auth', description: 'Registration, login, tokens, email verification' },
    { name: 'Billing', description: 'Wallet balance, deposits, transactions' },
    { name: 'Orders', description: 'Create and manage SMM orders' },
    { name: 'Providers (Admin)', description: 'Manage SMM service providers' },
    { name: 'API Keys', description: 'Generate and manage API keys' },
    { name: 'Webhooks', description: 'Webhook endpoint management' },
    { name: 'Catalog (Public)', description: 'Public service catalog (no auth)' },
    { name: 'Admin', description: 'Admin panel — users, orders, services, dashboard' },
    { name: 'Notifications', description: 'User notification history' },
  ],
  paths: {
    ...authPaths,
    ...billingPaths,
    ...ordersPaths,
    ...providersPaths,
    ...apiKeysPaths,
    ...webhooksPaths,
    ...catalogPaths,
    ...adminPaths,
    ...notificationsPaths,
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Service health status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    uptime: { type: 'number' },
                    database: { type: 'string' },
                    redis: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token from /auth/login or /auth/register',
      },
    },
    schemas,
  },
};
