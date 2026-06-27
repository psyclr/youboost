import type { Logger } from 'pino';
import { NotFoundError } from '../../shared/errors';
import { generatePost, slugify } from '../../ai/content-generator';
import type { SitesRepository } from '../sites/sites.repository';
import type { PostsRepository } from '../posts/posts.repository';
import type { PostsService } from '../posts/posts.service';

export interface GenerateServiceDeps {
  sitesRepo: SitesRepository;
  postsRepo: PostsRepository;
  postsService: PostsService;
  logger: Logger;
}

export interface GenerateResult {
  id: string;
  slug: string;
  status: string;
  title: string;
}

export interface GenerateService {
  generateForSite(siteId: string, keyword?: string): Promise<GenerateResult>;
}

export function createGenerateService(deps: GenerateServiceDeps): GenerateService {
  const { sitesRepo, postsRepo, postsService, logger } = deps;

  async function uniqueSlug(siteId: string, base: string): Promise<string> {
    const root = base || 'post';
    if (!(await postsRepo.findBySlug(siteId, root))) return root;
    for (let i = 2; i < 50; i += 1) {
      const candidate = `${root}-${i}`;
      if (!(await postsRepo.findBySlug(siteId, candidate))) return candidate;
    }
    return `${root}-${Date.now()}`;
  }

  function pickKeyword(topics: string[]): string {
    return topics[Math.floor(Math.random() * topics.length)] ?? 'tips';
  }

  return {
    async generateForSite(siteId, keyword) {
      const site = await sitesRepo.findById(siteId);
      if (!site) throw new NotFoundError(`Site not found: ${siteId}`);

      const kw = keyword ?? pickKeyword(site.topics);
      logger.info({ siteId, keyword: kw }, 'Generating post via Codex (ChatGPT subscription)');

      const gen = await generatePost(site, kw);
      const slug = await uniqueSlug(siteId, slugify(gen.title));

      const post = await postsService.adminCreate(siteId, {
        slug,
        title: gen.title,
        description: gen.description,
        content: gen.content,
        targetKeyword: kw,
        secondaryKeywords: gen.secondaryKeywords,
        author: 'AI',
        status: 'DRAFT',
      });

      let status = post.status;
      // autoPublish defaults to false — generated posts wait for human approval.
      if (site.autoPublish) {
        const published = await postsService.adminPublish(post.id);
        status = published.status;
      }

      logger.info({ siteId, postId: post.id, slug, status }, 'Post generated');
      return { id: post.id, slug, status, title: gen.title };
    },
  };
}
