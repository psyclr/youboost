import { createCipheriv, randomBytes } from 'node:crypto';
import { createEncryptionService } from '../encryption';

const TEST_KEY = 'test-encryption-key-at-least-32-chars!';

function makeService(): ReturnType<typeof createEncryptionService> {
  return createEncryptionService({ encryptionKey: TEST_KEY });
}

describe('Encryption Utility', () => {
  it('encrypts and decrypts a string roundtrip', () => {
    const svc = makeService();
    const plaintext = 'my-secret-api-key-12345';
    const encrypted = svc.encryptApiKey(plaintext);
    const decrypted = svc.decryptApiKey(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const svc = makeService();
    const plaintext = 'same-key';
    const encrypted1 = svc.encryptApiKey(plaintext);
    const encrypted2 = svc.encryptApiKey(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('writes v2: prefix and iv:authTag:ciphertext in hex', () => {
    const svc = makeService();
    const encrypted = svc.encryptApiKey('test');
    expect(encrypted.startsWith('v2:')).toBe(true);
    const parts = encrypted.slice(3).split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]{24}$/);
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
    expect((parts[2] ?? '').length).toBeGreaterThan(0);
  });

  it('handles empty string', () => {
    const svc = makeService();
    const encrypted = svc.encryptApiKey('');
    const decrypted = svc.decryptApiKey(encrypted);
    expect(decrypted).toBe('');
  });

  it('handles long strings', () => {
    const svc = makeService();
    const plaintext = 'a'.repeat(1000);
    const encrypted = svc.encryptApiKey(plaintext);
    const decrypted = svc.decryptApiKey(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('handles unicode strings', () => {
    const svc = makeService();
    const plaintext = 'ключ-апи-🔑';
    const encrypted = svc.encryptApiKey(plaintext);
    const decrypted = svc.decryptApiKey(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('throws on invalid format', () => {
    const svc = makeService();
    expect(() => svc.decryptApiKey('invalid-data')).toThrow('Invalid encrypted data format');
  });

  it('throws on tampered ciphertext', () => {
    const svc = makeService();
    const encrypted = svc.encryptApiKey('secret');
    // v2:iv:authTag:cipher — tamper the cipher part
    const parts = encrypted.slice(3).split(':');
    const tampered = `v2:${parts[0]}:${parts[1]}:ff${(parts[2] ?? '').slice(2)}`;
    expect(() => svc.decryptApiKey(tampered)).toThrow();
  });

  it('decrypts legacy (pre-v2) ciphertext written with padEnd key derivation', () => {
    const svc = makeService();
    // Simulate the old encryption scheme: key.slice(0, 32).padEnd(32, '0')
    const legacyKey = Buffer.from(TEST_KEY.slice(0, 32).padEnd(32, '0'));
    const plaintext = 'legacy-provider-key-xyz';
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', legacyKey, iv, { authTagLength: 16 });
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const legacyCiphertext = `${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;

    expect(svc.decryptApiKey(legacyCiphertext)).toBe(plaintext);
  });

  it('uses the configured encryption key (different keys produce incompatible ciphertexts)', () => {
    const svcA = createEncryptionService({ encryptionKey: 'key-A-at-least-32-chars-long!!!' });
    const svcB = createEncryptionService({ encryptionKey: 'key-B-at-least-32-chars-long!!!' });
    const encrypted = svcA.encryptApiKey('secret');
    expect(() => svcB.decryptApiKey(encrypted)).toThrow();
  });
});
