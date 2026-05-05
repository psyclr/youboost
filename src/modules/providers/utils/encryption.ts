import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { getConfig } from '../../../shared/config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KDF_SALT = 'provider-enc';
const V2_PREFIX = 'v2:';

function deriveKeyV2(): Buffer {
  return scryptSync(getConfig().provider.encryptionKey, KDF_SALT, 32);
}

// Legacy key derivation for v1 ciphertexts (padEnd / slice).
// Retained so existing encrypted rows written before the scrypt migration
// can still be decrypted. Every encrypt call now writes v2 format, so
// this branch drains out naturally as rows get rewritten.
function deriveKeyLegacy(): Buffer {
  const key = getConfig().provider.encryptionKey;
  return Buffer.from(key.slice(0, 32).padEnd(32, '0'));
}

export function encryptApiKey(plaintext: string): string {
  const key = deriveKeyV2();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${V2_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptApiKey(encrypted: string): string {
  const isV2 = encrypted.startsWith(V2_PREFIX);
  const payload = isV2 ? encrypted.slice(V2_PREFIX.length) : encrypted;
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const ivHex = parts[0] ?? '';
  const authTagHex = parts[1] ?? '';
  const ciphertextHex = parts[2] ?? '';
  const key = isV2 ? deriveKeyV2() : deriveKeyLegacy();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
