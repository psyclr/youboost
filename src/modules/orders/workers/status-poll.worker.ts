import { getConfig } from '../../../shared/config';
import { createServiceLogger } from '../../../shared/utils/logger';
import * as ordersRepo from '../orders.repository';
import * as serviceRepo from '../service.repository';
import { findProviderById } from '../../providers/providers.repository';
import { decryptApiKey } from '../../providers/utils/encryption';
import { createSmmApiClient } from '../../providers/utils/smm-api-client';
import { providerClient as stubClient } from '../utils/stub-provider-client';
import { isCircuitOpen, recordFailure, recordSuccess } from '../utils/circuit-breaker';
import { mapProviderStatus, isTerminalStatus } from '../utils/status-mapper';
import { settleFunds } from '../utils/fund-settlement';
import { enqueueWebhookDelivery } from '../../webhooks';
import { enqueueNotification } from '../../notifications';
import type { ProviderClient } from '../utils/provider-client';
import type { OrderRecord, UpdateOrderData } from '../orders.types';

const log = createServiceLogger('status-poll');

export async function pollOrderStatuses(): Promise<void> {
  const config = getConfig();
  const { batchSize, circuitBreakerThreshold, circuitBreakerCooldownMs } = config.polling;

  const orders = await ordersRepo.findProcessingOrders(batchSize);
  if (orders.length === 0) {
    log.debug('No processing orders to poll');
    return;
  }

  log.info({ count: orders.length }, 'Polling order statuses');

  const grouped = groupByProvider(orders);

  for (const [providerId, providerOrders] of grouped) {
    if (isCircuitOpen(providerId, circuitBreakerThreshold, circuitBreakerCooldownMs)) {
      log.warn({ providerId }, 'Circuit breaker open, skipping provider');
      continue;
    }

    let client: ProviderClient;
    try {
      client = await resolveClient(providerId);
    } catch (err) {
      log.error({ providerId, err }, 'Failed to resolve provider client');
      recordFailure(providerId);
      continue;
    }

    for (const order of providerOrders) {
      try {
        await pollSingleOrder(client, order);
        recordSuccess(providerId);
      } catch (err) {
        log.error({ orderId: order.id, providerId, err }, 'Failed to poll order status');
        recordFailure(providerId);
      }
    }
  }
}

function groupByProvider(orders: OrderRecord[]): Map<string, OrderRecord[]> {
  const map = new Map<string, OrderRecord[]>();
  for (const order of orders) {
    const pid = order.providerId ?? 'stub';
    const list = map.get(pid) ?? [];
    list.push(order);
    map.set(pid, list);
  }
  return map;
}

async function resolveClient(providerId: string): Promise<ProviderClient> {
  if (providerId === 'stub') {
    return stubClient;
  }

  const provider = await findProviderById(providerId);
  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  const apiKey = decryptApiKey(provider.apiKeyEncrypted);
  return createSmmApiClient({ apiEndpoint: provider.apiEndpoint, apiKey });
}

const TERMINAL_EVENT_MAP: Record<string, string> = {
  COMPLETED: 'order.completed',
  FAILED: 'order.failed',
  PARTIAL: 'order.partial',
};

const TERMINAL_SUBJECT_MAP: Record<string, string> = {
  COMPLETED: 'Order Completed',
  FAILED: 'Order Failed',
  PARTIAL: 'Order Partially Completed',
};

function dispatchTerminalNotifications(
  order: OrderRecord,
  newStatus: string,
  remains: number | null | undefined,
): void {
  const webhookEvent = TERMINAL_EVENT_MAP[newStatus];
  if (!webhookEvent) return;

  enqueueWebhookDelivery(order.userId, webhookEvent, {
    orderId: order.id,
    status: newStatus,
    remains,
  }).catch(() => {
    /* fire-and-forget */
  });

  enqueueNotification({
    userId: order.userId,
    type: 'EMAIL',
    channel: 'user-email',
    subject: TERMINAL_SUBJECT_MAP[newStatus] ?? 'Order Update',
    body: `Your order ${order.id} status: ${newStatus}.`,
    eventType: webhookEvent,
    referenceType: 'order',
    referenceId: order.id,
  }).catch(() => {
    /* fire-and-forget */
  });
}

async function handleRefillEligibility(orderId: string, serviceId: string): Promise<void> {
  try {
    const service = await serviceRepo.findServiceById(serviceId);
    if (service?.refillDays) {
      const eligibleUntil = new Date();
      eligibleUntil.setDate(eligibleUntil.getDate() + service.refillDays);
      await ordersRepo.updateOrderStatus(orderId, {
        status: 'COMPLETED',
        refillEligibleUntil: eligibleUntil,
      });
      log.info({ orderId, refillDays: service.refillDays }, 'Refill eligibility set');
    }
  } catch (err) {
    log.error({ orderId, err }, 'Failed to set refill eligibility');
  }
}

async function handleTerminalStatus(
  order: OrderRecord,
  newStatus: string,
  remains: number | null | undefined,
): Promise<void> {
  const updatedOrder = { ...order, remains: remains ?? order.remains };
  await settleFunds(updatedOrder, newStatus);
  dispatchTerminalNotifications(order, newStatus, updatedOrder.remains);

  if (newStatus === 'COMPLETED') {
    await handleRefillEligibility(order.id, order.serviceId);
  }
}

async function pollSingleOrder(client: ProviderClient, order: OrderRecord): Promise<void> {
  const externalOrderId = order.externalOrderId ?? '';
  const result = await client.checkStatus(externalOrderId);
  const newStatus = mapProviderStatus(result.status);

  if (newStatus === order.status && !isTerminalStatus(newStatus)) {
    return;
  }

  const updateData: UpdateOrderData = { status: newStatus };
  if (result.startCount !== undefined) updateData.startCount = result.startCount;
  if (result.remains !== undefined) updateData.remains = result.remains;
  if (isTerminalStatus(newStatus)) updateData.completedAt = new Date();

  await ordersRepo.updateOrderStatus(order.id, updateData);

  if (isTerminalStatus(newStatus)) {
    await handleTerminalStatus(order, newStatus, result.remains);
  }

  log.info({ orderId: order.id, oldStatus: order.status, newStatus }, 'Order status updated');
}
