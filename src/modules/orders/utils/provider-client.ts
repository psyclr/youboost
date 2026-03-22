export interface SubmitOrderParams {
  serviceId: string;
  link: string;
  quantity: number;
}

export interface SubmitResult {
  externalOrderId: string;
  status: string;
}

export interface StatusResult {
  status: string;
  startCount: number;
  completed: number;
  remains: number;
}

export interface ProviderServiceInfo {
  serviceId: string;
  name: string;
  category: string;
  rate: number;
  min: number;
  max: number;
  type: string;
  description: string;
}

export interface ProviderBalanceInfo {
  balance: number;
  currency: string;
}

export interface ProviderClient {
  submitOrder(params: SubmitOrderParams): Promise<SubmitResult>;
  checkStatus(externalOrderId: string): Promise<StatusResult>;
  fetchServices(): Promise<ProviderServiceInfo[]>;
  checkBalance(): Promise<ProviderBalanceInfo>;
}
