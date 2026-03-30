import { test, expect, type Page, type BrowserContext } from '@playwright/test';

let context: BrowserContext;
let page: Page;

// Locator for the provider service combobox trigger
const serviceCombobox = () => page.locator('[data-slot="popover-trigger"]');

test.describe.serial('Admin Services Page', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Login once for all tests
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('admin@youboost.dev');
    await page.getByPlaceholder('Enter your password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/admin/);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should navigate to services page', async () => {
    await page.getByRole('link', { name: 'Services' }).click();
    await page.waitForURL('/admin/services');
    await expect(page.getByRole('heading', { name: 'Services' })).toBeVisible();
  });

  test('should open create dialog and show "Select a provider first"', async () => {
    await page.getByRole('button', { name: 'Add Service' }).click();
    await expect(page.getByRole('heading', { name: 'Create Service' })).toBeVisible();
    await expect(page.getByText('Select a provider first')).toBeVisible();
  });

  test('should load provider services after selecting provider', async () => {
    await page.getByRole('combobox').filter({ hasText: 'Select provider' }).click();
    await page.getByRole('option').first().click();
    await expect(page.getByText('Loading services…')).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText(/Provider Service \(\d+ services\)/)).toBeVisible();
  });

  test('should open combobox and prompt to type', async () => {
    const trigger = serviceCombobox();
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByText('Type at least 2 characters to search…')).toBeVisible();
  });

  test('should show grouped results after typing search query', async () => {
    const searchInput = page.getByPlaceholder('Search by name or category…');
    await searchInput.fill('telegram');
    await page.waitForTimeout(300);

    const headings = page.locator('[cmdk-group-heading]');
    await expect(headings.first()).toBeVisible();
    expect(await headings.count()).toBeGreaterThanOrEqual(1);

    const items = page.locator('[cmdk-item]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(50);
  });

  test('should show "No services found" for nonsense search', async () => {
    const searchInput = page.getByPlaceholder('Search by name or category…');
    await searchInput.fill('zzzzxxxxxqqqq');
    await page.waitForTimeout(300);
    await expect(page.getByText('No services found.')).toBeVisible();
  });

  test('should select a service and fill form fields', async () => {
    const searchInput = page.getByPlaceholder('Search by name or category…');
    await searchInput.fill('telegram');
    await page.waitForTimeout(300);

    await page.locator('[cmdk-item]').first().click();

    // Form fields should be auto-filled
    // Verify the combobox trigger now shows a service name (not placeholder)
    const trigger = serviceCombobox();
    await expect(trigger).not.toHaveText('Search services…');

    // Verify price was filled (number input after "Price per 1000" label)
    const priceInput = page.locator('input[type="number"]').first();
    await expect(priceInput).not.toHaveValue('');
  });

  test('should cancel form and close dialog', async () => {
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Create Service' })).not.toBeVisible();
  });
});
