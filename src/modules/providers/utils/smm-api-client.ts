import { ValidationError } from '../../../shared/errors';
import type {
  ProviderClient,
  SubmitOrderParams,
  SubmitResult,
  StatusResult,
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

      const response = await fetch(opts.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = (await response.json()) as SmmSubmitResponse;

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

      const response = await fetch(opts.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = (await response.json()) as SmmStatusResponse;

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
  };
}
