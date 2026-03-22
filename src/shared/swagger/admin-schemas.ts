import type { OpenAPIV3 } from 'openapi-types';

export const adminSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  AdminUser: {
    type: 'object',
    properties: {
      userId: { type: 'string', format: 'uuid' },
      email: { type: 'string' },
      username: { type: 'string' },
      role: { type: 'string' },
      status: { type: 'string' },
      emailVerified: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  AdminUserDetail: {
    allOf: [
      { $ref: '#/components/schemas/AdminUser' },
      {
        type: 'object',
        properties: {
          wallet: {
            type: 'object',
            nullable: true,
            properties: {
              balance: { type: 'number' },
              frozen: { type: 'number' },
              available: { type: 'number' },
            },
          },
        },
      },
    ],
  },
  AdminOrder: {
    type: 'object',
    properties: {
      orderId: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      serviceId: { type: 'string', format: 'uuid' },
      status: { type: 'string' },
      quantity: { type: 'integer' },
      price: { type: 'number' },
      link: { type: 'string' },
      startCount: { type: 'integer', nullable: true },
      remains: { type: 'integer', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      completedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  AdminService: {
    type: 'object',
    properties: {
      serviceId: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      description: { type: 'string', nullable: true },
      platform: { type: 'string' },
      type: { type: 'string' },
      pricePer1000: { type: 'number' },
      minQuantity: { type: 'integer' },
      maxQuantity: { type: 'integer' },
      isActive: { type: 'boolean' },
      providerId: { type: 'string', format: 'uuid', nullable: true },
      externalServiceId: { type: 'string', nullable: true },
      providerName: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  DashboardStats: {
    type: 'object',
    properties: {
      totalUsers: { type: 'integer' },
      totalOrders: { type: 'integer' },
      totalRevenue: { type: 'number' },
      activeServices: { type: 'integer' },
      recentOrders: { type: 'array', items: { $ref: '#/components/schemas/AdminOrder' } },
    },
  },
};
