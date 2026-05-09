import type { Logger } from 'pino';
import type { OutboxHandler } from '../../../shared/outbox';
import type { ReferralsService } from '../referrals.service';

interface HandlerDeps {
  referralsService: ReferralsService;
  logger: Logger;
}

export function createReferralAppliedHandler(deps: HandlerDeps): OutboxHandler<'referral.applied'> {
  const { referralsService, logger } = deps;
  return {
    eventType: 'referral.applied',
    name: 'referral-applied',
    async handle(event): Promise<void> {
      logger.debug(
        { userId: event.payload.userId, referralCode: event.payload.referralCode },
        'applying referral',
      );
      await referralsService.applyReferral(event.payload.userId, event.payload.referralCode);
    },
  };
}
