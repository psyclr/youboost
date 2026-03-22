import type { OpenAPIV3 } from 'openapi-types';

const auth: OpenAPIV3.SecurityRequirementObject[] = [{ bearerAuth: [] }];

export const providersPaths: OpenAPIV3.PathsObject = {
  '/providers': {
    post: {
      tags: ['Providers (Admin)'],
      summary: 'Create a provider',
      security: auth,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'apiEndpoint', 'apiKey'],
              properties: {
                name: { type: 'string', minLength: 1, maxLength: 255 },
                apiEndpoint: { type: 'string', format: 'uri' },
                apiKey: { type: 'string' },
                priority: { type: 'integer', default: 0 },
                metadata: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Provider created',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ProviderDetailed' } },
          },
        },
        '403': { description: 'Admin access required' },
      },
    },
    get: {
      tags: ['Providers (Admin)'],
      summary: 'List providers',
      security: auth,
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
      ],
      responses: {
        '200': {
          description: 'Paginated providers',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PaginatedProviders' } },
          },
        },
      },
    },
  },
  '/providers/{providerId}': {
    get: {
      tags: ['Providers (Admin)'],
      summary: 'Get provider detail',
      security: auth,
      parameters: [
        {
          name: 'providerId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '200': {
          description: 'Provider detail',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ProviderDetailed' } },
          },
        },
        '404': { description: 'Provider not found' },
      },
    },
    put: {
      tags: ['Providers (Admin)'],
      summary: 'Update a provider',
      security: auth,
      parameters: [
        {
          name: 'providerId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                apiEndpoint: { type: 'string', format: 'uri' },
                apiKey: { type: 'string' },
                priority: { type: 'integer' },
                isActive: { type: 'boolean' },
                metadata: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Provider updated',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ProviderDetailed' } },
          },
        },
        '404': { description: 'Provider not found' },
      },
    },
    delete: {
      tags: ['Providers (Admin)'],
      summary: 'Deactivate a provider',
      security: auth,
      parameters: [
        {
          name: 'providerId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '204': { description: 'Provider deactivated' },
        '404': { description: 'Provider not found' },
      },
    },
  },
  '/providers/{providerId}/services': {
    get: {
      tags: ['Providers (Admin)'],
      summary: 'Fetch services from provider API',
      security: auth,
      parameters: [
        {
          name: 'providerId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '200': {
          description: 'Provider services list',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  services: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/ProviderServiceInfo' },
                  },
                },
              },
            },
          },
        },
        '404': { description: 'Provider not found' },
      },
    },
  },
  '/providers/{providerId}/balance': {
    get: {
      tags: ['Providers (Admin)'],
      summary: 'Check provider balance',
      security: auth,
      parameters: [
        {
          name: 'providerId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '200': {
          description: 'Provider balance',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ProviderBalance' } },
          },
        },
        '404': { description: 'Provider not found' },
      },
    },
  },
};
