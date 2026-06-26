import { z } from 'zod';

export const CreateSiteSchema = z.object({
  ownerEmail: z.string().email(),
  subdomain: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, hyphens'),
  businessDescription: z.string().min(20).max(1000),
  targetAudience: z.string().max(255).optional(),
  tone: z.enum(['PROFESSIONAL', 'CASUAL', 'EXPERT']).default('PROFESSIONAL'),
  postsPerWeek: z.number().int().min(1).max(7).default(3),
  defaultLanguage: z.enum(['ru', 'en']).default('ru'),
  topics: z.array(z.string().max(100)).min(1).max(20),
  autoPublish: z.boolean().default(false),
});

export const UpdateSiteSchema = CreateSiteSchema.partial().omit({ ownerEmail: true, subdomain: true });

export const ConnectDomainSchema = z.object({
  domain: z
    .string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Invalid domain format'),
});

export type CreateSiteInput = z.infer<typeof CreateSiteSchema>;
export type UpdateSiteInput = z.infer<typeof UpdateSiteSchema>;
export type ConnectDomainInput = z.infer<typeof ConnectDomainSchema>;

export interface SiteResponse {
  id: string;
  apiKey: string;
  subdomain: string;
  domain: string | null;
  domainVerified: boolean;
  verifyToken: string;
  ownerEmail: string;
  businessDescription: string;
  targetAudience: string | null;
  tone: string;
  postsPerWeek: number;
  defaultLanguage: string;
  topics: string[];
  autoPublish: boolean;
  planTier: string;
  blogUrl: string;
  createdAt: string;
}
