/** Derive a username candidate from an email local part: [a-z0-9_], max 24 chars. */
export function sanitizeUsername(email: string): string {
  const base = (email.split('@')[0] ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  return (base || 'user').slice(0, 24);
}

/** Find a free username by suffixing the sanitized base; timestamp as last resort. */
export async function uniqueUsername(
  email: string,
  isTaken: (username: string) => Promise<boolean>,
): Promise<string> {
  const base = sanitizeUsername(email);
  if (!(await isTaken(base))) return base;
  for (let i = 1; i < 100; i++) {
    const candidate = `${base}${i}`.slice(0, 30);
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base}${Date.now()}`.slice(0, 30);
}
