import { test, expect, type Page, type BrowserContext, type Route, type Locator } from '@playwright/test';

const CALCULATE_PATTERN = /\/api\/landing\/[^/]+\/calculate$/;
const CHECKOUT_PATTERN = /\/api\/landing\/[^/]+\/checkout$/;

let context: BrowserContext;
let page: Page;

async function mockCalculate(valid: boolean, price: number | null, reason: string | null = null) {
  await page.route(CALCULATE_PATTERN, async (route: Route) => {
    const body = JSON.parse((route.request().postData() ?? '{}') as string) as {
      serviceId: string;
      quantity: number;
    };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        valid,
        price,
        serviceId: body.serviceId,
        quantity: body.quantity,
        reason,
      }),
    });
  });
}

async function mockCheckout(checkoutUrl: string, captured: { body: unknown | null }) {
  await page.route(CHECKOUT_PATTERN, async (route: Route) => {
    captured.body = JSON.parse((route.request().postData() ?? '{}') as string);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        orderId: 'mock-order-id',
        userId: 'mock-user-id',
        checkoutUrl,
      }),
    });
  });
}

async function gotoHome() {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^go$/i })).toBeVisible({ timeout: 10_000 });
}

function panel(): Locator {
  return page.getByTestId('order-panel');
}

async function fillPanelLink(link: string) {
  await panel().getByLabel(/add a link/i).fill(link);
}

async function clickPanelPay() {
  await panel().getByRole('button', { name: /pay \$/i }).click();
}

test.describe.serial('Home calculator (dark landing)', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => undefined);
    await gotoHome();
  });

  test('1. Hero shows link input + Go; order panel visible below with default tier', async () => {
    // Hero
    await expect(page.getByRole('button', { name: /^go$/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /link to your video/i })).toBeVisible();
    // Order panel
    await expect(panel()).toBeVisible();
    await expect(panel().getByLabel(/add a link/i)).toBeVisible();
    await expect(panel().getByLabel(/quantity/i)).toBeVisible();
    await expect(panel().getByRole('button', { name: /pay \$/i })).toBeVisible();
  });

  test('2. Hero Go disabled when link empty; enabled after typing', async () => {
    const go = page.getByRole('button', { name: /^go$/i });
    await expect(go).toBeDisabled();
    await page.getByRole('textbox', { name: /link to your video/i }).fill('https://youtube.com/watch?v=abc');
    await expect(go).toBeEnabled();
  });

  test('3. Hero Go propagates link to order panel', async () => {
    await page.getByRole('textbox', { name: /link to your video/i }).fill('https://youtube.com/watch?v=xyz');
    await page.getByRole('button', { name: /^go$/i }).click();
    await expect(panel().getByLabel(/add a link/i)).toHaveValue('https://youtube.com/watch?v=xyz');
  });

  test('4. Live price updates when panel quantity changes', async () => {
    const payBtn = panel().getByRole('button', { name: /pay \$/i });
    const labelBefore = (await payBtn.textContent()) ?? '';
    await panel().getByLabel(/quantity/i).fill('2000');
    await expect(payBtn).not.toHaveText(labelBefore);
    const labelAfter = (await payBtn.textContent()) ?? '';
    expect(labelAfter).toMatch(/pay \$\d/i);
  });

  test('5. Clicking Pay on a service card selects it in the order panel', async () => {
    const cards = page.locator('[data-tier-card]');
    const count = await cards.count();
    if (count < 2) test.skip(true, 'Needs >=2 tier cards');

    const secondCard = cards.nth(1);
    const secondTitle = (await secondCard.locator('h3').textContent())?.trim() ?? '';
    await secondCard.getByRole('button', { name: /^pay$/i }).click();
    // Order panel's item title matches the clicked card
    await expect(panel().locator('h4').first()).toHaveText(secondTitle);
  });

  test('6. Panel Pay → /calculate valid → modal opens with summary + method buttons', async () => {
    await mockCalculate(true, 12.5);
    await fillPanelLink('https://youtube.com/watch?v=abc123');
    await clickPanelPay();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('$12.50')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /pay with card/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /pay with crypto/i })).toBeVisible();
    await expect(dialog.getByPlaceholder(/you@example/i)).toHaveValue('');
  });

  test('7. Modal — invalid email blocks /checkout', async () => {
    await mockCalculate(true, 12.5);
    const captured = { body: null as unknown };
    await mockCheckout('https://example.com/redirect', captured);
    await fillPanelLink('https://youtube.com/watch?v=abc123');
    await clickPanelPay();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /pay with card/i }).click();
    await expect(dialog.getByText(/valid email/i)).toBeVisible();
    expect(captured.body).toBeNull();
  });

  test('8. Modal — Card sends paymentProvider:stripe and redirects', async () => {
    await mockCalculate(true, 12.5);
    const captured = { body: null as unknown };
    await mockCheckout('https://stripe.test/success', captured);
    await page.route('https://stripe.test/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html>ok</html>' }),
    );
    await fillPanelLink('https://youtube.com/watch?v=abc123');
    await clickPanelPay();

    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder(/you@example/i).fill('guest@example.com');

    await Promise.all([
      page.waitForURL(/stripe\.test/, { timeout: 10_000 }),
      dialog.getByRole('button', { name: /pay with card/i }).click(),
    ]);

    const body = captured.body as { paymentProvider: string; email: string };
    expect(body.paymentProvider).toBe('stripe');
    expect(body.email).toBe('guest@example.com');
  });

  test('9. Modal — Crypto sends paymentProvider:cryptomus and redirects', async () => {
    await mockCalculate(true, 12.5);
    const captured = { body: null as unknown };
    await mockCheckout('https://cryptomus.test/pay', captured);
    await page.route('https://cryptomus.test/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html>ok</html>' }),
    );
    await fillPanelLink('https://youtube.com/watch?v=abc123');
    await clickPanelPay();

    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder(/you@example/i).fill('guest@example.com');

    await Promise.all([
      page.waitForURL(/cryptomus\.test/, { timeout: 10_000 }),
      dialog.getByRole('button', { name: /pay with crypto/i }).click(),
    ]);

    const body = captured.body as { paymentProvider: string };
    expect(body.paymentProvider).toBe('cryptomus');
  });

  test('10. /calculate returns invalid → modal does not open, reason shown', async () => {
    await mockCalculate(false, null, 'Quantity too high');
    await fillPanelLink('https://youtube.com/watch?v=abc123');
    await clickPanelPay();

    await expect(page.getByText(/quantity too high/i)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('11. Closing modal preserves panel state; email resets on reopen', async () => {
    await mockCalculate(true, 12.5);
    await fillPanelLink('https://youtube.com/watch?v=abc123');

    const qty = panel().getByLabel(/quantity/i);
    const qtyValueBefore = await qty.inputValue();

    await clickPanelPay();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder(/you@example/i).fill('guest@example.com');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await expect(qty).toHaveValue(qtyValueBefore);

    await clickPanelPay();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByPlaceholder(/you@example/i)).toHaveValue('');
  });
});
