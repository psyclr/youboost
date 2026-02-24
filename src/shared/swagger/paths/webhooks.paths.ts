import type { OpenAPIV3 } from 'openapi-types';

const auth: OpenAPIV3.SecurityRequirementObject[] = [{ bearerAuth: [] }];
const events = [
  'order.created',
  'order.completed',
  'order.failed',
  'order.partial',
  'order.cancelled',
];

export const webhooksPaths: OpenAPIV3.PathsObject = {
  '/webhooks': {
    post: {
      tags: ['Webhooks'],
      summary: 'Create a webhook endpoint',
      security: auth,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['url', 'events'],
              properties: {
                url: { type: 'string', format: 'uri' },
                events: { type: 'array', items: { type: 'string', enum: events }, minItems: 1 },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Webhook created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  url: { type: 'string' },
                  events: { type: 'array', items: { type: 'string' } },
                  secret: { type: 'string', description: 'Webhook signing secret' },
                  isActive: { type: 'boolean' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
    get: {
      tags: ['Webhooks'],
      summary: 'List webhooks',
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
          description: 'Paginated webhooks',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PaginatedWebhooks' } },
          },
        },
      },
    },
  },
  '/webhooks/{webhookId}': {
    get: {
      tags: ['Webhooks'],
      summary: 'Get webhook detail',
      security: auth,
      parameters: [
        {
          name: 'webhookId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '200': {
          description: 'Webhook detail',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/WebhookResponse' } },
          },
        },
        '404': { description: 'Webhook not found' },
      },
    },
    put: {
      tags: ['Webhooks'],
      summary: 'Update a webhook',
      security: auth,
      parameters: [
        {
          name: 'webhookId',
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
                url: { type: 'string', format: 'uri' },
                events: { type: 'array', items: { type: 'string', enum: events }, minItems: 1 },
                isActive: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Webhook updated',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/WebhookResponse' } },
          },
        },
        '404': { description: 'Webhook not found' },
      },
    },
    delete: {
      tags: ['Webhooks'],
      summary: 'Delete a webhook',
      security: auth,
      parameters: [
        {
          name: 'webhookId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '204': { description: 'Webhook deleted' },
        '404': { description: 'Webhook not found' },
      },
    },
  },
};
