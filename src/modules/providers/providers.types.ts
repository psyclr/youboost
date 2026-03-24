import { z } from 'zod/v4';

export const createProviderSchema = z.object({
  name: z.string().min(1).max(255),
  apiEndpoint: z.url(),
  apiKey: z.string().min(1),
  priority: z.number().int().default(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateProviderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  apiEndpoint: z.url().optional(),
  apiKey: z.string().min(1).optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const providerIdSchema = z.object({
  providerId: z.uuid(),
});

export const providersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z.coerce.boolean().optional(),
});

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
export type ProviderIdParam = z.infer<typeof providerIdSchema>;
export type ProvidersQuery = z.infer<typeof providersQuerySchema>;

export interface ProviderResponse {
  providerId: string;
  name: string;
  apiEndpoint: string;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderDetailed extends ProviderResponse {
  balance: number | null;
  metadata: unknown;
}

export interface PaginatedProviders {
  providers: ProviderResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProviderRecord {
  id: string;
  name: string;
  apiEndpoint: string;
  apiKeyEncrypted: string;
  isActive: boolean;
  priority: number;
  balance: { toNumber(): number } | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}
