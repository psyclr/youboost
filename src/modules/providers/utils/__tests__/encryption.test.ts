import { encryptApiKey, decryptApiKey } from '../encryption';

jest.mock('../../../../shared/config', () => ({
  getConfig: jest.fn().mockReturnValue({
    provider: {
      encryptionKey: 'test-encryption-key-at-least-32-chars!',
      mode: 'stub',
    },
  }),
}));

describe('Encryption Utility', () => {
  it('should encrypt and decrypt a string roundtrip', () => {
    const plaintext = 'my-secret-api-key-12345';
    const encrypted = encryptApiKey(plaintext);
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for same plaintext (random IV)', () => {
    const plaintext = 'same-key';
    const encrypted1 = encryptApiKey(plaintext);
    const encrypted2 = encryptApiKey(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should return format iv:authTag:ciphertext in hex', () => {
    const encrypted = encryptApiKey('test');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]{24}$/);
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
    expect((parts[2] ?? '').length).toBeGreaterThan(0);
  });

  it('should handle empty string', () => {
    const encrypted = encryptApiKey('');
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe('');
  });

  it('should handle long strings', () => {
    const plaintext = 'a'.repeat(1000);
    const encrypted = encryptApiKey(plaintext);
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should handle unicode strings', () => {
    const plaintext = 'ключ-апи-🔑';
    const encrypted = encryptApiKey(plaintext);
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should throw on invalid format', () => {
    expect(() => decryptApiKey('invalid-data')).toThrow('Invalid encrypted data format');
  });

  it('should throw on tampered ciphertext', () => {
    const encrypted = encryptApiKey('secret');
    const parts = encrypted.split(':');
    const tampered = `${parts[0]}:${parts[1]}:ff${(parts[2] ?? '').slice(2)}`;
    expect(() => decryptApiKey(tampered)).toThrow();
  });
});
