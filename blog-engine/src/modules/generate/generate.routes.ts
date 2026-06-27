import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { GenerateService } from './generate.service';

const GenerateSchema = z.object({
  keyword: z.string().min(1).max(255).optional(),
});

export function createGenerateRoutes(generateService: GenerateService) {
  return async function (app: FastifyInstance): Promise<void> {
    // POST /sites/:siteId/generate — synchronous one-shot generation.
    // (BullMQ async + cron scheduling layer on top of this same service.)
    app.post('/:siteId/generate', async (req, reply) => {
      const { siteId } = req.params as { siteId: string };
      const { keyword } = GenerateSchema.parse(req.body ?? {});
      const result = await generateService.generateForSite(siteId, keyword);
      return reply.status(201).send(result);
    });
  };
}
