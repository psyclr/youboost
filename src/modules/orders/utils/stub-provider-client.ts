import type {
  ProviderClient,
  SubmitOrderParams,
  SubmitResult,
  StatusResult,
} from './provider-client';

class StubProviderClient implements ProviderClient {
  async submitOrder(params: SubmitOrderParams): Promise<SubmitResult> {
    return {
      externalOrderId: crypto.randomUUID(),
      status: `processing:${params.serviceId}`,
    };
  }

  async checkStatus(_externalOrderId: string): Promise<StatusResult> {
    return {
      status: 'processing',
      startCount: 0,
      completed: 0,
      remains: 0,
    };
  }
}

export const providerClient: ProviderClient = new StubProviderClient();
