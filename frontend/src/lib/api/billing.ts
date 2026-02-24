import { apiRequest } from './client';
import type {
  BalanceResponse,
  DepositInput,
  DepositResponse,
  DepositDetail,
  PaginatedDeposits,
  PaginatedTransactions,
  TransactionDetailed,
} from './types';

export const getBalance = () => apiRequest<BalanceResponse>('/billing/balance');

export const createDeposit = (data: DepositInput) =>
  apiRequest<DepositResponse>('/billing/deposit', {
    method: 'POST',
    body: JSON.stringify({ ...data, currency: 'USD', paymentMethod: 'crypto' }),
  });

export const confirmDeposit = (depositId: string, txHash: string) =>
  apiRequest<DepositDetail>(`/billing/deposits/${depositId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ txHash }),
  });

export const getDeposits = (params?: { page?: number; limit?: number; status?: string }) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.status) searchParams.set('status', params.status);
  const qs = searchParams.toString();
  return apiRequest<PaginatedDeposits>(`/billing/deposits${qs ? `?${qs}` : ''}`);
};

export const getTransactions = (params?: { page?: number; limit?: number; type?: string }) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.type) searchParams.set('type', params.type);
  const qs = searchParams.toString();
  return apiRequest<PaginatedTransactions>(`/billing/transactions${qs ? `?${qs}` : ''}`);
};

export const getTransaction = (id: string) =>
  apiRequest<TransactionDetailed>(`/billing/transactions/${id}`);
