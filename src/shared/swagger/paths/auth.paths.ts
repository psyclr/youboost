import type { OpenAPIV3 } from 'openapi-types';

export const authPaths: OpenAPIV3.PathsObject = {
  '/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Register a new user',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password', 'username'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: {
                  type: 'string',
                  minLength: 8,
                  description: 'Must contain uppercase, lowercase, and digit',
                },
                username: {
                  type: 'string',
                  minLength: 3,
                  maxLength: 30,
                  pattern: '^[a-zA-Z0-9_]+$',
                },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'User registered',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenPair' } } },
        },
        '409': { description: 'Email or username already exists' },
        '422': { description: 'Validation error' },
      },
    },
  },
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Login with email and password',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 1 },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Login successful',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenPair' } } },
        },
        '401': { description: 'Invalid credentials' },
      },
    },
  },
  '/auth/refresh': {
    post: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['refreshToken'],
              properties: { refreshToken: { type: 'string' } },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Tokens refreshed',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenPair' } } },
        },
        '401': { description: 'Invalid refresh token' },
      },
    },
  },
  '/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Logout (revoke current token)',
      security: [{ bearerAuth: [] }],
      responses: { '204': { description: 'Logged out' }, '401': { description: 'Unauthorized' } },
    },
  },
  '/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Get current user profile',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'User profile',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserProfile' } } },
        },
        '401': { description: 'Unauthorized' },
      },
    },
  },
  '/auth/verify-email': {
    post: {
      tags: ['Auth'],
      summary: 'Verify email address',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token'],
              properties: { token: { type: 'string' } },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Email verified' },
        '400': { description: 'Invalid or expired token' },
      },
    },
  },
  '/auth/forgot-password': {
    post: {
      tags: ['Auth'],
      summary: 'Request password reset email',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: { email: { type: 'string', format: 'email' } },
            },
          },
        },
      },
      responses: { '200': { description: 'Reset email sent (if account exists)' } },
    },
  },
  '/auth/reset-password': {
    post: {
      tags: ['Auth'],
      summary: 'Reset password with token',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token', 'newPassword'],
              properties: {
                token: { type: 'string' },
                newPassword: { type: 'string', minLength: 8 },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Password reset successful' },
        '400': { description: 'Invalid token' },
      },
    },
  },
};
