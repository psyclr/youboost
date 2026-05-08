import type { Logger } from 'pino';
import type { AdminBalanceAdjustInput } from './admin.types';

export interface AdminBillingService {
  adjustBalance(userId: string, input: AdminBalanceAdjustInput): Promise<void>;
}

export interface AdminBillingServiceDeps {
  adjustBalance: (userId: string, amount: number, reason: string) => Promise<void>;
  logger: Logger;
}

export function createAdminBillingService(deps: AdminBillingServiceDeps): AdminBillingService {
  const { adjustBalance: internalAdjustBalance, logger } = deps;

  async function adjustBalance(userId: string, input: AdminBalanceAdjustInput): Promise<void> {
    await internalAdjustBalance(userId, input.amount, input.reason);

    logger.info({ userId, amount: input.amount, reason: input.reason }, 'Balance adjusted');
  }

  return { adjustBalance };
}
