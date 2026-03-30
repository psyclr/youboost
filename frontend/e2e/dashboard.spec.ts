import { test, expect, type Page, type BrowserContext } from '@playwright/test';

let context: BrowserContext;
let page: Page;

test.describe.serial('Dashboard Page', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Login as admin
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('admin@youboost.dev');
    await page.getByPlaceholder('Enter your password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/admin/, { timeout: 10_000 });

    await page.goto('/dashboard');
    await page.waitForURL('/dashboard');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should display page heading', async () => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Welcome back to your panel')).toBeVisible();
  });

  test('should display sidebar navigation links', async () => {
    const nav = page.locator('nav');
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Catalog' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Orders' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Billing' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Support' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Guide' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible();
  });

  test('should display balance widget with Add Funds button', async () => {
    await expect(page.getByText('Balance')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add Funds', exact: true })).toBeVisible();
  });

  test('should display stat cards', async () => {
    await expect(page.getByText('Total Orders')).toBeVisible();
    await expect(page.getByText('Total Spent')).toBeVisible();
  });

  test('should display recent orders section with table headers', async () => {
    await expect(page.getByText('Recent Orders')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Order ID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Quantity' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Price' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible();
  });

  test('should navigate to deposit page via Add Funds', async () => {
    await page.getByRole('link', { name: 'Add Funds', exact: true }).click();
    await page.waitForURL('/billing/deposit');
    await expect(page).toHaveURL('/billing/deposit');
    await page.goto('/dashboard');
  });

  test('should navigate to orders via sidebar', async () => {
    await page.locator('nav').getByRole('link', { name: 'Orders' }).click();
    await page.waitForURL('/orders');
    await expect(page).toHaveURL('/orders');
    await page.goto('/dashboard');
  });

  test('should navigate to catalog via sidebar', async () => {
    await page.locator('nav').getByRole('link', { name: 'Catalog' }).click();
    await page.waitForURL('/catalog');
    await expect(page).toHaveURL('/catalog');
    await page.goto('/dashboard');
  });

  test('should show user dropdown with menu items', async () => {
    await page.locator('[data-slot="avatar"]').click();
    await expect(page.getByText('Settings').last()).toBeVisible();
    await expect(page.getByText('Admin Panel')).toBeVisible();
    await expect(page.getByText('Log out')).toBeVisible();
    // Close dropdown by pressing Escape
    await page.keyboard.press('Escape');
  });

  test('should log out and redirect to login', async () => {
    // Small delay to ensure previous dropdown is fully closed
    await page.waitForTimeout(500);
    await page.locator('[data-slot="avatar"]').click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await page.waitForURL('/login', { timeout: 10_000 });
    await expect(page).toHaveURL('/login');
  });
});
