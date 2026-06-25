/**
 * Hierarchical React Query key factory.
 *
 * Every entry reproduces the exact array shape that used to be declared
 * inline at the call sites, so prefix-based `invalidateQueries` matching is
 * unchanged: invalidating `queryKeys.adminOrders.all` (`['admin', 'orders']`)
 * still matches `queryKeys.adminOrders.list(...)` (`['admin', 'orders', {...}]`),
 * and `queryKeys.tickets.all` (`['tickets']`) still matches both
 * `queryKeys.tickets.list(...)` and `queryKeys.tickets.detail(id)`.
 *
 * Filter objects are passed through verbatim — React Query hashes them
 * structurally, so the produced keys are hash-identical to the old inline
 * literals.
 */
export const queryKeys = {
  balance: ['balance'] as const,

  orders: {
    all: ['orders'] as const,
    list: (params?: { page?: number; limit?: number; status?: string; serviceId?: string }) =>
      ['orders', params] as const,
    detail: (orderId: string) => ['orders', orderId] as const,
  },

  catalog: {
    list: (params?: { page?: number; limit?: number; platform?: string; type?: string }) =>
      ['catalog', params] as const,
    service: (serviceId: string) => ['catalog', serviceId] as const,
    /** Full catalog snapshot used by the admin landing editors. */
    allServices: ['catalog', 'services', 'all'] as const,
  },

  tickets: {
    all: ['tickets'] as const,
    list: (filters: { page: number; status: string }) => ['tickets', filters] as const,
    detail: (id: string) => ['tickets', id] as const,
  },

  transactions: {
    list: (filters: { page?: number; limit?: number; type?: string }) =>
      ['transactions', filters] as const,
  },

  referralStats: ['referral-stats'] as const,

  providers: ['providers'] as const,

  providerServices: (providerId: string | undefined) => ['provider-services', providerId] as const,

  adminDashboard: ['admin', 'dashboard'] as const,

  adminOrders: {
    all: ['admin', 'orders'] as const,
    list: (filters: { page: number; status: string; dripFeedOnly: boolean }) =>
      ['admin', 'orders', filters] as const,
  },

  adminUsers: {
    list: (filters: { page: number; role: string; status: string }) =>
      ['admin', 'users', filters] as const,
    detail: (id: string) => ['admin', 'users', id] as const,
  },

  adminServices: {
    all: ['admin', 'services'] as const,
    list: (filters: { page: number }) => ['admin', 'services', filters] as const,
  },

  adminServicePanels: (serviceId: string) => ['admin', 'services', serviceId, 'panels'] as const,

  adminProviders: {
    all: ['admin', 'providers'] as const,
    list: (filters: { page: number }) => ['admin', 'providers', filters] as const,
  },

  adminCoupons: {
    all: ['admin', 'coupons'] as const,
    list: (filters: { page: number }) => ['admin', 'coupons', filters] as const,
  },

  adminLandings: {
    all: ['admin', 'landings'] as const,
    list: (filters: { page: number; limit: number; status: string }) =>
      ['admin', 'landings', filters] as const,
    detail: (landingId: string) => ['admin', 'landings', landingId] as const,
    analytics: (landingId: string) => ['admin', 'landings', landingId, 'analytics'] as const,
  },

  adminSupportTickets: {
    all: ['admin', 'support', 'tickets'] as const,
    list: (filters: { page: number; status: string }) =>
      ['admin', 'support', 'tickets', filters] as const,
    detail: (id: string) => ['admin', 'support', 'tickets', id] as const,
  },

  adminDeposits: {
    all: ['admin-deposits'] as const,
    list: (page: number, status: string) => ['admin-deposits', page, status] as const,
  },

  adminTrackingLinks: ['admin', 'tracking-links'] as const,
} as const;
