import { test, expect, type Page, type BrowserContext } from '@playwright/test';

let context: BrowserContext;
let page: Page;

test.describe.serial('Mobile Admin Navigation', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('admin@youboost.dev');
    await page.getByPlaceholder('Enter your password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/admin/, { timeout: 10_000 });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should show hamburger menu on mobile', async () => {
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  });

  test('should show admin nav items in mobile sheet', async () => {
    await page.getByRole('button', { name: 'Open navigation' }).click();

    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet).toBeVisible();

    await expect(sheet.getByText('Admin')).toBeVisible();

    await expect(sheet.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Users' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Orders' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Deposits' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Services' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Providers' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Support' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Coupons' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Tracking' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Documentation' })).toBeVisible();
  });

  test('should show Back to Panel footer link', async () => {
    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet.getByRole('link', { name: 'Back to Panel' })).toBeVisible();
  });

  test('should NOT show user-only nav items', async () => {
    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet.getByRole('link', { name: 'Catalog' })).not.toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Billing' })).not.toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Guide' })).not.toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Settings' })).not.toBeVisible();
  });

  test('should navigate to admin page via mobile nav', async () => {
    const sheet = page.locator('[data-slot="sheet-content"]');
    await sheet.getByRole('link', { name: 'Users' }).click();
    await page.waitForURL('/admin/users');
    await expect(sheet).not.toBeVisible();
  });

  test('should navigate to user panel via Back to Panel', async () => {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const sheet = page.locator('[data-slot="sheet-content"]');
    await sheet.getByRole('link', { name: 'Back to Panel' }).click();
    await page.waitForURL('/dashboard');
  });

  test('should show user nav items on dashboard', async () => {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const sheet = page.locator('[data-slot="sheet-content"]');

    await expect(sheet.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Catalog' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Orders' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Billing' })).toBeVisible();

    await expect(sheet.getByRole('link', { name: 'Users' })).not.toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Services' })).not.toBeVisible();

    await page.keyboard.press('Escape');
  });
});
