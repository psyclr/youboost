/**
 * Sanitize user input to prevent XSS attacks
 * Strips HTML tags and dangerous characters from strings
 */
export function sanitizeInput(str: string | undefined | null): string {
  if (!str) return '';

  // Remove HTML tags
  let sanitized = str.replaceAll(/<[^>]*>/g, '');

  // Remove script tags more aggressively (case insensitive)
  sanitized = sanitized.replaceAll(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove on* event handlers
  sanitized = sanitized.replaceAll(/on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Trim whitespace
  return sanitized.trim();
}
