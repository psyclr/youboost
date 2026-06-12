/**
 * Centralized app route paths to avoid scattering string literals.
 */
export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  dashboard: '/dashboard',
  admin: '/admin',
} as const;

/**
 * OAuth error signalling shared between the Google callback page (which
 * redirects on failure) and the login page (which reads the param).
 *
 * The backend also redirects to `${webUrl}/login?error=google`, so these
 * VALUES must stay in sync with it — they are only named here, not changed.
 */
export const OAUTH_ERROR_QUERY_PARAM = 'error';
export const GOOGLE_OAUTH_ERROR = 'google';
