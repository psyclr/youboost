import type { OpenAPIV3 } from 'openapi-types';

const auth: OpenAPIV3.SecurityRequirementObject[] = [{ bearerAuth: [] }];
const statusEnum = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'PARTIAL',
  'CANCELLED',
  'FAILED',
  'REFUNDED',
];
const platformEnum = ['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'FACEBOOK'];
const serviceTypeEnum = ['VIEWS', 'SUBSCRIBERS', 'LIKES', 'COMMENTS', 'SHARES'];

export const adminOrdersServicesPaths: OpenAPIV3.PathsObject = {
  '/admin/orders': {
    get: {
      tags: ['Admin'],
      summary: 'List all orders',
      security: auth,
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        { name: 'status', in: 'query', schema: { type: 'string', enum: statusEnum } },
        { name: 'userId', in: 'query', schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'Paginated orders',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  orders: { type: 'array', items: { $ref: '#/components/schemas/AdminOrder' } },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                },
              },
            },
          },
        },
      },
    },
  },
  '/admin/orders/{orderId}': {
    get: {
      tags: ['Admin'],
      summary: 'Get any order detail',
      security: auth,
      parameters: [
        { name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'Order detail',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminOrder' } } },
        },
        '404': { description: 'Order not found' },
      },
    },
  },
  '/admin/orders/{orderId}/status': {
    patch: {
      tags: ['Admin'],
      summary: 'Force order status change',
      security: auth,
      parameters: [
        { name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['status'],
              properties: { status: { type: 'string', enum: statusEnum } },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Status updated',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminOrder' } } },
        },
        '404': { description: 'Order not found' },
      },
    },
  },
  '/admin/orders/{orderId}/refund': {
    post: {
      tags: ['Admin'],
      summary: 'Refund an order',
      security: auth,
      parameters: [
        { name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'Order refunded',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  orderId: { type: 'string' },
                  status: { type: 'string' },
                  refundAmount: { type: 'number' },
                },
              },
            },
          },
        },
        '404': { description: 'Order not found' },
      },
    },
  },
  '/admin/services': {
    get: {
      tags: ['Admin'],
      summary: 'List all services (active + inactive)',
      security: auth,
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      ],
      responses: {
        '200': {
          description: 'Paginated services',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  services: { type: 'array', items: { $ref: '#/components/schemas/AdminService' } },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ['Admin'],
      summary: 'Create a service',
      security: auth,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: [
                'name',
                'platform',
                'type',
                'pricePer1000',
                'minQuantity',
                'maxQuantity',
                'providerId',
                'externalServiceId',
              ],
              properties: {
                name: { type: 'string', maxLength: 255 },
                description: { type: 'string', maxLength: 1000 },
                platform: { type: 'string', enum: platformEnum },
                type: { type: 'string', enum: serviceTypeEnum },
                pricePer1000: { type: 'number', minimum: 0 },
                minQuantity: { type: 'integer', minimum: 1 },
                maxQuantity: { type: 'integer', minimum: 1 },
                providerId: { type: 'string', format: 'uuid' },
                externalServiceId: { type: 'string', minLength: 1 },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Service created',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AdminService' } },
          },
        },
      },
    },
  },
  '/admin/services/{serviceId}': {
    patch: {
      tags: ['Admin'],
      summary: 'Update a service',
      security: auth,
      parameters: [
        {
          name: 'serviceId',
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
                description: { type: 'string' },
                platform: { type: 'string', enum: platformEnum },
                type: { type: 'string', enum: serviceTypeEnum },
                pricePer1000: { type: 'number' },
                minQuantity: { type: 'integer' },
                maxQuantity: { type: 'integer' },
                isActive: { type: 'boolean' },
                providerId: { type: 'string', format: 'uuid' },
                externalServiceId: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Service updated',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AdminService' } },
          },
        },
        '404': { description: 'Service not found' },
      },
    },
    delete: {
      tags: ['Admin'],
      summary: 'Deactivate a service',
      security: auth,
      parameters: [
        {
          name: 'serviceId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '204': { description: 'Service deactivated' },
        '404': { description: 'Service not found' },
      },
    },
  },
  '/admin/dashboard/stats': {
    get: {
      tags: ['Admin'],
      summary: 'Get platform dashboard stats',
      security: auth,
      responses: {
        '200': {
          description: 'Dashboard stats',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/DashboardStats' } },
          },
        },
      },
    },
  },
};
