import { chargeFunds, releaseFunds } from '../../billing';
import type { OrderRecord } from '../orders.types';

export async function settleFunds(order: OrderRecord, newStatus: string): Promise<void> {
  const price = Number(order.price);

  if (newStatus === 'COMPLETED') {
    await chargeFunds(order.userId, price, order.id);
    return;
  }

  if (newStatus === 'FAILED') {
    await releaseFunds(order.userId, price, order.id);
    return;
  }

  if (newStatus === 'PARTIAL') {
    const remains = order.remains ?? 0;
    const completedRatio = (order.quantity - remains) / order.quantity;
    const chargeAmount = Math.round(price * completedRatio * 100) / 100;
    const releaseAmount = Math.round((price - chargeAmount) * 100) / 100;

    if (chargeAmount > 0) {
      await chargeFunds(order.userId, chargeAmount, order.id);
    }
    if (releaseAmount > 0) {
      await releaseFunds(order.userId, releaseAmount, order.id);
    }
  }
}
