import type { OpenAPIV3 } from 'openapi-types';

export const catalogPaths: OpenAPIV3.PathsObject = {
  '/catalog/services': {
    get: {
      tags: ['Catalog (Public)'],
      summary: 'List available services (no auth required)',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        {
          name: 'platform',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'FACEBOOK'],
          },
        },
        {
          name: 'type',
          in: 'query',
          schema: { type: 'string', enum: ['VIEWS', 'SUBSCRIBERS', 'LIKES', 'COMMENTS', 'SHARES'] },
        },
      ],
      responses: {
        '200': {
          description: 'Paginated catalog services',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  services: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/CatalogService' },
                  },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                },
              },
            },
          },
        },
      },
    },
  },
  '/catalog/services/{serviceId}': {
    get: {
      tags: ['Catalog (Public)'],
      summary: 'Get service detail (no auth required)',
      parameters: [
        {
          name: 'serviceId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '200': {
          description: 'Service detail',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CatalogService' } },
          },
        },
        '404': { description: 'Service not found' },
      },
    },
  },
};
