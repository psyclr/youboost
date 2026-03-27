import { test, expect, type Page, type BrowserContext } from '@playwright/test';

let context: BrowserContext;
let page: Page;

test.describe.serial('Reset Password Page — invalid states', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should show Invalid Link when no token provided', async () => {
    await page.goto('/reset-password');
    await expect(page.locator('[data-slot="card-title"]')).toHaveText('Invalid Link');
    await expect(
      page.getByText('This password reset link is invalid or has expired.'),
    ).toBeVisible();
  });

  test('should have Request a new link on invalid page', async () => {
    const link = page.getByRole('link', { name: 'Request a new link' });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL('/forgot-password');
    await expect(page).toHaveURL('/forgot-password');
  });

  test('should show Invalid Link for invalid token', async () => {
    await page.goto('/reset-password?token=invalid_token_12345');
    await expect(page.locator('[data-slot="card-title"]')).toHaveText('Invalid Link', {
      timeout: 10_000,
    });
    await expect(
      page.getByText('This password reset link is invalid or has expired.'),
    ).toBeVisible();
  });

  test('should have Request a new link after invalid token', async () => {
    const link = page.getByRole('link', { name: 'Request a new link' });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL('/forgot-password');
    await expect(page).toHaveURL('/forgot-password');
  });
});

test.describe.serial('Reset Password Page — valid token (mocked)', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Mock verify-reset-token to return valid
    await page.route('**/api/auth/verify-reset-token', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }),
    );
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should display reset form with valid token', async () => {
    await page.goto('/reset-password?token=mocked_valid_token');
    await expect(page.locator('[data-slot="card-title"]')).toHaveText('Reset Password');
    await expect(page.getByText('Enter your new password')).toBeVisible();
    await expect(page.getByPlaceholder('Enter new password')).toBeVisible();
    await expect(page.getByPlaceholder('Confirm new password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset Password' })).toBeEnabled();
    await expect(page.getByRole('link', { name: 'Back to Sign In' })).toBeVisible();
  });

  test('should show validation error for short password', async () => {
    await page.getByPlaceholder('Enter new password').fill('short');
    await page.getByPlaceholder('Confirm new password').fill('short');
    await page.getByRole('button', { name: 'Reset Password' }).click();

    await expect(page.locator('[data-slot="form-message"]').first()).toContainText(
      'At least 8 characters',
    );
  });

  test('should show validation error for missing uppercase', async () => {
    await page.getByPlaceholder('Enter new password').fill('abcdefg1');
    await page.getByPlaceholder('Confirm new password').fill('abcdefg1');
    await page.getByRole('button', { name: 'Reset Password' }).click();

    await expect(page.locator('[data-slot="form-message"]').first()).toContainText(
      'Must contain an uppercase letter',
    );
  });

  test('should show validation error for missing digit', async () => {
    await page.getByPlaceholder('Enter new password').fill('Abcdefgh');
    await page.getByPlaceholder('Confirm new password').fill('Abcdefgh');
    await page.getByRole('button', { name: 'Reset Password' }).click();

    await expect(page.locator('[data-slot="form-message"]').first()).toContainText(
      'Must contain a digit',
    );
  });

  test('should show validation error for password mismatch', async () => {
    await page.getByPlaceholder('Enter new password').fill('ValidPass1');
    await page.getByPlaceholder('Confirm new password').fill('DifferentPass1');
    await page.getByRole('button', { name: 'Reset Password' }).click();

    await expect(page.locator('[data-slot="form-message"]')).toContainText(
      'Passwords do not match',
    );
  });

  test('should reset password successfully and show success card', async () => {
    // Mock reset-password endpoint
    await page.route('**/api/auth/reset-password', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }),
    );

    await page.getByPlaceholder('Enter new password').fill('NewValidPass1');
    await page.getByPlaceholder('Confirm new password').fill('NewValidPass1');
    await page.getByRole('button', { name: 'Reset Password' }).click();

    await expect(page.locator('[data-slot="card-title"]')).toHaveText('Password Reset', {
      timeout: 10_000,
    });
    await expect(page.getByText('Your password has been reset successfully.')).toBeVisible();
  });

  test('should have Sign In link on success card', async () => {
    const link = page.getByRole('link', { name: 'Sign In' });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });
});
