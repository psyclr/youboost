import type { OpenAPIV3 } from 'openapi-types';

const auth: OpenAPIV3.SecurityRequirementObject[] = [{ bearerAuth: [] }];

export const apiKeysPaths: OpenAPIV3.PathsObject = {
  '/api-keys': {
    post: {
      tags: ['API Keys'],
      summary: 'Generate a new API key',
      security: auth,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', minLength: 1, maxLength: 255 },
                permissions: { type: 'array', items: { type: 'string' } },
                rateLimitTier: {
                  type: 'string',
                  enum: ['BASIC', 'PRO', 'ENTERPRISE'],
                  default: 'BASIC',
                },
                expiresAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'API key created (key value only shown once)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  key: { type: 'string', description: 'Full API key - only returned on creation' },
                  rateLimitTier: { type: 'string' },
                  expiresAt: { type: 'string', format: 'date-time', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
    get: {
      tags: ['API Keys'],
      summary: 'List API keys',
      security: auth,
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        { name: 'isActive', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
      ],
      responses: {
        '200': {
          description: 'Paginated API keys',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PaginatedApiKeys' } },
          },
        },
      },
    },
  },
  '/api-keys/{keyId}': {
    delete: {
      tags: ['API Keys'],
      summary: 'Revoke an API key',
      security: auth,
      parameters: [
        { name: 'keyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '204': { description: 'API key revoked' },
        '404': { description: 'API key not found' },
      },
    },
  },
};
