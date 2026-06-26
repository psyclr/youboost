import type { Prisma, PrismaClient } from '../../generated/prisma';

export interface RecordAttemptInput {
  orderId: string;
  providerId: string;
  externalServiceId: string;
  outcome: 'SUCCESS' | 'FAILED';
  error?: string | null;
  providerCost?: number;
}

export interface ProviderOrderAttemptRepository {
  /** Append one provider attempt (append-only audit of the failover walk). */
  record(input: RecordAttemptInput, tx?: Prisma.TransactionClient): Promise<void>;
}

export function createProviderOrderAttemptRepository(
  prisma: PrismaClient,
): ProviderOrderAttemptRepository {
  return {
    async record(input, tx): Promise<void> {
      const client = tx ?? prisma;
      await client.providerOrderAttempt.create({
        data: {
          orderId: input.orderId,
          providerId: input.providerId,
          externalServiceId: input.externalServiceId,
          outcome: input.outcome,
          error: input.error ?? null,
          providerCost: input.providerCost ?? 0,
        },
      });
    },
  };
}
