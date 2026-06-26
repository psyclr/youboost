import type { Logger } from 'pino';
import { ConflictError, NotFoundError } from '../../shared/errors';
import type { SitesRepository, UpdateSiteData } from './sites.repository';
import type {
  CreateSiteInput,
  UpdateSiteInput,
  ConnectDomainInput,
  SiteResponse,
} from './sites.types';
import type { BlogSite } from '../../generated/prisma';

function presentSite(site: BlogSite, baseUrl: string): SiteResponse {
  return {
    id: site.id,
    apiKey: site.apiKey,
    subdomain: site.subdomain,
    domain: site.domain,
    domainVerified: site.domainVerified,
    verifyToken: site.verifyToken,
    ownerEmail: site.ownerEmail,
    businessDescription: site.businessDescription,
    targetAudience: site.targetAudience,
    tone: site.tone,
    postsPerWeek: site.postsPerWeek,
    defaultLanguage: site.defaultLanguage,
    topics: site.topics,
    autoPublish: site.autoPublish,
    planTier: site.planTier,
    blogUrl: site.domain && site.domainVerified
      ? `https://${site.domain}`
      : `https://${site.subdomain}.${baseUrl}`,
    createdAt: site.createdAt.toISOString(),
  };
}

export interface SitesServiceDeps {
  sitesRepo: SitesRepository;
  logger: Logger;
  blogBaseUrl: string;
  skipDomainVerify: boolean;
}

export interface LlmSettingsInput {
  provider: 'ANTHROPIC' | 'OPENAI';
  credential?: string | null;
  model?: string | null;
}

export interface LlmSettingsResponse {
  provider: string;
  model: string | null;
  hasCredential: boolean;
}

export interface SitesService {
  create(input: CreateSiteInput): Promise<SiteResponse>;
  getById(id: string): Promise<SiteResponse>;
  getByApiKey(apiKey: string): Promise<SiteResponse>;
  getByDomainOrSubdomain(host: string): Promise<SiteResponse>;
  update(id: string, input: UpdateSiteInput): Promise<SiteResponse>;
  connectDomain(id: string, input: ConnectDomainInput): Promise<SiteResponse>;
  checkDomainStatus(id: string): Promise<{ verified: boolean; instructions: string }>;
  getLlmSettings(id: string): Promise<LlmSettingsResponse>;
  updateLlmSettings(id: string, input: LlmSettingsInput): Promise<LlmSettingsResponse>;
}

export function createSitesService(deps: SitesServiceDeps): SitesService {
  const { sitesRepo, logger, blogBaseUrl, skipDomainVerify } = deps;

  return {
    async create(input) {
      const existing = await sitesRepo.findBySubdomain(input.subdomain);
      if (existing) throw new ConflictError(`Subdomain '${input.subdomain}' is already taken`);

      const site = await sitesRepo.create(input);
      logger.info({ siteId: site.id, subdomain: site.subdomain }, 'BlogSite created');
      return presentSite(site, blogBaseUrl);
    },

    async getById(id) {
      const site = await sitesRepo.findById(id);
      if (!site) throw new NotFoundError(`Site not found: ${id}`);
      return presentSite(site, blogBaseUrl);
    },

    async getByApiKey(apiKey) {
      const site = await sitesRepo.findByApiKey(apiKey);
      if (!site) throw new NotFoundError('Invalid API key');
      return presentSite(site, blogBaseUrl);
    },

    async getByDomainOrSubdomain(host) {
      const site = await sitesRepo.findByDomainOrSubdomain(host);
      if (!site) throw new NotFoundError(`No site found for host: ${host}`);
      return presentSite(site, blogBaseUrl);
    },

    async update(id, input) {
      const existing = await sitesRepo.findById(id);
      if (!existing) throw new NotFoundError(`Site not found: ${id}`);
      const updated = await sitesRepo.update(id, input);
      return presentSite(updated, blogBaseUrl);
    },

    async connectDomain(id, input) {
      const site = await sitesRepo.findById(id);
      if (!site) throw new NotFoundError(`Site not found: ${id}`);

      const domainConflict = await sitesRepo.findByDomain(input.domain);
      if (domainConflict && domainConflict.id !== id) {
        throw new ConflictError(`Domain '${input.domain}' is already connected to another site`);
      }

      const updated = await sitesRepo.connectDomain(id, input.domain);
      return presentSite(updated, blogBaseUrl);
    },

    async getLlmSettings(id) {
      const site = await sitesRepo.findById(id);
      if (!site) throw new NotFoundError(`Site not found: ${id}`);
      return {
        provider: site.llmProvider,
        model: site.llmModel,
        hasCredential: !!site.llmCredential,
      };
    },

    async updateLlmSettings(id, input) {
      const site = await sitesRepo.findById(id);
      if (!site) throw new NotFoundError(`Site not found: ${id}`);
      const updated = await sitesRepo.update(id, {
        llmProvider: input.provider,
        llmCredential: input.credential ?? undefined,
        llmModel: input.model ?? undefined,
      });
      logger.info({ siteId: id, provider: input.provider }, 'LLM settings updated');
      return {
        provider: updated.llmProvider,
        model: updated.llmModel,
        hasCredential: !!updated.llmCredential,
      };
    },

    async checkDomainStatus(id) {
      const site = await sitesRepo.findById(id);
      if (!site) throw new NotFoundError(`Site not found: ${id}`);
      if (!site.domain) return { verified: false, instructions: 'No domain connected yet' };

      if (skipDomainVerify) {
        if (!site.domainVerified) await sitesRepo.verifyDomain(id);
        return { verified: true, instructions: 'Domain verification skipped (dev mode)' };
      }

      const dns = await import('dns/promises');
      try {
        const records = await dns.resolveTxt(`_blog-verify.${site.domain}`);
        const flat = records.flat().join('');
        const isVerified = flat.includes(site.verifyToken);
        if (isVerified && !site.domainVerified) {
          await sitesRepo.verifyDomain(id);
          logger.info({ siteId: id, domain: site.domain }, 'Domain verified');
        }
        return {
          verified: isVerified,
          instructions: isVerified
            ? 'Domain verified!'
            : `Add TXT record: _blog-verify.${site.domain} → "${site.verifyToken}"`,
        };
      } catch {
        return {
          verified: false,
          instructions: `Add TXT record: _blog-verify.${site.domain} → "${site.verifyToken}"`,
        };
      }
    },
  };
}
