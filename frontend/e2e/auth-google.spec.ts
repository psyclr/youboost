import { test, expect } from '@playwright/test';

test.describe('Google auth UI', () => {
  test('login page shows a Continue with Google button linking to /api/auth/google', async ({
    page,
  }) => {
    await page.goto('/login');
    const link = page.getByRole('link', { name: /google/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/api/auth/google');
  });

  test('?error=google renders an inline error', async ({ page }) => {
    await page.goto('/login?error=google');
    await expect(page.getByText(/google sign-in failed/i)).toBeVisible();
  });

  test('callback page consumes a token fragment and authenticates', async ({ page }) => {
    // Mock the profile fetch the callback triggers via setSession -> getMe.
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'u1',
          email: 'g@x.com',
          username: 'g',
          role: 'USER',
          emailVerified: true,
          createdAt: new Date().toISOString(),
        }),
      }),
    );
    await page.goto('/auth/google/callback#accessToken=AT&refreshToken=RT');
    await page.waitForURL('**/dashboard');
    expect(await page.evaluate(() => localStorage.getItem('youboost_refresh_token'))).toBe('RT');
  });

  test('callback without tokens redirects to login error', async ({ page }) => {
    await page.goto('/auth/google/callback');
    await page.waitForURL('**/login?error=google');
    await expect(page.getByText(/google sign-in failed/i)).toBeVisible();
  });
});
