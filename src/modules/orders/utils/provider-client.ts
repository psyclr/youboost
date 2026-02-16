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

export interface ProviderClient {
  submitOrder(params: SubmitOrderParams): Promise<SubmitResult>;
  checkStatus(externalOrderId: string): Promise<StatusResult>;
}
