import { createServiceLogger } from '../../shared/utils/logger';
import * as billingInternal from '../billing/billing-internal.service';
import type { AdminBalanceAdjustInput } from './admin.types';

const log = createServiceLogger('admin-billing');

export async function adjustBalance(userId: string, input: AdminBalanceAdjustInput): Promise<void> {
  await billingInternal.adjustBalance(userId, input.amount, input.reason);

  log.info({ userId, amount: input.amount, reason: input.reason }, 'Balance adjusted');
}
