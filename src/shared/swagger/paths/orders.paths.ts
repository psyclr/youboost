import type { OpenAPIV3 } from 'openapi-types';

const auth: OpenAPIV3.SecurityRequirementObject[] = [{ bearerAuth: [] }];

export const ordersPaths: OpenAPIV3.PathsObject = {
  '/orders': {
    post: {
      tags: ['Orders'],
      summary: 'Create a new order',
      security: auth,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['serviceId', 'link', 'quantity'],
              properties: {
                serviceId: { type: 'string', format: 'uuid' },
                link: { type: 'string', format: 'uri' },
                quantity: { type: 'integer', minimum: 1 },
                comments: { type: 'string', maxLength: 500 },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Order created',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/OrderResponse' } },
          },
        },
        '404': { description: 'Service not found' },
        '422': { description: 'Validation error (quantity out of range, insufficient funds)' },
      },
    },
    get: {
      tags: ['Orders'],
      summary: 'List user orders',
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
          schema: {
            type: 'string',
            enum: [
              'PENDING',
              'PROCESSING',
              'COMPLETED',
              'PARTIAL',
              'CANCELLED',
              'FAILED',
              'REFUNDED',
            ],
          },
        },
        { name: 'serviceId', in: 'query', schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'Paginated orders',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PaginatedOrders' } },
          },
        },
      },
    },
  },
  '/orders/{orderId}': {
    get: {
      tags: ['Orders'],
      summary: 'Get order detail',
      security: auth,
      parameters: [
        { name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'Order detail',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/OrderDetailed' } },
          },
        },
        '404': { description: 'Order not found' },
      },
    },
    delete: {
      tags: ['Orders'],
      summary: 'Cancel an order',
      security: auth,
      parameters: [
        { name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'Order cancelled',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  orderId: { type: 'string' },
                  status: { type: 'string' },
                  refundAmount: { type: 'number' },
                  cancelledAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        '404': { description: 'Order not found' },
        '422': { description: 'Order cannot be cancelled' },
      },
    },
  },
};
