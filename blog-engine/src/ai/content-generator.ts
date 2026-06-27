import type { BlogSite } from '../generated/prisma';
import { codexGenerate, type CodexOptions } from './codex-client';

export interface GeneratedPost {
  title: string;
  description: string;
  content: string; // Markdown body (## headings, no H1)
  secondaryKeywords: string[];
}

const POST_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    content: { type: 'string' },
    secondaryKeywords: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'description', 'content', 'secondaryKeywords'],
  additionalProperties: false,
};

const TONE_HINT: Record<string, string> = {
  PROFESSIONAL: 'professional and authoritative',
  CASUAL: 'casual and friendly',
  EXPERT: 'deeply expert and technical',
};

function buildPrompt(site: BlogSite, keyword: string): string {
  const tone = TONE_HINT[site.tone] ?? 'professional';
  return [
    `You are an expert SEO copywriter for this business: ${site.businessDescription}`,
    site.targetAudience ? `Target audience: ${site.targetAudience}.` : '',
    `Write a complete, original, genuinely useful SEO blog post in ${site.defaultLanguage}, ${tone} in tone, targeting the primary keyword "${keyword}".`,
    'Requirements:',
    '- title: 50-60 characters, compelling, contains the primary keyword.',
    '- description: a 150-160 character meta description.',
    '- content: 800-1200 words of Markdown. Use ## and ### headings (NO H1/# — the title renders separately). Natural keyword density 1-2%. No fabricated statistics.',
    '- secondaryKeywords: 3-5 related keywords actually used in the body.',
    'Return ONLY the structured object.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Turn a title into a URL slug (lowercase, hyphenated, ascii). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Generate a full blog post for a keyword via the site's LLM (Codex/ChatGPT). */
export async function generatePost(
  site: BlogSite,
  keyword: string,
  opts: CodexOptions = {},
): Promise<GeneratedPost> {
  const model = opts.model ?? site.llmModel ?? undefined;
  const { data } = await codexGenerate<GeneratedPost>(buildPrompt(site, keyword), POST_SCHEMA, {
    ...opts,
    ...(model ? { model } : {}),
  });
  return data;
}
