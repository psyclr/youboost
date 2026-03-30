import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const testId = Date.now();
const TEST_EMAIL = `e2e_${testId}@test.com`;
const TEST_USERNAME = `e2e_u${testId}`;

let context: BrowserContext;
let page: Page;

test.describe.serial('Registration Page', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/register');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should display all form elements', async () => {
    await expect(page.locator('[data-slot="card-title"]')).toHaveText('Create Account');
    await expect(page.getByText('Sign up to start using youboost services')).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('your_username')).toBeVisible();
    await expect(page.getByPlaceholder('Create a strong password')).toBeVisible();
    await expect(page.getByPlaceholder('Enter referral code')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeEnabled();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('should show validation error for invalid email', async () => {
    // Disable native HTML5 validation so Zod schema validates instead
    await page.locator('form').evaluate((f) => f.setAttribute('novalidate', ''));

    await page.getByPlaceholder('you@example.com').fill('bad-email');
    await page.getByPlaceholder('your_username').fill('validuser');
    await page.getByPlaceholder('Create a strong password').fill('ValidPass1');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.locator('[data-slot="form-message"]').first()).toContainText(
      'Invalid email address',
    );
  });

  test('should show validation error for short username', async () => {
    await page.getByPlaceholder('you@example.com').fill('a@b.com');
    await page.getByPlaceholder('your_username').fill('ab');
    await page.getByPlaceholder('Create a strong password').fill('ValidPass1');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.locator('[data-slot="form-message"]').first()).toContainText(
      'at least 3 characters',
    );
  });

  test('should show validation error for invalid username characters', async () => {
    await page.getByPlaceholder('your_username').fill('user name!');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.locator('[data-slot="form-message"]').first()).toContainText(
      'Only letters, numbers, and underscores',
    );
  });

  test('should show validation errors for weak password', async () => {
    const passwordInput = page.getByPlaceholder('Create a strong password');
    const submitBtn = page.getByRole('button', { name: 'Create Account' });
    const passwordError = page
      .locator('[data-slot="form-item"]')
      .filter({ has: passwordInput })
      .locator('[data-slot="form-message"]');

    // Too short
    await page.getByPlaceholder('you@example.com').fill('a@b.com');
    await page.getByPlaceholder('your_username').fill('validuser');
    await passwordInput.fill('short');
    await submitBtn.click();
    await expect(passwordError).toContainText('At least 8 characters');

    // No uppercase
    await passwordInput.fill('abcdefg1');
    await submitBtn.click();
    await expect(passwordError).toContainText('Must contain an uppercase letter');

    // No digit
    await passwordInput.fill('Abcdefgh');
    await submitBtn.click();
    await expect(passwordError).toContainText('Must contain a digit');
  });

  test('should pre-fill referral code from query parameter', async () => {
    await page.goto('/register?ref=TESTCODE123');
    await expect(page.getByPlaceholder('Enter referral code')).toHaveValue('TESTCODE123');
  });

  test('should navigate to login page', async () => {
    await page.goto('/register');
    await page.getByRole('link', { name: 'Sign in' }).click();
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });

  test('should register successfully and redirect to login', async () => {
    await page.goto('/register');
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('your_username').fill(TEST_USERNAME);
    await page.getByPlaceholder('Create a strong password').fill('TestPass1');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByRole('button', { name: 'Creating account…' })).toBeVisible();
    await page.waitForURL('/login', { timeout: 10_000 });
    await expect(page).toHaveURL('/login');
  });

  test('should show error for duplicate email/username', async () => {
    await page.goto('/register');
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('your_username').fill(TEST_USERNAME);
    await page.getByPlaceholder('Create a strong password').fill('TestPass1');
    await page.getByRole('button', { name: 'Create Account' }).click();

    const errorBox = page.locator('div.rounded-md.text-destructive');
    await expect(errorBox).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL('/register');
  });
});
