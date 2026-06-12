import { apiRequest } from './client';
import { buildQuery } from './query';
import type {
  BalanceResponse,
  PaginatedDeposits,
  PaginatedTransactions,
  TransactionDetailed,
} from './types';

export const getBalance = () => apiRequest<BalanceResponse>('/billing/balance');

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

export const createStripeCheckout = (amount: number) =>
  apiRequest<{ sessionId: string; url: string }>('/billing/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });

export const createCryptomusCheckout = (amount: number) =>
  apiRequest<{ orderId: string; url: string }>('/billing/cryptomus/checkout', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
