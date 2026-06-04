import { stripeEncodeMetadata, stripeDecodeReference } from '../stripe.reference';

describe('stripe payment reference', () => {
  it('encodes order-payment into metadata', () => {
    expect(stripeEncodeMetadata({ kind: 'order-payment', paymentId: 'p1', userId: 'u1' })).toEqual({
      kind: 'order-payment',
      paymentId: 'p1',
      userId: 'u1',
    });
  });
  it('encodes deposit into metadata', () => {
    expect(stripeEncodeMetadata({ kind: 'deposit', depositId: 'd1', userId: 'u1' })).toEqual({
      kind: 'deposit',
      depositId: 'd1',
      userId: 'u1',
    });
  });
  it('decodes deposit metadata (back-compat)', () => {
    expect(stripeDecodeReference({ kind: 'deposit', depositId: 'd1', userId: 'u1' })).toEqual({
      kind: 'deposit',
      depositId: 'd1',
      userId: 'u1',
    });
  });
  it('decodes legacy deposit metadata without kind (depositId present)', () => {
    expect(stripeDecodeReference({ depositId: 'd1', userId: 'u1' })).toEqual({
      kind: 'deposit',
      depositId: 'd1',
      userId: 'u1',
    });
  });
  it('decodes order-payment metadata', () => {
    expect(stripeDecodeReference({ kind: 'order-payment', paymentId: 'p1', userId: 'u1' })).toEqual(
      { kind: 'order-payment', paymentId: 'p1', userId: 'u1' },
    );
  });
  it('returns null for unrelated metadata', () => {
    expect(stripeDecodeReference({ foo: 'bar' })).toBeNull();
    expect(stripeDecodeReference(null)).toBeNull();
    expect(stripeDecodeReference(undefined)).toBeNull();
  });
});
