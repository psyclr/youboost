import { test, expect, type Page, type BrowserContext } from '@playwright/test';

let context: BrowserContext;
let page: Page;

test.describe.serial('New Order Page', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Login as admin
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('admin@youboost.dev');
    await page.getByPlaceholder('Enter your password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/admin/, { timeout: 10_000 });

    await page.route('**/api/billing/balance', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ balance: 1000, currency: 'USD' }),
      }),
    );

    await page.goto('/orders/new');
    await page.waitForURL('/orders/new');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should display page heading', async () => {
    await expect(page.getByRole('heading', { name: 'New Order' })).toBeVisible();
    await expect(page.getByText('Create a new service order')).toBeVisible();
  });

  test('should display card title and description', async () => {
    await expect(page.getByText('Order Details')).toBeVisible();
    await expect(page.getByText('Fill in the details for your order')).toBeVisible();
  });

  test('should display all form fields', async () => {
    await expect(page.getByText('Service').first()).toBeVisible();
    await expect(page.getByText('Link').first()).toBeVisible();
    await expect(page.getByText('Quantity').first()).toBeVisible();
    await expect(page.getByText('Comments (optional)')).toBeVisible();
    await expect(page.getByText('Coupon Code (optional)')).toBeVisible();
    await expect(page.getByText('Drip-feed').first()).toBeVisible();
    await expect(page.getByPlaceholder('https://youtube.com/watch?v=…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Order' })).toBeEnabled();
  });

  test('should show validation error when submitting empty form', async () => {
    await page.getByRole('button', { name: 'Create Order' }).click();
    await expect(page.locator('[data-slot="form-message"]').first()).toBeVisible();
  });

  test('should select a service and show min/max description', async () => {
    // Open service select — use combobox role
    const serviceSelect = page.getByRole('combobox', { name: 'Service' }).first();
    await serviceSelect.click();

    // Pick first available service
    const firstOption = page.getByRole('option').first();
    await firstOption.click();

    // Min/Max description should appear under quantity
    await expect(page.getByText(/Min:.*Max:/)).toBeVisible({ timeout: 5_000 });
  });

  test('should show validation error for invalid link', async () => {
    await page.getByPlaceholder('https://youtube.com/watch?v=…').fill('not-a-url');
    await page.getByRole('button', { name: 'Create Order' }).click();

    await expect(page.getByText('Please enter a valid URL')).toBeVisible();
  });

  test('should show drip-feed fields when toggled on', async () => {
    // Toggle drip-feed on
    await page.getByRole('switch').click();

    await expect(page.getByText('Number of Runs')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. 5')).toBeVisible();
    await expect(page.getByText('Interval Between Runs')).toBeVisible();
    await expect(page.getByText('How many times to deliver (2-100)')).toBeVisible();
  });

  test('should display drip-feed interval options', async () => {
    // Open interval select using combobox role
    const intervalCombobox = page.getByRole('combobox', { name: 'Interval Between Runs' });
    await intervalCombobox.click();

    const options = [
      '30 minutes',
      '1 hour',
      '2 hours',
      '6 hours',
      '12 hours',
      '24 hours',
      '48 hours',
    ];
    for (const option of options) {
      await expect(page.getByRole('option', { name: option, exact: true })).toBeVisible();
    }

    await page.keyboard.press('Escape');

    // Toggle drip-feed off
    await page.getByRole('switch').click();
  });

  test('should show estimated price after selecting service', async () => {
    await expect(page.getByText('Estimated Price')).toBeVisible();
    await expect(page.getByText(/per 1,000/)).toBeVisible();
  });

  test('should submit valid order (mocked) and redirect', async () => {
    // Mock the order creation endpoint
    await page.route('**/api/orders', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ orderId: 'mock-order-id-12345678' }),
        });
      }
      return route.continue();
    });

    // Fill valid data
    await page
      .getByPlaceholder('https://youtube.com/watch?v=…')
      .fill('https://youtube.com/watch?v=test123');

    await page.getByRole('button', { name: 'Create Order' }).click();

    // Confirm dialog appears — click "Place Order"
    await expect(page.getByRole('heading', { name: 'Confirm Order' })).toBeVisible();
    await page.getByRole('button', { name: 'Place Order' }).click();

    await page.waitForURL(/\/orders\/mock-order-id/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/orders\/mock-order-id/);
  });

  test('should reject quantity of 0 on fresh form', async () => {
    await page.goto('/orders/new');
    await page.waitForURL('/orders/new');

    // Select a service first
    const serviceSelect = page.getByRole('combobox', { name: 'Service' }).first();
    await serviceSelect.click();
    await page.getByRole('option').first().click();
    await expect(page.getByText(/Min:.*Max:/)).toBeVisible({ timeout: 5_000 });

    // Set quantity to 0
    const quantityInput = page.getByLabel('Quantity');
    await quantityInput.fill('0');

    await page
      .getByPlaceholder('https://youtube.com/watch?v=…')
      .fill('https://youtube.com/watch?v=test');
    await page.getByRole('button', { name: 'Create Order' }).click();

    await expect(page.getByText('Minimum quantity is 1')).toBeVisible();
  });

  test('should reject negative quantity', async () => {
    const quantityInput = page.getByLabel('Quantity');
    await quantityInput.fill('-5');

    await page.getByRole('button', { name: 'Create Order' }).click();
    await expect(page.getByText('Minimum quantity is 1')).toBeVisible();
  });

  test('should accept manually typed quantity and submit', async () => {
    // Mock order creation
    await page.route('**/api/orders', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ orderId: 'mock-typed-qty-order' }),
        });
      }
      return route.continue();
    });

    const quantityInput = page.getByLabel('Quantity');
    await quantityInput.fill('500');

    await page.getByRole('button', { name: 'Create Order' }).click();

    // Should reach confirm dialog (no validation error)
    await expect(page.getByRole('heading', { name: 'Confirm Order' })).toBeVisible();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await page.waitForURL(/\/orders\/mock-typed-qty/, { timeout: 10_000 });
  });
});
