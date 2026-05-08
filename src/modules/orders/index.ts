export type { OrdersService, OrdersServiceDeps } from './orders.service';
export { createOrdersService } from './orders.service';
export type { OrdersRepository } from './orders.repository';
export { createOrdersRepository } from './orders.repository';
export type { ServicesRepository } from './service.repository';
export { createServicesRepository } from './service.repository';
export type { OrderRoutesDeps } from './orders.routes';
export { createOrderRoutes } from './orders.routes';

export type {
  OrderTimeoutWorker,
  OrderTimeoutWorkerDeps,
  StatusPollWorker,
  StatusPollWorkerDeps,
  DripFeedWorker,
  DripFeedWorkerDeps,
} from './workers';
export { createOrderTimeoutWorker, createStatusPollWorker, createDripFeedWorker } from './workers';

export type { FundSettlement, FundSettlementDeps } from './utils/fund-settlement';
export { createFundSettlement } from './utils/fund-settlement';
export type { CircuitBreaker } from './utils/circuit-breaker';
export { createCircuitBreaker } from './utils/circuit-breaker';

export type { ServiceRecord, OrderRecord } from './orders.types';
export type {
  ProviderClient,
  SubmitOrderParams,
  SubmitResult,
  StatusResult,
  ProviderServiceInfo,
  ProviderBalanceInfo,
} from './utils/provider-client';
export { providerClient as stubProviderClient } from './utils/stub-provider-client';

// ---------------------------------------------------------------------------
// Transitional namespace shims for unconverted callers (admin service).
// Admin still uses `orderRepo.findOrderByIdAdmin`, `serviceRepo.findServiceById`
// etc. Delete in sweep phase once admin converts.
// ---------------------------------------------------------------------------
import { getPrisma } from '../../shared/database';
import { createOrdersRepository } from './orders.repository';
import { createServicesRepository } from './service.repository';
import type {
  OrderRecord,
  ServiceRecord,
  CreateOrderData,
  UpdateOrderData,
  CreateServiceData,
  UpdateServiceData,
} from './orders.types';

export const orderRepo = {
  createOrder(data: CreateOrderData): Promise<OrderRecord> {
    return createOrdersRepository(getPrisma()).createOrder(data);
  },
  findOrderById(orderId: string, userId: string): Promise<OrderRecord | null> {
    return createOrdersRepository(getPrisma()).findOrderById(orderId, userId);
  },
  findOrders(
    userId: string,
    filters: { status?: string; serviceId?: string; page: number; limit: number },
  ): Promise<{ orders: OrderRecord[]; total: number }> {
    return createOrdersRepository(getPrisma()).findOrders(userId, filters);
  },
  findProcessingOrders(batchSize: number): Promise<OrderRecord[]> {
    return createOrdersRepository(getPrisma()).findProcessingOrders(batchSize);
  },
  updateOrderStatus(orderId: string, data: UpdateOrderData): Promise<OrderRecord> {
    return createOrdersRepository(getPrisma()).updateOrderStatus(orderId, data);
  },
  findDripFeedOrdersDue(): Promise<OrderRecord[]> {
    return createOrdersRepository(getPrisma()).findDripFeedOrdersDue();
  },
  incrementDripFeedRun(orderId: string): Promise<OrderRecord> {
    return createOrdersRepository(getPrisma()).incrementDripFeedRun(orderId);
  },
  incrementRefillCount(orderId: string): Promise<OrderRecord> {
    return createOrdersRepository(getPrisma()).incrementRefillCount(orderId);
  },
  pauseDripFeed(orderId: string): Promise<OrderRecord> {
    return createOrdersRepository(getPrisma()).pauseDripFeed(orderId);
  },
  resumeDripFeed(orderId: string): Promise<OrderRecord> {
    return createOrdersRepository(getPrisma()).resumeDripFeed(orderId);
  },
  findTimedOutOrders(timeoutHours: number): Promise<OrderRecord[]> {
    return createOrdersRepository(getPrisma()).findTimedOutOrders(timeoutHours);
  },
  findAllOrders(filters: {
    status?: string | undefined;
    userId?: string | undefined;
    isDripFeed?: boolean | undefined;
    page: number;
    limit: number;
  }): Promise<{ orders: OrderRecord[]; total: number }> {
    return createOrdersRepository(getPrisma()).findAllOrders(filters);
  },
  findOrderByIdAdmin(orderId: string): Promise<OrderRecord | null> {
    return createOrdersRepository(getPrisma()).findOrderByIdAdmin(orderId);
  },
};

export const serviceRepo = {
  findServiceById(serviceId: string): Promise<ServiceRecord | null> {
    return createServicesRepository(getPrisma()).findServiceById(serviceId);
  },
  findActiveServices(filters?: { platform?: string; type?: string }): Promise<ServiceRecord[]> {
    return createServicesRepository(getPrisma()).findActiveServices(filters);
  },
  findAllServices(filters?: { isActive?: boolean }): Promise<ServiceRecord[]> {
    return createServicesRepository(getPrisma()).findAllServices(filters);
  },
  findAllServicesPaginatedWithProvider(
    page: number,
    limit: number,
  ): Promise<{
    services: Array<ServiceRecord & { provider: { id: string; name: string } | null }>;
    total: number;
  }> {
    return createServicesRepository(getPrisma()).findAllServicesPaginatedWithProvider(page, limit);
  },
  findServiceWithProvider(
    id: string,
  ): Promise<(ServiceRecord & { provider: { id: string; name: string } | null }) | null> {
    return createServicesRepository(getPrisma()).findServiceWithProvider(id);
  },
  createService(data: CreateServiceData): Promise<ServiceRecord> {
    return createServicesRepository(getPrisma()).createService(data);
  },
  updateService(serviceId: string, data: UpdateServiceData): Promise<ServiceRecord> {
    return createServicesRepository(getPrisma()).updateService(serviceId, data);
  },
  deactivateService(serviceId: string): Promise<ServiceRecord> {
    return createServicesRepository(getPrisma()).deactivateService(serviceId);
  },
};
