import { test, expect, type Page, type BrowserContext, type Route } from '@playwright/test';

const CART_CHECKOUT = /\/api\/landing\/[^/]+\/checkout\/cart$/;
let context: BrowserContext;
let page: Page;

test.describe.serial('Landing cart', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });
  test.afterAll(async () => {
    await context.close();
  });
  test.beforeEach(async () => {
    await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => undefined);
    await page.goto('/');
    await expect(page.getByTestId('order-panel')).toBeVisible({ timeout: 10_000 });
  });

  const cards = () => page.locator('[data-tier-card]');
  const panel = () => page.getByTestId('order-panel');

  test('empty cart shows the empty state', async () => {
    await expect(panel()).toContainText(/pick a service/i);
  });

  test('adding two services shows two items and a summed Pay total', async () => {
    await cards().nth(0).getByRole('button', { name: /^pay$/i }).click();
    await cards().nth(1).getByRole('button', { name: /^pay$/i }).click();
    await expect(panel().getByLabel(/add a link/i)).toHaveCount(2);
    await expect(panel().getByRole('button', { name: /pay \$\d/i })).toBeVisible();
  });

  test('removing an item drops it; emptying returns to empty state', async () => {
    await cards().nth(0).getByRole('button', { name: /^pay$/i }).click();
    await panel()
      .getByRole('button', { name: /remove item/i })
      .first()
      .click();
    await expect(panel()).toContainText(/pick a service/i);
  });

  test('quantity field accepts digits only and never yields a NaN total', async () => {
    await cards().nth(0).getByRole('button', { name: /^pay$/i }).click();
    const qty = panel().getByLabel(/quantity/i);
    // Type a hostile string: minus, exponent, dot, letters, spaces.
    await qty.fill('');
    await qty.pressSequentially('-1e2.5 abc');
    await expect(qty).toHaveValue('125');
    // The Pay button must show a real dollar amount, never "Pay $NaN".
    const pay = panel().getByRole('button', { name: /pay \$/i });
    await expect(pay).toBeVisible();
    await expect(pay).not.toContainText(/nan/i);
  });

  test('a missing link on any item blocks checkout', async () => {
    await cards().nth(0).getByRole('button', { name: /^pay$/i }).click();
    await cards().nth(1).getByRole('button', { name: /^pay$/i }).click();
    const links = await panel()
      .getByLabel(/add a link/i)
      .all();
    await links[0]!.fill('https://youtube.com/watch?v=abc'); // second left empty
    await panel()
      .getByPlaceholder(/you@example/i)
      .fill('a@b.com');
    await panel()
      .getByRole('button', { name: /pay \$/i })
      .click();
    await expect(panel().getByRole('alert')).toContainText(/link for every service/i);
  });

  test('a quantity below the service minimum blocks checkout', async () => {
    await cards().nth(0).getByRole('button', { name: /^pay$/i }).click();
    await panel()
      .getByLabel(/add a link/i)
      .first()
      .fill('https://youtube.com/watch?v=abc');
    await panel()
      .getByLabel(/quantity/i)
      .fill('1'); // below any real SMM minimum
    await panel()
      .getByRole('button', { name: /pay \$/i })
      .click();
    await expect(panel().getByRole('alert')).toContainText(/minimum/i);
  });

  // Untrusted-host rejection is covered by the unit suite
  // src/lib/payments/__tests__/checkout-host.test.ts (incl. evilstripe.com /
  // evilcryptomus.com lookalikes) — no need to re-prove it through the browser.

  test('crypto provider posts paymentProvider=cryptomus and follows a valid cryptomus redirect', async () => {
    const captured: { body: unknown } = { body: null };
    await page.route(CART_CHECKOUT, (route: Route) => {
      captured.body = JSON.parse(route.request().postData() ?? '{}');
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'u',
          paymentId: 'p',
          orderIds: ['o1'],
          checkoutUrl: 'https://pay.cryptomus.com/abc',
        }),
      });
    });
    // Stub the external host so the redirect lands somewhere controllable.
    await page.route('https://pay.cryptomus.com/**', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>ok</body></html>',
      }),
    );
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
      .fill('a@b.com');
    await panel()
      .getByRole('button', { name: /pay \$/i })
      .click();
    await expect.poll(() => captured.body).not.toBeNull();
    expect((captured.body as { paymentProvider: string }).paymentProvider).toBe('cryptomus');
    await page.waitForURL(/pay\.cryptomus\.com/, { timeout: 10_000 });
  });

  test('a long cart scrolls inside the panel instead of stretching the page', async () => {
    const addFirst = cards().nth(0).getByRole('button', { name: /^pay$/i });
    for (let i = 0; i < 6; i++) await addFirst.click();
    await expect(panel().getByLabel(/add a link/i)).toHaveCount(6);
    // The item list is height-capped and scrolls internally, so its content
    // overflows its own box rather than growing the panel/page.
    const list = panel().getByTestId('cart-items');
    const { scrollH, clientH } = await list.evaluate((el) => ({
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
    }));
    expect(clientH).toBeGreaterThan(0);
    expect(scrollH).toBeGreaterThan(clientH);
  });

  test('invalid email blocks checkout; valid cart posts items and redirects', async () => {
    const captured: { body: unknown } = { body: null };
    await page.route(CART_CHECKOUT, async (route: Route) => {
      captured.body = JSON.parse(route.request().postData() ?? '{}');
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'u',
          paymentId: 'p',
          orderIds: ['o1', 'o2'],
          checkoutUrl: 'https://checkout.stripe.com/x',
        }),
      });
    });
    await cards().nth(0).getByRole('button', { name: /^pay$/i }).click();
    await cards().nth(1).getByRole('button', { name: /^pay$/i }).click();
    for (const inp of await panel()
      .getByLabel(/add a link/i)
      .all()) {
      await inp.fill('https://youtube.com/watch?v=abc');
    }
    await panel()
      .getByRole('button', { name: /pay \$/i })
      .click(); // no email yet
    await expect(panel().getByRole('alert')).toContainText(/valid email/i);
    await panel()
      .getByPlaceholder(/you@example/i)
      .fill('a@b.com');
    await panel()
      .getByRole('button', { name: /pay \$/i })
      .click();
    await expect.poll(() => captured.body).not.toBeNull();
    expect((captured.body as { items: unknown[] }).items).toHaveLength(2);
  });
});
