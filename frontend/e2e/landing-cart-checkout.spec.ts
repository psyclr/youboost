import { test, expect, type Page, type BrowserContext, type Route } from '@playwright/test';

/**
 * REAL-BACKEND guest checkout journey, run only against the isolated test stack
 * (test frontend 3201 → test backend 3200 → youboost_test, PAYMENTS_FAKE).
 *
 * Guarded by E2E_REAL_BACKEND=1 so the default suite (which points at the dev
 * stack on youboost_dev = prod data) NEVER runs it — a real guest checkout
 * writes an auto-user + Payment + orders, which must only land in youboost_test.
 *
 *   E2E_REAL_BACKEND=1 E2E_BASE_URL=http://localhost:3201 npx playwright test landing-cart-checkout
 *
 * Unlike landing-cart.spec (which mocks /checkout/cart), here the real backend
 * runs the full flow; the only stub is the external provider host the browser
 * would navigate to (PAYMENTS_FAKE returns a pay.cryptomus.com URL).
 */
const CART_CHECKOUT = /\/api\/landing\/[^/]+\/checkout\/cart$/;
const describeReal =
  process.env['E2E_REAL_BACKEND'] === '1' ? test.describe.serial : test.describe.serial.skip;

describeReal('Landing cart checkout (real backend, isolated stack)', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });
  test.afterAll(async () => {
    await context.close();
  });

  const panel = () => page.getByTestId('order-panel');
  const cards = () => page.locator('[data-tier-card]');

  test('guest crypto checkout runs the real backend and redirects to a provider session', async () => {
    // Forward /checkout/cart to the REAL backend but capture its body here —
    // the page navigates on success, which would discard the response body if we
    // read it post-hoc. route.fetch() hits the real test backend; we read the
    // real response, then fulfill so the frontend redirect proceeds.
    let captured: {
      userId: string;
      paymentId: string;
      orderIds: string[];
      checkoutUrl: string;
    } | null = null;
    await page.route(CART_CHECKOUT, async (route: Route) => {
      const response = await route.fetch();
      captured = (await response.json()) as typeof captured;
      await route.fulfill({ response });
    });
    // Stub only the external provider host the browser is redirected to.
    await page.route('https://pay.cryptomus.com/**', (route: Route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>ok</body></html>' }),
    );

    await page.goto('/');
    await expect(panel()).toBeVisible({ timeout: 10_000 });

    await cards().nth(0).getByRole('button', { name: /^pay$/i }).click();
    await panel()
      .getByLabel(/add a link/i)
      .first()
      .fill('https://youtube.com/watch?v=abc');
    await panel()
      .getByRole('button', { name: /^crypto$/i })
      .click();
    await panel()
      .getByPlaceholder(/you@example/i)
      .fill(`guest-e2e-${Date.now()}@test.local`);
    await panel()
      .getByRole('button', { name: /pay \$/i })
      .click();

    // The REAL backend created the entities and returned a real session URL.
    await expect.poll(() => captured).not.toBeNull();
    const json = captured as NonNullable<typeof captured>;
    expect(json.userId).toMatch(/^[0-9a-f-]{36}$/); // real DB UUID, not a mock 'u'
    expect(json.paymentId).toMatch(/^[0-9a-f-]{36}$/);
    expect(json.orderIds.length).toBeGreaterThan(0);
    expect(new URL(json.checkoutUrl).hostname).toBe('pay.cryptomus.com');

    // …and the browser follows it (frontend allowlist accepted the trusted host).
    await page.waitForURL(/pay\.cryptomus\.com/, { timeout: 10_000 });
  });
});
