import type { OpenAPIV3 } from 'openapi-types';
import { adminOrdersServicesPaths } from './admin-orders-services.paths';

const auth: OpenAPIV3.SecurityRequirementObject[] = [{ bearerAuth: [] }];

const adminUsersPaths: OpenAPIV3.PathsObject = {
  '/admin/users': {
    get: {
      tags: ['Admin'],
      summary: 'List all users',
      security: auth,
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        {
          name: 'role',
          in: 'query',
          schema: { type: 'string', enum: ['USER', 'RESELLER', 'ADMIN'] },
        },
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'BANNED'] },
        },
      ],
      responses: {
        '200': {
          description: 'Paginated users',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  users: { type: 'array', items: { $ref: '#/components/schemas/AdminUser' } },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                },
              },
            },
          },
        },
        '403': { description: 'Admin access required' },
      },
    },
  },
  '/admin/users/{userId}': {
    get: {
      tags: ['Admin'],
      summary: 'Get user detail with wallet',
      security: auth,
      parameters: [
        { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'User detail',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AdminUserDetail' } },
          },
        },
        '404': { description: 'User not found' },
      },
    },
    patch: {
      tags: ['Admin'],
      summary: 'Update user role/status',
      security: auth,
      parameters: [
        { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                role: { type: 'string', enum: ['USER', 'RESELLER', 'ADMIN'] },
                status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'BANNED'] },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'User updated',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminUser' } } },
        },
        '404': { description: 'User not found' },
      },
    },
  },
  '/admin/users/{userId}/balance/adjust': {
    post: {
      tags: ['Admin'],
      summary: 'Adjust user balance',
      security: auth,
      parameters: [
        { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'reason'],
              properties: {
                amount: { type: 'number', description: 'Positive to add, negative to subtract' },
                reason: { type: 'string', minLength: 1, maxLength: 500 },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Balance adjusted',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { success: { type: 'boolean' } } },
            },
          },
        },
        '422': { description: 'Insufficient funds for negative adjustment' },
      },
    },
  },
};

export const adminPaths: OpenAPIV3.PathsObject = {
  ...adminUsersPaths,
  ...adminOrdersServicesPaths,
};
