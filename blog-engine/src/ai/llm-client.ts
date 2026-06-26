import Anthropic from '@anthropic-ai/sdk';
import type { BlogSite } from '../generated/prisma';
import type { BlogEngineConfig } from '../shared/config';
import { createLogger } from '../shared/logger';

const log = createLogger('llm');

export interface LlmGenerateResult {
  text: string;
  tokensUsed: number;
}

export interface LlmClient {
  generate(system: string, user: string): Promise<LlmGenerateResult>;
}

function decryptCredential(encrypted: string): string {
  // TODO: AES-256-GCM decryption when encryption is added
  // For now credentials are stored as-is (plaintext); encryption added in Iteration 7
  return encrypted;
}

function createAnthropicClient(apiKey: string, model: string): LlmClient {
  const client = new Anthropic({ apiKey });
  return {
    async generate(system, user) {
      const msg = await client.messages.create({
        model,
        max_tokens: 8192,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const tokensUsed = msg.usage.input_tokens + msg.usage.output_tokens;
      log.debug({ model, tokensUsed }, 'Anthropic generate done');
      return { text, tokensUsed };
    },
  };
}

function createOpenAiClient(apiKey: string, model: string): LlmClient {
  // Lazy-require openai so it's only needed when the OPENAI provider is used
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const OpenAI = require('openai').default as typeof import('openai').default;
  const client = new OpenAI({ apiKey });
  return {
    async generate(system, user) {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 8192,
      });
      const text = res.choices[0]?.message?.content ?? '';
      const tokensUsed = (res.usage?.prompt_tokens ?? 0) + (res.usage?.completion_tokens ?? 0);
      log.debug({ model, tokensUsed }, 'OpenAI generate done');
      return { text, tokensUsed };
    },
  };
}

export function createLlmClient(site: BlogSite, config: BlogEngineConfig): LlmClient {
  const credential = site.llmCredential ? decryptCredential(site.llmCredential) : null;

  if (site.llmProvider === 'OPENAI') {
    const apiKey = credential ?? config.openaiApiKey ?? '';
    if (!apiKey) throw new Error('No OpenAI API key configured for this site');
    const model = site.llmModel ?? 'gpt-4o';
    return createOpenAiClient(apiKey, model);
  }

  // Default: Anthropic
  const apiKey = credential ?? config.anthropicApiKey;
  const model = site.llmModel ?? site.claudeModel;
  return createAnthropicClient(apiKey, model);
}
