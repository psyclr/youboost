import { queryKeys } from '../query-keys';

/**
 * The factory must reproduce the exact array shapes that used to be inlined
 * at call sites, so React Query prefix-matching invalidation keeps working.
 */
describe('queryKeys', () => {
  it('should produce the legacy array shapes', () => {
    expect(queryKeys.balance).toEqual(['balance']);
    expect(queryKeys.orders.all).toEqual(['orders']);
    expect(queryKeys.orders.list({ page: 1 })).toEqual(['orders', { page: 1 }]);
    expect(queryKeys.orders.detail('o1')).toEqual(['orders', 'o1']);
    expect(queryKeys.catalog.list(undefined)).toEqual(['catalog', undefined]);
    expect(queryKeys.catalog.service('s1')).toEqual(['catalog', 's1']);
    expect(queryKeys.catalog.allServices).toEqual(['catalog', 'services', 'all']);
    expect(queryKeys.tickets.all).toEqual(['tickets']);
    expect(queryKeys.tickets.list({ page: 1, status: 'ALL' })).toEqual([
      'tickets',
      { page: 1, status: 'ALL' },
    ]);
    expect(queryKeys.tickets.detail('t1')).toEqual(['tickets', 't1']);
    expect(queryKeys.transactions.list({ limit: 5 })).toEqual(['transactions', { limit: 5 }]);
    expect(queryKeys.referralStats).toEqual(['referral-stats']);
    expect(queryKeys.providers).toEqual(['providers']);
    expect(queryKeys.providerServices('p1')).toEqual(['provider-services', 'p1']);
    expect(queryKeys.adminDashboard).toEqual(['admin', 'dashboard']);
    expect(queryKeys.adminOrders.all).toEqual(['admin', 'orders']);
    expect(queryKeys.adminDeposits.list(2, 'ALL')).toEqual(['admin-deposits', 2, 'ALL']);
    expect(queryKeys.adminDeposits.all).toEqual(['admin-deposits']);
    expect(queryKeys.adminLandings.analytics('l1')).toEqual([
      'admin',
      'landings',
      'l1',
      'analytics',
    ]);
    expect(queryKeys.adminSupportTickets.detail('t1')).toEqual([
      'admin',
      'support',
      'tickets',
      't1',
    ]);
    expect(queryKeys.adminTrackingLinks).toEqual(['admin', 'tracking-links']);
  });

  it('should keep list/detail keys as prefix-extensions of their `all` key', () => {
    const pairs: ReadonlyArray<[ReadonlyArray<unknown>, ReadonlyArray<unknown>]> = [
      [
        queryKeys.adminOrders.all,
        queryKeys.adminOrders.list({ page: 1, status: 'ALL', dripFeedOnly: false }),
      ],
      [queryKeys.adminServices.all, queryKeys.adminServices.list({ page: 1 })],
      [queryKeys.adminProviders.all, queryKeys.adminProviders.list({ page: 1 })],
      [queryKeys.adminCoupons.all, queryKeys.adminCoupons.list({ page: 1 })],
      [queryKeys.adminLandings.all, queryKeys.adminLandings.detail('l1')],
      [
        queryKeys.adminSupportTickets.all,
        queryKeys.adminSupportTickets.list({ page: 1, status: 'ALL' }),
      ],
      [queryKeys.tickets.all, queryKeys.tickets.detail('t1')],
      [queryKeys.orders.all, queryKeys.orders.detail('o1')],
      [queryKeys.adminDeposits.all, queryKeys.adminDeposits.list(1, 'ALL')],
    ];
    for (const [all, child] of pairs) {
      expect(child.slice(0, all.length)).toEqual([...all]);
    }
  });
});
