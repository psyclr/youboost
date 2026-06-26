import { apiRequest, apiRequestValidated } from './client';
import { buildQuery } from './query';
import {
  balanceResponseSchema,
  cryptomusCheckoutResponseSchema,
  stripeCheckoutResponseSchema,
} from './schemas';
import type {
  BalanceResponse,
  PaginatedDeposits,
  PaginatedTransactions,
  TransactionDetailed,
} from './types';

export const getBalance = () =>
  apiRequestValidated<BalanceResponse>('/billing/balance', balanceResponseSchema);

export const getDeposits = (params?: { page?: number; limit?: number; status?: string }) =>
  apiRequest<PaginatedDeposits>(
    `/billing/deposits${buildQuery({
      page: params?.page || undefined,
      limit: params?.limit || undefined,
      status: params?.status,
    })}`,
  );

export const getTransactions = (params?: { page?: number; limit?: number; type?: string }) =>
  apiRequest<PaginatedTransactions>(
    `/billing/transactions${buildQuery({
      page: params?.page || undefined,
      limit: params?.limit || undefined,
      type: params?.type,
    })}`,
  );

export const getTransaction = (id: string) =>
  apiRequest<TransactionDetailed>(`/billing/transactions/${id}`);

export const createStripeCheckout = (amount: number, metrikaClientId?: string | null) =>
  apiRequestValidated<{ sessionId: string; url: string }>(
    '/billing/stripe/checkout',
    stripeCheckoutResponseSchema,
    {
      method: 'POST',
      body: JSON.stringify({ amount, metrikaClientId: metrikaClientId ?? undefined }),
    },
  );

export const createCryptomusCheckout = (amount: number, metrikaClientId?: string | null) =>
  apiRequestValidated<{ orderId: string; url: string }>(
    '/billing/cryptomus/checkout',
    cryptomusCheckoutResponseSchema,
    {
      method: 'POST',
      body: JSON.stringify({ amount, metrikaClientId: metrikaClientId ?? undefined }),
    },
  );
