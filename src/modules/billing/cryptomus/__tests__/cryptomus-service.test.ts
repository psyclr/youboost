import { signRequestBody } from '../cryptomus.crypto';
import { createCryptomusPaymentService } from '../cryptomus.service';
import type { DepositLifecycleService } from '../../deposit-lifecycle.service';
import { createFakeDepositRepository, silentLogger } from '../../__tests__/fakes';

const paymentKey = 'payment-key-xyz';

function makeLifecycle(): jest.Mocked<DepositLifecycleService> {
  return {
    prepareDepositCheckout: jest.fn(),
    confirmDepositTransaction: jest.fn(),
    failDepositTransaction: jest.fn(),
  };
}

function buildWebhook(bodyObj: Record<string, unknown>): string {
  const unsignedJson = JSON.stringify(bodyObj);
  const sign = signRequestBody(unsignedJson, paymentKey);
  return JSON.stringify({ ...bodyObj, sign });
}

describe('Cryptomus payment service - webhook handling', () => {
  it('dispatches paid status to lifecycle.confirmDepositTransaction', async () => {
    const lifecycle = makeLifecycle();
    const depositRepo = createFakeDepositRepository([
      {
        id: 'dep-1',
        userId: 'user-1',
        amount: 25,
        status: 'PENDING',
        cryptomusOrderId: 'dep-1',
      },
    ]);
    const service = createCryptomusPaymentService({
      depositRepo,
      lifecycle,
      cryptomusConfig: { merchantId: 'm', paymentKey, callbackUrl: 'https://cb' },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

    const webhookBody = buildWebhook({ order_id: 'dep-1', status: 'paid', amount: '25.00' });
    await service.handleWebhookEvent(webhookBody);

    expect(lifecycle.confirmDepositTransaction).toHaveBeenCalledWith(
      'dep-1',
      'user-1',
      'Cryptomus',
    );
  });

  it('dispatches paid_over status to lifecycle.confirmDepositTransaction', async () => {
    const lifecycle = makeLifecycle();
    const depositRepo = createFakeDepositRepository([
      {
        id: 'dep-1',
        userId: 'user-1',
        amount: 25,
        status: 'PENDING',
        cryptomusOrderId: 'dep-1',
      },
    ]);
    const service = createCryptomusPaymentService({
      depositRepo,
      lifecycle,
      cryptomusConfig: { merchantId: 'm', paymentKey, callbackUrl: 'https://cb' },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

    const webhookBody = buildWebhook({
      order_id: 'dep-1',
      status: 'paid_over',
      amount: '30.00',
    });
    await service.handleWebhookEvent(webhookBody);

    expect(lifecycle.confirmDepositTransaction).toHaveBeenCalledWith(
      'dep-1',
      'user-1',
      'Cryptomus',
    );
  });

  it('dispatches fail status to lifecycle.failDepositTransaction', async () => {
    const lifecycle = makeLifecycle();
    const depositRepo = createFakeDepositRepository([
      {
        id: 'dep-1',
        userId: 'user-1',
        status: 'PENDING',
        cryptomusOrderId: 'dep-1',
      },
    ]);
    const service = createCryptomusPaymentService({
      depositRepo,
      lifecycle,
      cryptomusConfig: { merchantId: 'm', paymentKey, callbackUrl: 'https://cb' },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

    const webhookBody = buildWebhook({ order_id: 'dep-1', status: 'fail' });
    await service.handleWebhookEvent(webhookBody);

    expect(lifecycle.failDepositTransaction).toHaveBeenCalledWith('dep-1', 'Cryptomus', 'fail');
  });

  it('throws on invalid webhook signature', async () => {
    const lifecycle = makeLifecycle();
    const service = createCryptomusPaymentService({
      depositRepo: createFakeDepositRepository(),
      lifecycle,
      cryptomusConfig: { merchantId: 'm', paymentKey, callbackUrl: 'https://cb' },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

    const webhookBody = JSON.stringify({
      order_id: 'dep-1',
      status: 'paid',
      sign: 'invalid-signature',
    });

    await expect(service.handleWebhookEvent(webhookBody)).rejects.toThrow(
      /Invalid Cryptomus webhook signature/,
    );
    expect(lifecycle.confirmDepositTransaction).not.toHaveBeenCalled();
  });

  it('ignores webhook with unknown order_id', async () => {
    const lifecycle = makeLifecycle();
    const service = createCryptomusPaymentService({
      depositRepo: createFakeDepositRepository(),
      lifecycle,
      cryptomusConfig: { merchantId: 'm', paymentKey, callbackUrl: 'https://cb' },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

    const webhookBody = buildWebhook({ order_id: 'unknown', status: 'paid' });
    await service.handleWebhookEvent(webhookBody);

    expect(lifecycle.confirmDepositTransaction).not.toHaveBeenCalled();
    expect(lifecycle.failDepositTransaction).not.toHaveBeenCalled();
  });

  it('ignores replay on already-resolved expired deposit', async () => {
    const lifecycle = makeLifecycle();
    const depositRepo = createFakeDepositRepository([
      {
        id: 'dep-1',
        userId: 'user-1',
        status: 'CONFIRMED',
        expiresAt: new Date(Date.now() - 1_000_000),
        cryptomusOrderId: 'dep-1',
      },
    ]);
    const service = createCryptomusPaymentService({
      depositRepo,
      lifecycle,
      cryptomusConfig: { merchantId: 'm', paymentKey, callbackUrl: 'https://cb' },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

    const webhookBody = buildWebhook({ order_id: 'dep-1', status: 'paid' });
    await service.handleWebhookEvent(webhookBody);

    expect(lifecycle.confirmDepositTransaction).not.toHaveBeenCalled();
  });

  it('ignores non-terminal statuses', async () => {
    const lifecycle = makeLifecycle();
    const depositRepo = createFakeDepositRepository([
      {
        id: 'dep-1',
        userId: 'user-1',
        status: 'PENDING',
        cryptomusOrderId: 'dep-1',
      },
    ]);
    const service = createCryptomusPaymentService({
      depositRepo,
      lifecycle,
      cryptomusConfig: { merchantId: 'm', paymentKey, callbackUrl: 'https://cb' },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

    const webhookBody = buildWebhook({ order_id: 'dep-1', status: 'process' });
    await service.handleWebhookEvent(webhookBody);

    expect(lifecycle.confirmDepositTransaction).not.toHaveBeenCalled();
    expect(lifecycle.failDepositTransaction).not.toHaveBeenCalled();
  });
});
