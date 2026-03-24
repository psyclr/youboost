import { z } from 'zod/v4';

export const catalogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  platform: z.enum(['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'FACEBOOK']).optional(),
  type: z.enum(['VIEWS', 'SUBSCRIBERS', 'LIKES', 'COMMENTS', 'SHARES']).optional(),
});

export const catalogServiceIdSchema = z.object({
  serviceId: z.uuid(),
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
export type CatalogServiceIdParam = z.infer<typeof catalogServiceIdSchema>;

export interface CatalogServiceResponse {
  id: string;
  name: string;
  description: string | null;
  platform: string;
  type: string;
  pricePer1000: number;
  minQuantity: number;
  maxQuantity: number;
  refillDays: number | null;
}

export interface PaginatedCatalog {
  services: CatalogServiceResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
