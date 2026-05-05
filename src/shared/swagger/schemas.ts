import type { OpenAPIV3 } from 'openapi-types';
import { adminSchemas } from './admin-schemas';

const baseSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  Pagination: {
    type: 'object',
    properties: {
      page: { type: 'integer' },
      limit: { type: 'integer' },
      total: { type: 'integer' },
      totalPages: { type: 'integer' },
    },
  },
  TokenPair: {
    type: 'object',
    properties: {
      accessToken: { type: 'string' },
      refreshToken: { type: 'string' },
      expiresIn: { type: 'integer' },
      tokenType: { type: 'string', example: 'Bearer' },
    },
  },
  UserProfile: {
    type: 'object',
    properties: {
      userId: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email' },
      username: { type: 'string' },
      role: { type: 'string', enum: ['USER', 'RESELLER', 'ADMIN'] },
      emailVerified: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  DepositDetail: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      amount: { type: 'number' },
      cryptoAmount: { type: 'number' },
      cryptoCurrency: { type: 'string' },
      paymentAddress: { type: 'string' },
      status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'EXPIRED', 'FAILED'] },
      txHash: { type: 'string', nullable: true },
      expiresAt: { type: 'string', format: 'date-time' },
      confirmedAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  PaginatedDeposits: {
    type: 'object',
    properties: {
      deposits: { type: 'array', items: { $ref: '#/components/schemas/DepositDetail' } },
      pagination: { $ref: '#/components/schemas/Pagination' },
    },
  },
  TransactionSummary: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      type: { type: 'string' },
      amount: { type: 'number' },
      description: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  TransactionDetailed: {
    allOf: [
      { $ref: '#/components/schemas/TransactionSummary' },
      {
        type: 'object',
        properties: {
          balanceBefore: { type: 'number' },
          balanceAfter: { type: 'number' },
          referenceType: { type: 'string', nullable: true },
          referenceId: { type: 'string', nullable: true },
        },
      },
    ],
  },
  PaginatedTransactions: {
    type: 'object',
    properties: {
      transactions: { type: 'array', items: { $ref: '#/components/schemas/TransactionSummary' } },
      pagination: { $ref: '#/components/schemas/Pagination' },
    },
  },
  OrderResponse: {
    type: 'object',
    properties: {
      orderId: { type: 'string', format: 'uuid' },
      serviceId: { type: 'string', format: 'uuid' },
      status: { type: 'string' },
      quantity: { type: 'integer' },
      completed: { type: 'integer' },
      price: { type: 'number' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  OrderDetailed: {
    allOf: [
      { $ref: '#/components/schemas/OrderResponse' },
      {
        type: 'object',
        properties: {
          link: { type: 'string' },
          startCount: { type: 'integer', nullable: true },
          remains: { type: 'integer', nullable: true },
          updatedAt: { type: 'string', format: 'date-time' },
          comments: { type: 'string', nullable: true },
        },
      },
    ],
  },
  PaginatedOrders: {
    type: 'object',
    properties: {
      orders: { type: 'array', items: { $ref: '#/components/schemas/OrderResponse' } },
      pagination: { $ref: '#/components/schemas/Pagination' },
    },
  },
  ProviderDetailed: {
    type: 'object',
    properties: {
      providerId: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      apiEndpoint: { type: 'string' },
      isActive: { type: 'boolean' },
      priority: { type: 'integer' },
      balance: { type: 'number', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  PaginatedProviders: {
    type: 'object',
    properties: {
      providers: { type: 'array', items: { $ref: '#/components/schemas/ProviderDetailed' } },
      pagination: { $ref: '#/components/schemas/Pagination' },
    },
  },
  PaginatedApiKeys: {
    type: 'object',
    properties: {
      apiKeys: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            rateLimitTier: { type: 'string' },
            isActive: { type: 'boolean' },
            lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
      },
      pagination: { $ref: '#/components/schemas/Pagination' },
    },
  },
  WebhookResponse: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      url: { type: 'string' },
      events: { type: 'array', items: { type: 'string' } },
      isActive: { type: 'boolean' },
      lastTriggeredAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  PaginatedWebhooks: {
    type: 'object',
    properties: {
      webhooks: { type: 'array', items: { $ref: '#/components/schemas/WebhookResponse' } },
      pagination: { $ref: '#/components/schemas/Pagination' },
    },
  },
  CatalogService: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      description: { type: 'string', nullable: true },
      platform: { type: 'string' },
      type: { type: 'string' },
      pricePer1000: { type: 'number' },
      minQuantity: { type: 'integer' },
      maxQuantity: { type: 'integer' },
    },
  },
  NotificationSummary: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      type: { type: 'string' },
      channel: { type: 'string' },
      subject: { type: 'string', nullable: true },
      status: { type: 'string', enum: ['PENDING', 'SENT', 'FAILED'] },
      eventType: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  ProviderServiceInfo: {
    type: 'object',
    properties: {
      serviceId: { type: 'string' },
      name: { type: 'string' },
      category: { type: 'string' },
      rate: { type: 'number' },
      min: { type: 'integer' },
      max: { type: 'integer' },
      type: { type: 'string' },
      description: { type: 'string' },
    },
  },
  ProviderBalance: {
    type: 'object',
    properties: {
      balance: { type: 'number' },
      currency: { type: 'string' },
    },
  },
};

export const schemas: Record<string, OpenAPIV3.SchemaObject> = {
  ...baseSchemas,
  ...adminSchemas,
};
