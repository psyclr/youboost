import { z } from 'zod/v4';

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  permissions: z.array(z.string()).optional(),
  rateLimitTier: z.enum(['BASIC', 'PRO', 'ENTERPRISE']).default('BASIC'),
  expiresAt: z.coerce.date().optional(),
});

export const apiKeyIdSchema = z.object({
  keyId: z.uuid(),
});

export const apiKeysQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type ApiKeyIdParam = z.infer<typeof apiKeyIdSchema>;
export type ApiKeysQuery = z.infer<typeof apiKeysQuerySchema>;

export interface ApiKeyRecord {
  id: string;
  userId: string;
  keyHash: string;
  name: string;
  permissions: unknown;
  rateLimitTier: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  rateLimitTier: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface PaginatedApiKeys {
  apiKeys: ApiKeyResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
