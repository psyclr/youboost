import { test, expect, type Page, type BrowserContext } from '@playwright/test';

let context: BrowserContext;
let page: Page;

test.describe.serial('Bulk Order Page', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Login as admin
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('admin@youboost.dev');
    await page.getByPlaceholder('Enter your password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/admin/, { timeout: 10_000 });

    await page.goto('/orders/bulk');
    await page.waitForURL('/orders/bulk');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should display page heading', async () => {
    await expect(page.getByRole('heading', { name: 'Bulk Order' })).toBeVisible();
    await expect(page.getByText('Create multiple orders at once')).toBeVisible();
  });

  test('should navigate back to orders via back arrow', async () => {
    await page.locator('a[href="/orders"]').first().click();
    await page.waitForURL('/orders');
    await expect(page).toHaveURL('/orders');
    await page.goto('/orders/bulk');
  });

  test('should display card title and description', async () => {
    await expect(page.getByText('Order Configuration')).toBeVisible();
    await expect(page.getByText('Select a service and enter links to order')).toBeVisible();
  });

  test('should display all form fields', async () => {
    await expect(page.getByText('Service').first()).toBeVisible();
    await expect(page.getByText('Default Quantity (per link)')).toBeVisible();
    await expect(page.getByText('Links').first()).toBeVisible();
    await expect(page.getByText('Comments (optional)')).toBeVisible();
    await expect(page.getByText('Enter one link per line (up to 500 links)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible();
  });

  test('should select a service', async () => {
    const serviceSelect = page.getByRole('combobox', { name: 'Service' });
    await serviceSelect.click();

    const firstOption = page.getByRole('option').first();
    await firstOption.click();

    // Min/Max description should appear
    await expect(page.getByText(/Min:.*Max:/)).toBeVisible({ timeout: 5_000 });
  });

  test('should show preview with valid and invalid links', async () => {
    // Enter mixed links into the Links textarea
    const linksTextarea = page.getByLabel('Links', { exact: true });
    await linksTextarea.fill(
      'https://youtube.com/watch?v=valid1\nhttps://youtube.com/watch?v=valid2\nnot-a-valid-url\nhttps://youtube.com/watch?v=valid3',
    );

    await page.getByRole('button', { name: 'Preview' }).click();

    // Preview card should appear
    await expect(page.getByText('Preview').last()).toBeVisible();
    await expect(page.getByText(/3 valid link/)).toBeVisible();
    await expect(page.getByText(/1 invalid/)).toBeVisible();
  });

  test('should show estimated total in preview', async () => {
    await expect(page.getByText('Estimated Total')).toBeVisible();
  });

  test('should submit bulk order (mocked) and show results', async () => {
    // Mock the bulk order endpoint
    await page.route('**/api/orders/bulk', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            totalCreated: 2,
            totalFailed: 1,
            results: [
              {
                link: 'https://youtube.com/watch?v=valid1',
                status: 'success',
                orderId: 'ord-aaa11111',
              },
              {
                link: 'https://youtube.com/watch?v=valid2',
                status: 'success',
                orderId: 'ord-bbb22222',
              },
              {
                link: 'https://youtube.com/watch?v=valid3',
                status: 'failed',
                error: 'Insufficient balance',
              },
            ],
          }),
        });
      }
      return route.continue();
    });

    // Click create button (shows valid count)
    await page.getByRole('button', { name: /Create \d+ Orders/ }).click();

    // Confirm dialog appears — click "Create Orders"
    await expect(page.getByRole('heading', { name: 'Confirm Bulk Order' })).toBeVisible();
    await page.getByRole('button', { name: 'Create Orders' }).click();

    // Results card should appear
    await expect(page.getByText('Results').last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('2 created, 1 failed')).toBeVisible();

    // Check success and failed badges
    await expect(page.getByText('Success').first()).toBeVisible();
    await expect(page.getByText('Failed').first()).toBeVisible();
  });
});
