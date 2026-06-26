import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const testId = Date.now();
const TEST_EMAIL = `e2e_${testId}@test.com`;

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

  const email = () => page.getByPlaceholder('Enter your login / email');
  const password = () => page.getByPlaceholder('Enter password');
  const submit = () => page.getByRole('button', { name: 'Registration' });

  test('should display the sign-up form', async () => {
    await expect(page.getByRole('heading', { name: 'Seconds to sign up!' })).toBeVisible();
    await expect(email()).toBeVisible();
    await expect(password()).toBeVisible();
    await expect(submit()).toBeEnabled();
    await expect(page.getByRole('link', { name: 'Do you already have an account?' })).toBeVisible();
  });

  test('shows a validation error for an invalid email', async () => {
    await page.locator('form').evaluate((f) => f.setAttribute('novalidate', ''));
    await email().fill('bad-email');
    await password().fill('ValidPass1');
    await submit().click();
    await expect(page.locator('[data-slot="form-message"]').first()).toContainText(
      'Invalid email address',
    );
  });

  test('shows validation errors for a weak password', async () => {
    const pwdError = page
      .locator('[data-slot="form-item"]')
      .filter({ has: password() })
      .locator('[data-slot="form-message"]');

    await email().fill('a@b.com');
    await password().fill('short');
    await submit().click();
    await expect(pwdError).toContainText('At least 8 characters');

    await password().fill('abcdefg1');
    await submit().click();
    await expect(pwdError).toContainText('Must contain an uppercase letter');

    await password().fill('Abcdefgh');
    await submit().click();
    await expect(pwdError).toContainText('Must contain a digit');
  });

  test('navigates to login', async () => {
    await page.goto('/register');
    await page.getByRole('link', { name: 'Do you already have an account?' }).click();
    await page.waitForURL('/login');
  });

  test('registers with email + password and redirects to login', async () => {
    await page.goto('/register');
    await email().fill(TEST_EMAIL);
    await password().fill('TestPass1');
    await submit().click();
    await page.waitForURL('/login', { timeout: 10_000 });
  });

  test('shows an error for a duplicate email', async () => {
    await page.goto('/register');
    await email().fill(TEST_EMAIL);
    await password().fill('TestPass1');
    await submit().click();
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL('/register');
  });
});
