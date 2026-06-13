'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOrders,
  getOrder,
  createOrder,
  cancelOrder,
  refillOrder,
  createBulkOrders,
} from '@/lib/api/orders';
import type { CreateOrderInput, BulkOrderInput } from '@/lib/api/types';
import { queryKeys } from '@/lib/query-keys';

export function useOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
  serviceId?: string;
}) {
  return useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () => getOrders(params),
  });
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => getOrder(orderId),
    enabled: !!orderId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrderInput) => createOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balance });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balance });
    },
  });
}

export function useRefillOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => refillOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}

export function useBulkOrders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkOrderInput) => createBulkOrders(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balance });
    },
  });
}
