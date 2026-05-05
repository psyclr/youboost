import { signRequestBody, verifyWebhookSignature, extractSignFromBody } from '../cryptomus.crypto';

describe('cryptomus.crypto', () => {
  const paymentKey = 'test-payment-key-abc123';

  describe('signRequestBody', () => {
    it('returns a 32-char lowercase hex MD5 digest', () => {
      const sig = signRequestBody('{"amount":"10.00"}', paymentKey);
      expect(sig).toMatch(/^[\da-f]{32}$/);
    });

    it('produces different signatures for different bodies', () => {
      const a = signRequestBody('{"amount":"10.00"}', paymentKey);
      const b = signRequestBody('{"amount":"20.00"}', paymentKey);
      expect(a).not.toBe(b);
    });

    it('produces different signatures for different keys', () => {
      const body = '{"amount":"10.00"}';
      expect(signRequestBody(body, 'keyA')).not.toBe(signRequestBody(body, 'keyB'));
    });
  });

  describe('extractSignFromBody', () => {
    it('extracts sign and returns rest as JSON', () => {
      const raw = '{"a":1,"sign":"xyz","b":2}';
      const { signature, unsignedJson } = extractSignFromBody(raw);
      expect(signature).toBe('xyz');
      expect(JSON.parse(unsignedJson)).toEqual({ a: 1, b: 2 });
    });

    it('returns null signature when sign field absent', () => {
      const { signature } = extractSignFromBody('{"a":1}');
      expect(signature).toBeNull();
    });
  });

  describe('verifyWebhookSignature', () => {
    it('verifies a body signed with the same algorithm', () => {
      const unsigned = { order_id: 'deposit-1', status: 'paid', amount: '25.00' };
      const unsignedJson = JSON.stringify(unsigned);
      const sign = signRequestBody(unsignedJson, paymentKey);
      const webhookBody = JSON.stringify({ ...unsigned, sign });
      expect(verifyWebhookSignature(webhookBody, paymentKey)).toBe(true);
    });

    it('rejects a tampered body', () => {
      const unsigned = { order_id: 'deposit-1', status: 'paid', amount: '25.00' };
      const sign = signRequestBody(JSON.stringify(unsigned), paymentKey);
      const tampered = JSON.stringify({ ...unsigned, amount: '9999.00', sign });
      expect(verifyWebhookSignature(tampered, paymentKey)).toBe(false);
    });

    it('rejects a body signed with a different key', () => {
      const unsigned = { order_id: 'deposit-1', status: 'paid' };
      const sign = signRequestBody(JSON.stringify(unsigned), 'wrong-key');
      const body = JSON.stringify({ ...unsigned, sign });
      expect(verifyWebhookSignature(body, paymentKey)).toBe(false);
    });

    it('rejects a body without a sign field', () => {
      const body = JSON.stringify({ order_id: 'deposit-1', status: 'paid' });
      expect(verifyWebhookSignature(body, paymentKey)).toBe(false);
    });
  });
});
