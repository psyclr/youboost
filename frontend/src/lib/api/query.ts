/**
 * Builds a URL query string from a flat params object.
 *
 * Entries whose value is `undefined` or an empty string are omitted, so call
 * sites that want to skip other falsy values (e.g. `page: 0`) must map them to
 * `undefined` themselves (`page: params?.page || undefined`). Booleans are
 * serialized as `'true'`/`'false'` — `false` is NOT skipped.
 *
 * Returns `''` when nothing remains, otherwise `'?key=value&...'`.
 */
export function buildQuery(
  params?: Record<string, string | number | boolean | undefined>,
): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    searchParams.set(key, String(value));
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}
