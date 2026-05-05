import { ValidationError } from '../../../shared/errors';
import { createServiceLogger } from '../../../shared/utils/logger';
import { getConfig } from '../../../shared/config';
import { getPrisma } from '../../../shared/database';
import * as walletRepo from '../wallet.repository';
import * as ledgerRepo from '../ledger.repository';
import * as depositRepo from '../deposit.repository';
import { signRequestBody, verifyWebhookSignature, extractSignFromBody } from './cryptomus.crypto';

const log = createServiceLogger('cryptomus');

const CRYPTOMUS_API = 'https://api.cryptomus.com/v1/payment';

export interface CreateCheckoutInput {
  amount: number;
}

export interface CheckoutSessionResponse {
  orderId: string;
  url: string;
}

interface CryptomusCreatePaymentResult {
  uuid: string;
  order_id: string;
  url: string;
  [key: string]: unknown;
}

interface CryptomusApiResponse<T> {
  state?: number;
  result?: T;
  message?: string;
  errors?: unknown;
}

interface CryptomusWebhookBody {
  order_id?: string;
  status?: string;
  amount?: string;
  uuid?: string;
  [key: string]: unknown;
}

const CONFIRMED_STATUSES = new Set(['paid', 'paid_over']);
const FAILED_STATUSES = new Set(['fail', 'cancel', 'wrong_amount', 'system_fail']);

function getCreds(): { merchantId: string; paymentKey: string } {
  const { cryptomus } = getConfig();
  if (!cryptomus.merchantId || !cryptomus.paymentKey) {
    throw new ValidationError('Cryptomus is not configured', 'CRYPTOMUS_NOT_CONFIGURED');
  }
  return {
    merchantId: cryptomus.merchantId,
    paymentKey: cryptomus.paymentKey,
  };
}

export async function createCheckoutSession(
  userId: string,
  input: CreateCheckoutInput,
): Promise<CheckoutSessionResponse> {
  if (input.amount < 5) {
    throw new ValidationError('Minimum deposit is $5.00', 'MIN_DEPOSIT');
  }
  if (input.amount > 10_000) {
    throw new ValidationError('Maximum deposit is $10,000.00', 'MAX_DEPOSIT');
  }

  const { merchantId, paymentKey } = getCreds();
  const config = getConfig();
  const callbackUrl = config.cryptomus.callbackUrl;
  if (!callbackUrl) {
    throw new ValidationError(
      'Cryptomus callback URL is not configured',
      'CRYPTOMUS_CALLBACK_URL_MISSING',
    );
  }

  await walletRepo.getOrCreateWallet(userId);

  const deposit = await depositRepo.createDeposit({
    userId,
    amount: input.amount,
    cryptoAmount: 0,
    cryptoCurrency: '',
    paymentAddress: '',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  const body = {
    amount: input.amount.toFixed(2),
    currency: 'USD',
    order_id: deposit.id,
    url_callback: `${callbackUrl.replace(/\/$/, '')}/billing/cryptomus/webhook`,
    url_return: `${config.app.url}/billing?deposit=success`,
    url_success: `${config.app.url}/billing?deposit=success`,
  };
  const bodyJson = JSON.stringify(body);
  const sign = signRequestBody(bodyJson, paymentKey);

  const response = await fetch(CRYPTOMUS_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      merchant: merchantId,
      sign,
    },
    body: bodyJson,
  });

  const raw = await response.text();
  let parsed: CryptomusApiResponse<CryptomusCreatePaymentResult>;
  try {
    parsed = JSON.parse(raw) as CryptomusApiResponse<CryptomusCreatePaymentResult>;
  } catch {
    log.error({ status: response.status, raw }, 'Cryptomus returned non-JSON response');
    throw new ValidationError(
      'Cryptomus payment creation failed',
      'CRYPTOMUS_API_INVALID_RESPONSE',
    );
  }

  if (!response.ok || !parsed.result?.url || !parsed.result.order_id) {
    log.error(
      { status: response.status, message: parsed.message, errors: parsed.errors },
      'Cryptomus create payment failed',
    );
    throw new ValidationError(
      parsed.message ?? 'Cryptomus payment creation failed',
      'CRYPTOMUS_API_ERROR',
    );
  }

  await depositRepo.updateDepositCryptomusOrder(deposit.id, {
    cryptomusOrderId: parsed.result.order_id,
    cryptomusCheckoutUrl: parsed.result.url,
  });

  log.info(
    { userId, depositId: deposit.id, cryptomusUuid: parsed.result.uuid },
    'Cryptomus checkout session created',
  );

  return {
    orderId: parsed.result.order_id,
    url: parsed.result.url,
  };
}

export async function handleWebhookEvent(rawBody: string): Promise<void> {
  const { paymentKey } = getCreds();

  if (!verifyWebhookSignature(rawBody, paymentKey)) {
    throw new ValidationError(
      'Invalid Cryptomus webhook signature',
      'CRYPTOMUS_WEBHOOK_INVALID_SIGNATURE',
    );
  }

  // Body is already validated; parse the payload without the sign field.
  const { unsignedJson } = extractSignFromBody(rawBody);
  const payload = JSON.parse(unsignedJson) as CryptomusWebhookBody;

  const orderId = payload.order_id;
  const status = payload.status;
  if (!orderId || !status) {
    log.warn({ payload }, 'Cryptomus webhook missing order_id or status');
    return;
  }

  const deposit = await depositRepo.findDepositByCryptomusOrderId(orderId);
  if (!deposit) {
    log.warn({ orderId }, 'Cryptomus webhook for unknown deposit');
    return;
  }

  if (CONFIRMED_STATUSES.has(status)) {
    await confirmDeposit(deposit.id, deposit.userId);
    return;
  }

  if (FAILED_STATUSES.has(status)) {
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const fresh = await depositRepo.findDepositById(deposit.id, undefined, tx);
      if (fresh?.status !== 'PENDING') return;
      await depositRepo.updateDepositStatus(
        deposit.id,
        {
          status: 'FAILED',
          confirmedAt: null,
          ledgerEntryId: null,
        },
        tx,
      );
      log.info({ depositId: deposit.id, status }, 'Cryptomus deposit marked FAILED');
    });
    return;
  }

  log.debug({ orderId, status }, 'Cryptomus webhook non-terminal status');
}

async function confirmDeposit(depositId: string, userId: string): Promise<void> {
  const prisma = getPrisma();
  const result = await prisma.$transaction(async (tx) => {
    const deposit = await depositRepo.findDepositById(depositId, userId, tx);
    if (!deposit) {
      log.warn({ depositId, userId }, 'Deposit not found during Cryptomus confirm');
      return null;
    }
    if (deposit.status !== 'PENDING') {
      log.debug({ depositId, status: deposit.status }, 'Deposit already processed');
      return null;
    }

    const amount = Number(deposit.amount);
    const wallet = await walletRepo.getOrCreateWallet(userId, 'USD', tx);
    const balanceBefore = Number(wallet.balance);
    const newBalance = balanceBefore + amount;

    await walletRepo.updateBalance({
      walletId: wallet.id,
      newBalance,
      newHold: Number(wallet.holdAmount),
      tx,
    });

    const entry = await ledgerRepo.createLedgerEntry(
      {
        userId,
        walletId: wallet.id,
        type: 'DEPOSIT',
        amount,
        balanceBefore,
        balanceAfter: newBalance,
        referenceType: 'deposit',
        referenceId: depositId,
        description: `Cryptomus deposit $${amount.toFixed(2)}`,
      },
      tx,
    );

    await depositRepo.updateDepositStatus(
      depositId,
      {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        ledgerEntryId: entry.id,
      },
      tx,
    );

    return { amount };
  });

  if (result) {
    log.info({ userId, depositId, amount: result.amount }, 'Cryptomus deposit confirmed');
  }
}
