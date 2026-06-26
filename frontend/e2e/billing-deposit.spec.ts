import { test, expect, type Page, type BrowserContext, type Route } from '@playwright/test';

const STRIPE_CHECKOUT = '**/api/billing/stripe/checkout';
const CRYPTO_CHECKOUT = '**/api/billing/cryptomus/checkout';
const BALANCE = '**/api/billing/balance';

let context: BrowserContext;
let page: Page;

async function mockBalance() {
  await page.route(BALANCE, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ balance: 1000, currency: 'USD' }),
    }),
  );
}

async function mockJson(pattern: string, status: number, body: unknown) {
  await page.route(pattern, (route: Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

async function stubExternal(globPattern: string) {
  await page.route(globPattern, (route: Route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html>ok</html>' }),
  );
}

function stripeForm() {
  return page.locator('form').filter({
    has: page.getByRole('button', { name: /^Pay \$[\d.,]+$/ }),
  });
}

function cryptoForm() {
  return page.locator('form').filter({
    has: page.getByRole('button', { name: /in Crypto$/i }),
  });
}

test.describe.serial('Billing deposit (Stripe + Cryptomus)', () => {
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

  test.beforeEach(async () => {
    await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => undefined);
    await mockBalance();
    await page.goto('/billing/deposit');
    await expect(page.getByRole('heading', { name: 'Deposit Funds' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('1. Renders both payment cards with $25 default', async () => {
    await expect(page.getByText('Pay with Card')).toBeVisible();
    await expect(page.getByText('Pay with Crypto')).toBeVisible();
    await expect(stripeForm().getByRole('spinbutton')).toHaveValue('25');
    await expect(cryptoForm().getByRole('spinbutton')).toHaveValue('25');
    await expect(page.getByText('Min: $5 — Max: $10,000').first()).toBeVisible();
  });

  test('2. Amount below $5 shows zod error and blocks checkout', async () => {
    const captured = { hit: false };
    await page.route(STRIPE_CHECKOUT, (route: Route) => {
      captured.hit = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await stripeForm().getByRole('spinbutton').fill('3');
    await stripeForm().getByRole('button', { name: /^Pay \$/ }).click();
    await expect(stripeForm().getByText('Minimum deposit is $5')).toBeVisible();
    await expect(page).toHaveURL(/\/billing\/deposit/);
    expect(captured.hit).toBe(false);
  });

  test('3. Amount above $10,000 shows zod error and blocks checkout', async () => {
    const captured = { hit: false };
    await page.route(CRYPTO_CHECKOUT, (route: Route) => {
      captured.hit = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await cryptoForm().getByRole('spinbutton').fill('20000');
    await cryptoForm().getByRole('button', { name: /in Crypto$/i }).click();
    await expect(cryptoForm().getByText('Maximum deposit is $10,000')).toBeVisible();
    await expect(page).toHaveURL(/\/billing\/deposit/);
    expect(captured.hit).toBe(false);
  });

  test('4. Preset button sets amount and updates pay label', async () => {
    await stripeForm().getByRole('button', { name: '$100' }).click();
    await expect(stripeForm().getByRole('spinbutton')).toHaveValue('100');
    await expect(stripeForm().getByRole('button', { name: 'Pay $100.00' })).toBeVisible();
  });

  test('5. Stripe success redirects to checkout.stripe.com', async () => {
    await mockJson(STRIPE_CHECKOUT, 200, {
      sessionId: 'cs_test_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
    });
    await stubExternal('https://checkout.stripe.com/**');
    await Promise.all([
      page.waitForURL(/checkout\.stripe\.com/, { timeout: 10_000 }),
      stripeForm().getByRole('button', { name: /^Pay \$/ }).click(),
    ]);
  });

  // Host-allowlist rejection (stripe + cryptomus lookalikes) is covered by the
  // unit suite src/lib/payments/__tests__/checkout-host.test.ts — no need to
  // re-prove it through the browser. The success-redirect tests below keep the
  // frontend wiring honest.

  test('7. Cryptomus success redirects to cryptomus.com', async () => {
    await mockJson(CRYPTO_CHECKOUT, 200, {
      orderId: 'ord_1',
      url: 'https://pay.cryptomus.com/pay/9f3c',
    });
    await stubExternal('https://pay.cryptomus.com/**');
    await Promise.all([
      page.waitForURL(/cryptomus\.com/, { timeout: 10_000 }),
      cryptoForm().getByRole('button', { name: /in Crypto$/i }).click(),
    ]);
  });

  test('9. CRYPTOMUS_NOT_CONFIGURED maps to friendly unavailable message', async () => {
    await mockJson(CRYPTO_CHECKOUT, 503, {
      error: { code: 'CRYPTOMUS_NOT_CONFIGURED', message: 'raw internal' },
    });
    await cryptoForm().getByRole('button', { name: /in Crypto$/i }).click();
    await expect(page.getByText(/Crypto payments are temporarily unavailable/i)).toBeVisible();
    await expect(page.getByText('raw internal')).toHaveCount(0);
  });

  test('10. STRIPE_NOT_CONFIGURED maps to friendly unavailable message', async () => {
    await mockJson(STRIPE_CHECKOUT, 503, {
      error: { code: 'STRIPE_NOT_CONFIGURED', message: 'raw internal' },
    });
    await stripeForm().getByRole('button', { name: /^Pay \$/ }).click();
    await expect(page.getByText(/Card payments are temporarily unavailable/i)).toBeVisible();
  });
});
