import type { Logger } from 'pino';

/**
 * A confirmed money event to report to Yandex.Metrika as an offline conversion.
 * `clientId` is the Metrika ClientID captured in the browser (`ym(id,
 * 'getClientID', cb)`) at the pay step — without it Metrika cannot attribute the
 * conversion to the visit/source.
 */
export interface OfflineConversion {
  clientId: string;
  /** Metrika goal identifier (configured in the dashboard). */
  target: string;
  price: number;
  /** ISO 4217 code, e.g. 'USD'. */
  currency: string;
  /** When the payment was confirmed. */
  occurredAt: Date;
}

export interface YandexMetrikaClientConfig {
  counterId: string;
  oauthToken: string | undefined;
}

export interface YandexMetrikaClientDeps {
  config: YandexMetrikaClientConfig;
  logger: Logger;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export interface YandexMetrikaClient {
  /** True only when an OAuth token is set — otherwise uploads are skipped. */
  isConfigured(): boolean;
  /** Upload one confirmed conversion. No-op when not configured; throws on HTTP error. */
  uploadOfflineConversion(conversion: OfflineConversion): Promise<void>;
}

const API_BASE = 'https://api-metrika.yandex.net/management/v1/counter';

/**
 * Reports confirmed purchases/deposits to Yandex.Metrika via the Offline
 * Conversions API (the only official server-side path that attributes revenue to
 * a visit). Each call uploads a one-row CSV keyed by ClientID. Disabled — a safe
 * no-op — until `YANDEX_METRIKA_OAUTH_TOKEN` is set, so dev/test and an
 * unconfigured prod never make network calls or fail.
 */
export function createYandexMetrikaClient(deps: YandexMetrikaClientDeps): YandexMetrikaClient {
  const { config, logger } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;

  function isConfigured(): boolean {
    return Boolean(config.oauthToken) && Boolean(config.counterId);
  }

  async function uploadOfflineConversion(conversion: OfflineConversion): Promise<void> {
    if (!isConfigured()) {
      logger.debug(
        { target: conversion.target },
        'Yandex.Metrika not configured — skipping offline conversion',
      );
      return;
    }

    const dateTime = Math.floor(conversion.occurredAt.getTime() / 1000);
    const row = [
      conversion.clientId,
      conversion.target,
      dateTime,
      conversion.price.toFixed(2),
      conversion.currency,
    ].join(',');
    const csv = `ClientId,Target,DateTime,Price,Currency\n${row}\n`;

    const form = new FormData();
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'conversions.csv');

    const url = `${API_BASE}/${config.counterId}/offline_conversions/upload?client_id_type=CLIENT_ID`;
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `OAuth ${config.oauthToken}` },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Yandex.Metrika offline conversion upload failed: ${response.status} ${detail}`.trim(),
      );
    }

    logger.info(
      { target: conversion.target, price: conversion.price, counterId: config.counterId },
      'Yandex.Metrika offline conversion uploaded',
    );
  }

  return { isConfigured, uploadOfflineConversion };
}
