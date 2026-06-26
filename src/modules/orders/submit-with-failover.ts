import type { Logger } from 'pino';
import type { ProviderSelectorPort } from './ports/provider-selector.port';
import type { ServicePanelReader } from '../providers/service-provider-mapping.repository';
import type { ProviderOrderAttemptRepository } from '../providers/provider-order-attempt.repository';

export interface FailoverDeps {
  providerSelector: ProviderSelectorPort;
  mappingRepo: ServicePanelReader;
  attemptRepo: ProviderOrderAttemptRepository;
  logger: Logger;
}

export interface FailoverArgs {
  orderId: string;
  userId: string;
  serviceId: string;
  link: string;
  quantity: number;
}

export type FailoverResult =
  | { ok: true; providerId: string; externalOrderId: string }
  | { ok: false; attempts: number };

/**
 * Try to submit an order across every panel mapped to its service, in priority
 * order, until one accepts it. Each attempt (success or failure) is recorded for
 * analytics; per-panel failures are logged. Returns the winning panel on success
 * or {ok:false, attempts} when no panel could fulfil it.
 *
 * Pure orchestration: it does NOT touch order status or the outbox — the caller
 * owns those, emitting events transactionally alongside the status change. This
 * keeps the outbox's "event atomic with state change" contract intact.
 * Provider failures never throw out of here; only programmer errors propagate.
 */
export async function submitWithFailover(
  deps: FailoverDeps,
  args: FailoverArgs,
): Promise<FailoverResult> {
  const { providerSelector, mappingRepo, attemptRepo, logger } = deps;
  const candidates = await mappingRepo.listActiveByServiceId(args.serviceId);
  let attempts = 0;

  for (const candidate of candidates) {
    attempts += 1;
    try {
      const { providerId, client } = await providerSelector.selectProviderById(
        candidate.providerId,
      );
      const result = await client.submitOrder({
        serviceId: candidate.externalServiceId,
        link: args.link,
        quantity: args.quantity,
      });
      await attemptRepo.record({
        orderId: args.orderId,
        providerId: candidate.providerId,
        externalServiceId: candidate.externalServiceId,
        outcome: 'SUCCESS',
        providerCost: candidate.providerCost,
      });
      return {
        ok: true,
        providerId: providerId ?? candidate.providerId,
        externalOrderId: result.externalOrderId,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'provider error';
      logger.warn(
        { orderId: args.orderId, providerId: candidate.providerId, error },
        'panel failed — trying next',
      );
      await attemptRepo.record({
        orderId: args.orderId,
        providerId: candidate.providerId,
        externalServiceId: candidate.externalServiceId,
        outcome: 'FAILED',
        error,
        providerCost: candidate.providerCost,
      });
    }
  }

  return { ok: false, attempts };
}
