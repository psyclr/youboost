import { apiRequest } from './client';
import type {
  BalanceResponse,
  PaginatedDeposits,
  PaginatedTransactions,
  TransactionDetailed,
} from './types';

export const getBalance = () => apiRequest<BalanceResponse>('/billing/balance');

export const getDeposits = (params?: { page?: number; limit?: number; status?: string }) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.status) searchParams.set('status', params.status);
  const qs = searchParams.toString();
  const query = qs ? `?${qs}` : '';
  const url = `/billing/deposits${query}`;
  return apiRequest<PaginatedDeposits>(url);
};

export const getTransactions = (params?: { page?: number; limit?: number; type?: string }) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.type) searchParams.set('type', params.type);
  const qs = searchParams.toString();
  const query = qs ? `?${qs}` : '';
  const url = `/billing/transactions${query}`;
  return apiRequest<PaginatedTransactions>(url);
};

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
