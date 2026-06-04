import { test, expect, type Page, type BrowserContext, type Locator } from '@playwright/test';

let context: BrowserContext;
let page: Page;

async function gotoHome() {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^go$/i })).toBeVisible({ timeout: 10_000 });
}

function panel(): Locator {
  return page.getByTestId('order-panel');
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

  test('1. Hero shows link input + Go; order panel visible with empty state', async () => {
    // Hero
    await expect(page.getByRole('button', { name: /^go$/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /link to your video/i })).toBeVisible();
    // Order panel visible and in empty state (no service selected yet)
    await expect(panel()).toBeVisible();
    await expect(panel()).toContainText(/pick a service/i);
  });

  test('2. Hero Go disabled when link empty; enabled after typing', async () => {
    const go = page.getByRole('button', { name: /^go$/i });
    await expect(go).toBeDisabled();
    await page
      .getByRole('textbox', { name: /link to your video/i })
      .fill('https://youtube.com/watch?v=abc');
    await expect(go).toBeEnabled();
  });

  test('3. Hero Go propagates link — after adding a service, link appears in its input', async () => {
    // Enter link and click Go
    await page
      .getByRole('textbox', { name: /link to your video/i })
      .fill('https://youtube.com/watch?v=xyz');
    await page.getByRole('button', { name: /^go$/i }).click();
    // Now add a service card to the cart — the pending hero link should apply
    const cards = page.locator('[data-tier-card]');
    await cards.first().getByRole('button', { name: /^pay$/i }).click();
    // The link input in the panel should be pre-filled
    await expect(
      panel()
        .getByLabel(/add a link/i)
        .first(),
    ).toHaveValue('https://youtube.com/watch?v=xyz');
  });

  test('4. Live price updates when panel quantity changes', async () => {
    // Add a service first so the panel is active
    const cards = page.locator('[data-tier-card]');
    await cards.first().getByRole('button', { name: /^pay$/i }).click();
    const payBtn = panel().getByRole('button', { name: /pay \$/i });
    await expect(payBtn).toBeVisible();
    const labelBefore = (await payBtn.textContent()) ?? '';
    await panel()
      .getByLabel(/quantity/i)
      .first()
      .fill('2000');
    await expect(payBtn).not.toHaveText(labelBefore);
    const labelAfter = (await payBtn.textContent()) ?? '';
    expect(labelAfter).toMatch(/pay \$\d/i);
  });

  test('5. Clicking Pay on a service card adds it to the order panel', async () => {
    const cards = page.locator('[data-tier-card]');
    const count = await cards.count();
    if (count < 2) test.skip(true, 'Needs >=2 tier cards');

    const secondCard = cards.nth(1);
    const secondTitle = (await secondCard.locator('h3').textContent())?.trim() ?? '';
    await secondCard.getByRole('button', { name: /^pay$/i }).click();
    // Order panel shows the item
    await expect(panel().locator('h4').first()).toHaveText(secondTitle);
  });
});
