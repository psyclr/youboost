import { test, expect, type Page, type BrowserContext } from '@playwright/test';

let context: BrowserContext;
let page: Page;

test.describe.serial('Forgot Password Page', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/forgot-password');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should display all form elements', async () => {
    await expect(page.locator('[data-slot="card-title"]')).toHaveText('Forgot Password');
    await expect(page.getByText('Enter your email to receive a password reset link')).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Reset Link' })).toBeEnabled();
    await expect(page.getByRole('link', { name: 'Back to Sign In' })).toBeVisible();
  });

  test('should show validation error for invalid email', async () => {
    await page.locator('form').evaluate((f) => f.setAttribute('novalidate', ''));

    await page.getByPlaceholder('you@example.com').fill('not-an-email');
    await page.getByRole('button', { name: 'Send Reset Link' }).click();

    await expect(page.locator('[data-slot="form-message"]')).toContainText('Invalid email address');
  });

  test('should navigate back to login', async () => {
    await page.getByRole('link', { name: 'Back to Sign In' }).click();
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
    await page.goto('/forgot-password');
  });

  test('should submit and show success card', async () => {
    await page.getByPlaceholder('you@example.com').fill('admin@youboost.dev');
    await page.getByRole('button', { name: 'Send Reset Link' }).click();

    await expect(page.getByRole('button', { name: 'Sending...' })).toBeVisible();
    await expect(page.locator('[data-slot="card-title"]')).toHaveText('Check Your Email', {
      timeout: 10_000,
    });
    await expect(
      page.getByText("If an account exists with that email, you'll receive a reset link."),
    ).toBeVisible();
  });

  test('should have back to login link on success card', async () => {
    const link = page.getByRole('link', { name: 'Back to Sign In' });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });
});
