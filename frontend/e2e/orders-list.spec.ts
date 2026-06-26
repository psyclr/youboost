import { test, expect, type Page, type BrowserContext } from '@playwright/test';

let context: BrowserContext;
let page: Page;

test.describe.serial('Orders List Page', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Login as admin
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('admin@youboost.dev');
    await page.getByPlaceholder('Enter your password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/admin/, { timeout: 10_000 });

    await page.goto('/orders');
    await page.waitForURL('/orders');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should display page heading', async () => {
    await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
    await expect(page.getByText('Manage your service orders')).toBeVisible();
  });

  test('should display New Order and Bulk Order buttons', async () => {
    await expect(page.getByRole('link', { name: /New Order/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Bulk Order/ })).toBeVisible();
  });

  test('does not expose an internal status filter to the customer', async () => {
    // The customer page intentionally has no status filter — internal states
    // (failed, partial, awaiting payment) are never surfaced.
    await expect(page.locator('[data-slot="select-trigger"]')).toHaveCount(0);
  });

  test('should show empty state with Browse Catalog link', async () => {
    await expect(page.getByText('No orders yet')).toBeVisible();
    await expect(page.getByText('Start by browsing the service catalog')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse Catalog' })).toBeVisible();
  });

  test('should navigate to New Order page', async () => {
    await page.getByRole('link', { name: /New Order/ }).click();
    await page.waitForURL('/orders/new');
    await expect(page).toHaveURL('/orders/new');
    await page.goto('/orders');
  });

  test('should navigate to Bulk Order page and back', async () => {
    await page.getByRole('link', { name: /Bulk Order/ }).click();
    await page.waitForURL('/orders/bulk');
    await expect(page).toHaveURL('/orders/bulk');

    await page.locator('a[href="/orders"]').first().click();
    await page.waitForURL('/orders');
    await expect(page).toHaveURL('/orders');
  });

  test('should display table with mocked orders data', async () => {
    // Mock orders API to return data
    await page.route('**/api/orders?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orders: [
            {
              orderId: 'abc12345-6789-0000-1111-222233334444',
              status: 'COMPLETED',
              quantity: 1000,
              completed: 1000,
              price: 2.5,
              createdAt: '2026-03-20T12:00:00Z',
            },
            {
              orderId: 'def67890-1234-5555-6666-777788889999',
              status: 'PENDING',
              quantity: 500,
              completed: 0,
              price: 1.25,
              createdAt: '2026-03-21T14:30:00Z',
            },
          ],
          pagination: { page: 1, totalPages: 1, total: 2 },
        }),
      }),
    );

    // Reload to trigger the mocked API
    await page.reload();

    await expect(page.getByRole('columnheader', { name: 'Order ID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Quantity' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Completed' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Price' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible();

    // Header + 2 data rows
    const rows = page.getByRole('row');
    await expect(rows).toHaveCount(3);

    await expect(page.getByText('abc12345…')).toBeVisible();
    await expect(page.getByText('def67890…')).toBeVisible();

    // Customer-facing statuses are collapsed: in-flight states (here PENDING)
    // read as "In progress"; raw internal labels never appear. ("Completed" is
    // also a column header, so it's not a reliable status assertion here.)
    await expect(page.getByText('In progress')).toBeVisible();
    await expect(page.getByText('PENDING', { exact: true })).toHaveCount(0);
    await expect(page.getByText('FAILED', { exact: true })).toHaveCount(0);
  });

  test('should navigate to order detail on row click', async () => {
    const firstRow = page.getByRole('row').nth(1);
    await firstRow.click();
    await page.waitForURL(/\/orders\/abc12345/);
    await expect(page).toHaveURL(/\/orders\/abc12345/);
  });
});
