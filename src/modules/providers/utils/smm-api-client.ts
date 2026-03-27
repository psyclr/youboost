import { ValidationError } from '../../../shared/errors';
import type {
  ProviderClient,
  SubmitOrderParams,
  SubmitResult,
  StatusResult,
  ProviderServiceInfo,
  ProviderBalanceInfo,
} from '../../orders/utils/provider-client';

interface SmmApiClientOptions {
  apiEndpoint: string;
  apiKey: string;
}

interface SmmSubmitResponse {
  order?: number;
  error?: string;
}

interface SmmStatusResponse {
  charge?: string;
  start_count?: string;
  status?: string;
  remains?: string;
  error?: string;
}

export function createSmmApiClient(opts: SmmApiClientOptions): ProviderClient {
  return {
    async submitOrder(params: SubmitOrderParams): Promise<SubmitResult> {
      const body = new URLSearchParams({
        key: opts.apiKey,
        action: 'add',
        service: params.serviceId,
        link: params.link,
        quantity: String(params.quantity),
      });

      let data: SmmSubmitResponse;
      try {
        const response = await fetch(opts.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        data = (await response.json()) as SmmSubmitResponse;
      } catch {
        throw new Error('Provider API request failed: network error');
      }

      if (data.error) {
        throw new ValidationError(`Provider error: ${data.error}`, 'PROVIDER_ERROR');
      }

      if (!data.order) {
        throw new ValidationError('Provider returned no order ID', 'PROVIDER_NO_ORDER');
      }

      return {
        externalOrderId: String(data.order),
        status: 'processing',
      };
    },

    async checkStatus(externalOrderId: string): Promise<StatusResult> {
      const body = new URLSearchParams({
        key: opts.apiKey,
        action: 'status',
        order: externalOrderId,
      });

      let data: SmmStatusResponse;
      try {
        const response = await fetch(opts.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        data = (await response.json()) as SmmStatusResponse;
      } catch {
        throw new Error('Provider API request failed: network error');
      }

      if (data.error) {
        throw new ValidationError(`Provider error: ${data.error}`, 'PROVIDER_ERROR');
      }

      return {
        status: data.status ?? 'unknown',
        startCount: Number(data.start_count ?? '0'),
        completed: Number(data.start_count ?? '0'),
        remains: Number(data.remains ?? '0'),
      };
    },

    async fetchServices(): Promise<ProviderServiceInfo[]> {
      const body = new URLSearchParams({ key: opts.apiKey, action: 'services' });
      let data: unknown;
      try {
        const response = await fetch(opts.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        data = await response.json();
      } catch {
        throw new Error('Provider API request failed: network error');
      }
      if ((data as Record<string, unknown>).error) {
        throw new ValidationError(
          `Provider error: ${(data as Record<string, unknown>).error}`,
          'PROVIDER_ERROR',
        );
      }
      const toStr = (v: unknown): string => (v == null ? '' : String(v));
      return (Array.isArray(data) ? data : []).map((s: Record<string, unknown>) => ({
        serviceId: toStr(s.service),
        name: toStr(s.name),
        category: toStr(s.category),
        rate: Number(s.rate ?? 0),
        min: Number(s.min ?? 0),
        max: Number(s.max ?? 0),
        type: toStr(s.type),
        description: toStr(s.description),
      }));
    },

    async checkBalance(): Promise<ProviderBalanceInfo> {
      const body = new URLSearchParams({ key: opts.apiKey, action: 'balance' });
      let data: unknown;
      try {
        const response = await fetch(opts.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        data = await response.json();
      } catch {
        throw new Error('Provider API request failed: network error');
      }
      if ((data as Record<string, unknown>).error) {
        throw new ValidationError(
          `Provider error: ${(data as Record<string, unknown>).error}`,
          'PROVIDER_ERROR',
        );
      }
      const rec = data as Record<string, unknown>;
      const cur = rec.currency;
      return {
        balance: Number(rec.balance ?? 0),
        currency: typeof cur === 'string' ? cur : 'USD',
      };
    },
  };
}
