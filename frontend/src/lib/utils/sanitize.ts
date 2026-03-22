/**
 * Sanitize user input to prevent XSS attacks
 * Strips HTML tags and dangerous characters from strings
 */
export function sanitizeInput(str: string | undefined | null): string {
  if (!str) return '';

  // Remove HTML tags
  let sanitized = str.replace(/<[^>]*>/g, '');

  // Remove script tags more aggressively (case insensitive)
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove on* event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Trim whitespace
  return sanitized.trim();
}

/**
 * Sanitize multiple inputs at once
 */
export function sanitizeInputs<T extends Record<string, any>>(data: T): T {
  const sanitized = { ...data };

  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeInput(sanitized[key]) as T[typeof key];
    }
  }

  return sanitized;
}
