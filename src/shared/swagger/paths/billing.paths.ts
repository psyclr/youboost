import type { OpenAPIV3 } from 'openapi-types';

const auth: OpenAPIV3.SecurityRequirementObject[] = [{ bearerAuth: [] }];
const paginationParams: OpenAPIV3.ParameterObject[] = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  {
    name: 'limit',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
];

export const billingPaths: OpenAPIV3.PathsObject = {
  '/billing/balance': {
    get: {
      tags: ['Billing'],
      summary: 'Get wallet balance',
      security: auth,
      responses: {
        '200': {
          description: 'Wallet balance',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string', format: 'uuid' },
                  balance: { type: 'number' },
                  frozen: { type: 'number' },
                  available: { type: 'number' },
                  currency: { type: 'string' },
                },
              },
            },
          },
        },
        '401': { description: 'Unauthorized' },
      },
    },
  },
  '/billing/deposit': {
    post: {
      tags: ['Billing'],
      summary: 'Create deposit (legacy)',
      security: auth,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency', 'paymentMethod', 'cryptoCurrency'],
              properties: {
                amount: { type: 'number', minimum: 10 },
                currency: { type: 'string', enum: ['USD'] },
                paymentMethod: { type: 'string', enum: ['crypto'] },
                cryptoCurrency: { type: 'string', enum: ['USDT', 'BTC', 'ETH'] },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Deposit created',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/DepositResponse' } },
          },
        },
        '401': { description: 'Unauthorized' },
      },
    },
  },
  '/billing/transactions': {
    get: {
      tags: ['Billing'],
      summary: 'List transactions',
      security: auth,
      parameters: [
        ...paginationParams,
        {
          name: 'type',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['DEPOSIT', 'WITHDRAW', 'HOLD', 'RELEASE', 'REFUND', 'FEE', 'ADMIN_ADJUSTMENT'],
          },
        },
      ],
      responses: {
        '200': {
          description: 'Paginated transactions',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PaginatedTransactions' } },
          },
        },
      },
    },
  },
  '/billing/transactions/{transactionId}': {
    get: {
      tags: ['Billing'],
      summary: 'Get transaction detail',
      security: auth,
      parameters: [
        {
          name: 'transactionId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '200': {
          description: 'Transaction detail',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/TransactionDetailed' } },
          },
        },
        '404': { description: 'Transaction not found' },
      },
    },
  },
  '/billing/deposits': {
    get: {
      tags: ['Billing'],
      summary: 'List deposits',
      security: auth,
      parameters: [
        ...paginationParams,
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'EXPIRED', 'FAILED'] },
        },
      ],
      responses: {
        '200': {
          description: 'Paginated deposits',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PaginatedDeposits' } },
          },
        },
      },
    },
  },
  '/billing/deposits/{depositId}': {
    get: {
      tags: ['Billing'],
      summary: 'Get deposit detail',
      security: auth,
      parameters: [
        {
          name: 'depositId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '200': {
          description: 'Deposit detail',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/DepositDetail' } },
          },
        },
        '404': { description: 'Deposit not found' },
      },
    },
  },
  '/billing/deposits/{depositId}/confirm': {
    post: {
      tags: ['Billing'],
      summary: 'Confirm deposit with transaction hash',
      security: auth,
      parameters: [
        {
          name: 'depositId',
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
              required: ['txHash'],
              properties: { txHash: { type: 'string' } },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Deposit confirmed',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/DepositDetail' } },
          },
        },
        '404': { description: 'Deposit not found' },
        '422': { description: 'Deposit cannot be confirmed' },
      },
    },
  },
};
