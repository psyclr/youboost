import type { OpenAPIV3 } from 'openapi-types';

const auth: OpenAPIV3.SecurityRequirementObject[] = [{ bearerAuth: [] }];

export const notificationsPaths: OpenAPIV3.PathsObject = {
  '/notifications/notifications': {
    get: {
      tags: ['Notifications'],
      summary: 'List user notifications',
      security: auth,
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ['PENDING', 'SENT', 'FAILED'] },
        },
      ],
      responses: {
        '200': {
          description: 'Paginated notifications',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  notifications: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/NotificationSummary' },
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
  '/notifications/notifications/{notificationId}': {
    get: {
      tags: ['Notifications'],
      summary: 'Get notification detail',
      security: auth,
      parameters: [
        {
          name: 'notificationId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '200': {
          description: 'Notification detail',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/NotificationSummary' } },
          },
        },
        '404': { description: 'Notification not found' },
      },
    },
  },
};
