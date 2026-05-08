import type { Logger } from 'pino';
import type { OrderRecord } from '../orders.types';

export interface FundSettlement {
  settleFunds(order: OrderRecord, finalStatus: string): Promise<void>;
}

export interface FundSettlementDeps {
  billing: {
    chargeFunds(userId: string, amount: number, orderId: string): Promise<void>;
    releaseFunds(userId: string, amount: number, orderId: string): Promise<void>;
    refundFunds(userId: string, amount: number, orderId: string): Promise<void>;
  };
  logger: Logger;
}

export function createFundSettlement(deps: FundSettlementDeps): FundSettlement {
  const { billing } = deps;

  async function settleFunds(order: OrderRecord, newStatus: string): Promise<void> {
    const price = Number(order.price);

    if (newStatus === 'COMPLETED') {
      await billing.chargeFunds(order.userId, price, order.id);
      return;
    }

    if (newStatus === 'FAILED') {
      await billing.releaseFunds(order.userId, price, order.id);
      return;
    }

    if (newStatus === 'PARTIAL') {
      const remains = order.remains ?? 0;
      const completedRatio = (order.quantity - remains) / order.quantity;
      const chargeAmount = Math.round(price * completedRatio * 100) / 100;
      const releaseAmount = Math.round((price - chargeAmount) * 100) / 100;

      if (chargeAmount > 0) {
        await billing.chargeFunds(order.userId, chargeAmount, order.id);
      }
      if (releaseAmount > 0) {
        await billing.releaseFunds(order.userId, releaseAmount, order.id);
      }
    }
  }

  return { settleFunds };
}
