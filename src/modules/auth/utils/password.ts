import bcrypt from 'bcryptjs';
import { getConfig } from '../../../shared/config';

export async function hashPassword(plain: string): Promise<string> {
  const config = getConfig();
  return bcrypt.hash(plain, config.security.bcryptRounds);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
