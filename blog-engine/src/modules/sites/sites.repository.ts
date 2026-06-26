import type { PrismaClient, BlogSite } from '../../generated/prisma';
import type { CreateSiteInput, UpdateSiteInput } from './sites.types';
import { randomBytes } from 'crypto';

export interface SitesRepository {
  findById(id: string): Promise<BlogSite | null>;
  findByApiKey(apiKey: string): Promise<BlogSite | null>;
  findByDomain(domain: string): Promise<BlogSite | null>;
  findBySubdomain(subdomain: string): Promise<BlogSite | null>;
  findByDomainOrSubdomain(host: string): Promise<BlogSite | null>;
  create(input: CreateSiteInput): Promise<BlogSite>;
  update(id: string, input: UpdateSiteInput): Promise<BlogSite>;
  connectDomain(id: string, domain: string): Promise<BlogSite>;
  verifyDomain(id: string): Promise<BlogSite>;
}

export function createSitesRepository(prisma: PrismaClient): SitesRepository {
  function generateApiKey(): string {
    return `sk_live_${randomBytes(24).toString('hex')}`;
  }

  function generateVerifyToken(): string {
    return `blog-verify=${randomBytes(16).toString('hex')}`;
  }

  return {
    findById: (id) => prisma.blogSite.findUnique({ where: { id } }),

    findByApiKey: (apiKey) => prisma.blogSite.findUnique({ where: { apiKey } }),

    findByDomain: (domain) => prisma.blogSite.findUnique({ where: { domain } }),

    findBySubdomain: (subdomain) => prisma.blogSite.findUnique({ where: { subdomain } }),

    async findByDomainOrSubdomain(host) {
      // Strip port if present
      const cleanHost = host.split(':')[0];
      // Try custom domain first, then subdomain
      const byDomain = await prisma.blogSite.findUnique({ where: { domain: cleanHost } });
      if (byDomain) return byDomain;
      // Extract subdomain: "myshop.blog-engine.io" → "myshop"
      const sub = cleanHost.split('.')[0];
      return prisma.blogSite.findUnique({ where: { subdomain: sub } });
    },

    async create(input) {
      return prisma.blogSite.create({
        data: {
          apiKey: generateApiKey(),
          verifyToken: generateVerifyToken(),
          subdomain: input.subdomain,
          ownerEmail: input.ownerEmail,
          businessDescription: input.businessDescription,
          targetAudience: input.targetAudience ?? null,
          tone: input.tone ?? 'PROFESSIONAL',
          postsPerWeek: input.postsPerWeek ?? 3,
          defaultLanguage: input.defaultLanguage ?? 'ru',
          topics: input.topics,
          autoPublish: input.autoPublish ?? false,
        },
      });
    },

    async update(id, input) {
      return prisma.blogSite.update({
        where: { id },
        data: {
          ...(input.businessDescription !== undefined && {
            businessDescription: input.businessDescription,
          }),
          ...(input.targetAudience !== undefined && { targetAudience: input.targetAudience }),
          ...(input.tone !== undefined && { tone: input.tone }),
          ...(input.postsPerWeek !== undefined && { postsPerWeek: input.postsPerWeek }),
          ...(input.defaultLanguage !== undefined && { defaultLanguage: input.defaultLanguage }),
          ...(input.topics !== undefined && { topics: input.topics }),
          ...(input.autoPublish !== undefined && { autoPublish: input.autoPublish }),
        },
      });
    },

    async connectDomain(id, domain) {
      return prisma.blogSite.update({
        where: { id },
        data: { domain, domainVerified: false },
      });
    },

    async verifyDomain(id) {
      return prisma.blogSite.update({
        where: { id },
        data: { domainVerified: true },
      });
    },
  };
}
