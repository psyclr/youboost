import { customerOrderStatus } from '../customer-status';

describe('customerOrderStatus', () => {
  it('shows Completed only for completed orders', () => {
    expect(customerOrderStatus('COMPLETED').label).toBe('Completed');
  });

  it('shows Cancelled / Refunded verbatim (customer-meaningful outcomes)', () => {
    expect(customerOrderStatus('CANCELLED').label).toBe('Cancelled');
    expect(customerOrderStatus('REFUNDED').label).toBe('Refunded');
  });

  it.each(['PENDING', 'PENDING_PAYMENT', 'PROCESSING', 'PARTIAL', 'FAILED'])(
    'hides the internal state %s behind "In progress"',
    (status) => {
      expect(customerOrderStatus(status).label).toBe('In progress');
    },
  );

  it('never leaks the raw FAILED status to the customer', () => {
    expect(customerOrderStatus('FAILED').label).not.toMatch(/fail/i);
  });

  it('always returns a non-empty badge className', () => {
    for (const s of ['COMPLETED', 'FAILED', 'PROCESSING', 'CANCELLED', 'REFUNDED']) {
      expect(customerOrderStatus(s).className.length).toBeGreaterThan(0);
    }
  });
});
