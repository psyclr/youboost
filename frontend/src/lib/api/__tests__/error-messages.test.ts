import { getErrorMessage, publicApiErrorMessage } from '../error-messages';
import { ApiError } from '../client';

describe('getErrorMessage', () => {
  it('should return the ApiError message verbatim', () => {
    const err = new ApiError('INSUFFICIENT_FUNDS', 'Insufficient funds', 402);
    expect(getErrorMessage(err, 'Fallback')).toBe('Insufficient funds');
  });

  it('should not rewrite payment-config codes (unlike publicApiErrorMessage)', () => {
    const err = new ApiError('STRIPE_NOT_CONFIGURED', 'Stripe is not configured', 503);
    expect(getErrorMessage(err, 'Fallback')).toBe('Stripe is not configured');
  });

  it('should return the fallback for non-ApiError values', () => {
    expect(getErrorMessage(new Error('boom'), 'Fallback')).toBe('Fallback');
    expect(getErrorMessage('boom', 'Fallback')).toBe('Fallback');
    expect(getErrorMessage(undefined, 'Fallback')).toBe('Fallback');
  });
});

describe('publicApiErrorMessage', () => {
  it('should mask payment-config codes with a public message', () => {
    const err = new ApiError('STRIPE_NOT_CONFIGURED', 'Stripe is not configured', 503);
    expect(publicApiErrorMessage(err, 'Fallback')).toBe(
      'Card payments are temporarily unavailable. Please try another payment method or contact support.',
    );
  });

  it('should pass through other ApiError messages', () => {
    const err = new ApiError('VALIDATION_ERROR', 'Amount too small', 400);
    expect(publicApiErrorMessage(err, 'Fallback')).toBe('Amount too small');
  });

  it('should return the fallback for non-ApiError values', () => {
    expect(publicApiErrorMessage(new Error('boom'), 'Fallback')).toBe('Fallback');
  });
});
