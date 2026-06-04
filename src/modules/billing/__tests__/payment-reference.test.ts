import { encodeRef, decodeRef, type PaymentReference } from '../payment-reference';

describe('payment reference codec (string form for Cryptomus order_id)', () => {
  it('round-trips a deposit reference', () => {
    const ref: PaymentReference = { kind: 'deposit', depositId: 'd1', userId: 'u1' };
    expect(decodeRef(encodeRef(ref))).toEqual(ref);
  });
  it('round-trips an order-payment reference', () => {
    const ref: PaymentReference = { kind: 'order-payment', paymentId: 'p1', userId: 'u1' };
    expect(encodeRef(ref)).toBe('pay:p1:u1');
    expect(decodeRef('pay:p1:u1')).toEqual(ref);
  });
  it('encodes deposit as dep:<id>:<user>', () => {
    expect(encodeRef({ kind: 'deposit', depositId: 'd1', userId: 'u1' })).toBe('dep:d1:u1');
  });
  it('returns null for unknown/garbage strings', () => {
    expect(decodeRef('whatever')).toBeNull();
    expect(decodeRef('')).toBeNull();
    expect(decodeRef('pay:only')).toBeNull();
  });
});
