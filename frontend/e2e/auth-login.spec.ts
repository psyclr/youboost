import { test, expect, type Page, type BrowserContext } from '@playwright/test';

let context: BrowserContext;
let page: Page;

test.describe.serial('Login Page', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/login');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should display all form elements', async () => {
    await expect(page.locator('[data-slot="card-title"]')).toHaveText('Sign In');
    await expect(page.getByText('Enter your credentials to access your account')).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeEnabled();
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
  });

  test('should show validation error for invalid email', async () => {
    // Disable native HTML5 validation so Zod schema validates instead
    await page.locator('form').evaluate((f) => f.setAttribute('novalidate', ''));

    await page.getByPlaceholder('you@example.com').fill('not-an-email');
    await page.getByPlaceholder('Enter your password').fill('something');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.locator('[data-slot="form-message"]')).toContainText('Invalid email address');
  });

  test('should show validation error when password is empty', async () => {
    await page.getByPlaceholder('you@example.com').fill('valid@example.com');
    await page.getByPlaceholder('Enter your password').fill('');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.locator('[data-slot="form-message"]')).toContainText('Password is required');
  });

  test('should navigate to register page', async () => {
    await page.getByRole('link', { name: 'Sign up' }).click();
    await page.waitForURL('/register');
    await expect(page).toHaveURL('/register');
    await page.goto('/login');
  });

  test('should navigate to forgot password page', async () => {
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await page.waitForURL('/forgot-password');
    await expect(page).toHaveURL('/forgot-password');
    await page.goto('/login');
  });

  test('should show error for invalid credentials', async () => {
    await page.getByPlaceholder('you@example.com').fill('wrong@example.com');
    await page.getByPlaceholder('Enter your password').fill('WrongPass1');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByRole('button', { name: 'Signing in...' })).toBeVisible();

    const errorBox = page.locator('div.rounded-md.text-destructive');
    await expect(errorBox).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL('/login');
  });

  test('should login successfully and redirect to admin', async () => {
    await page.getByPlaceholder('you@example.com').fill('admin@youboost.dev');
    await page.getByPlaceholder('Enter your password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL(/\/admin/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/admin/);
  });
});
