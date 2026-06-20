import type { Logger } from 'pino';
import type { OutboxHandler } from '../../../shared/outbox';
import type { YandexMetrikaClient } from '../yandex-metrika.client';

/**
 * Outbox handlers that report confirmed money events to Yandex.Metrika as
 * server-side conversions. A purchase/deposit is only known to be real on the
 * server (the payment webhook), so — unlike the browser's intent events
 * (add-to-cart, checkout-started) — these are reported here, not from the page.
 *
 * Both skip silently when no Metrika ClientID was captured at the pay step
 * (visitor blocked the counter) — without it Metrika cannot attribute the
 * conversion. Delivery is at-least-once (same as the email handlers): a rare
 * crash between a successful upload and the outbox commit can re-send.
 */
interface PurchaseHandlerDeps {
  metrikaClient: YandexMetrikaClient;
  /** Metrika goal identifier for a completed order payment. */
  target: string;
  logger: Logger;
}

export function createPurchaseConversionHandler(
  deps: PurchaseHandlerDeps,
): OutboxHandler<'payment.confirmed'> {
  const { metrikaClient, target, logger } = deps;
  return {
    eventType: 'payment.confirmed',
    name: 'purchase-conversion',
    async handle(event): Promise<void> {
      const { paymentId, amount, currency, metrikaClientId } = event.payload;
      if (!metrikaClientId) {
        logger.debug({ paymentId }, 'no Metrika ClientID — skipping purchase conversion');
        return;
      }
      await metrikaClient.uploadOfflineConversion({
        clientId: metrikaClientId,
        target,
        price: amount,
        currency,
        occurredAt: new Date(),
      });
    },
  };
}

interface DepositHandlerDeps {
  metrikaClient: YandexMetrikaClient;
  /** Metrika goal identifier for a confirmed wallet deposit. */
  target: string;
  logger: Logger;
}

export function createDepositConversionHandler(
  deps: DepositHandlerDeps,
): OutboxHandler<'deposit.confirmed'> {
  const { metrikaClient, target, logger } = deps;
  return {
    eventType: 'deposit.confirmed',
    name: 'deposit-conversion',
    async handle(event): Promise<void> {
      const { depositId, amount, metrikaClientId } = event.payload;
      if (!metrikaClientId) {
        logger.debug({ depositId }, 'no Metrika ClientID — skipping deposit conversion');
        return;
      }
      await metrikaClient.uploadOfflineConversion({
        clientId: metrikaClientId,
        target,
        price: amount,
        currency: 'USD',
        occurredAt: new Date(),
      });
    },
  };
}
