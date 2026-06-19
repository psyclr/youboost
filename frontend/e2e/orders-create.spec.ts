import { test, expect, type Page, type BrowserContext, type Route } from '@playwright/test';

/**
 * REAL-BACKEND logged-in order creation, run only against the isolated test
 * stack (E2E_REAL_BACKEND=1, frontend 3301 → backend 3300 → ephemeral DB).
 * The seeded admin has a funded wallet (SEED_E2E), the SMM provider is in stub
 * mode, so a real order is created, funds are held, and it is submitted —
 * without any external dependency. Never runs against youboost_dev (prod data).
 *
 *   scripts/e2e-stack.sh orders-create
 */
const ORDERS = /\/api\/orders$/;
const RUN_REAL = process.env['E2E_REAL_BACKEND'] === '1';

test.describe.serial('Order creation (real backend, isolated stack)', () => {
  test.skip(!RUN_REAL, 'requires the isolated test stack (E2E_REAL_BACKEND=1)');
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    // Real login against the test backend (high login cap on this stack).
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('admin@youboost.dev');
    await page.getByPlaceholder('Enter your password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/admin/, { timeout: 15_000 });
  });
  test.afterAll(async () => {
    await context.close();
  });

  test('creates a real order from the dashboard and lands on its detail page', async () => {
    // Forward POST /orders to the real backend, capturing the created order id
    // before the page navigates away to the detail route.
    let created: { orderId: string } | null = null;
    await page.route(ORDERS, async (route: Route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      created = (await response.json()) as { orderId: string };
      await route.fulfill({ response });
    });

    await page.goto('/orders/new');
    await page.waitForURL('/orders/new');

    await page.getByRole('combobox', { name: 'Service' }).first().click();
    await page.getByRole('option').first().click();
    await expect(page.getByText(/Min:.*Max:/)).toBeVisible({ timeout: 5_000 });

    await page
      .getByPlaceholder('https://youtube.com/watch?v=…')
      .fill('https://youtube.com/watch?v=e2e-order');
    await page.getByLabel('Quantity').fill('100');

    await page.getByRole('button', { name: 'Create Order' }).click();
    await expect(page.getByRole('heading', { name: 'Confirm Order' })).toBeVisible();
    await page.getByRole('button', { name: 'Place Order' }).click();

    // The REAL backend created the order (held funds, submitted to the stub
    // provider) and returned a real DB id.
    await expect.poll(() => created).not.toBeNull();
    const orderId = (created as NonNullable<typeof created>).orderId;
    expect(orderId).toMatch(/^[0-9a-f-]{36}$/);

    await page.waitForURL(new RegExp(`/orders/${orderId}`), { timeout: 15_000 });
    // Detail page renders the order with a real lifecycle status.
    await expect(page.getByText(/PROCESSING|PENDING|IN PROGRESS/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
