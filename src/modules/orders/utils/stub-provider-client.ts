import type {
  ProviderClient,
  SubmitOrderParams,
  SubmitResult,
  StatusResult,
  ProviderServiceInfo,
  ProviderBalanceInfo,
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

  async fetchServices(): Promise<ProviderServiceInfo[]> {
    return [
      {
        serviceId: '1',
        name: 'Stub Views',
        category: 'YouTube',
        rate: 1.5,
        min: 100,
        max: 1000000,
        type: 'Default',
        description: 'Stub service',
      },
    ];
  }

  async checkBalance(): Promise<ProviderBalanceInfo> {
    return { balance: 100, currency: 'USD' };
  }
}

export const providerClient: ProviderClient = new StubProviderClient();
