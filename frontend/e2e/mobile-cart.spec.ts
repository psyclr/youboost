import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const LONG = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL' + 'x'.repeat(160) + '&index=1';
let context: BrowserContext;
let page: Page;
const panel = () => page.getByTestId('order-panel');
const docOverflow = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe.serial('Mobile cart layout', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });
  test.afterAll(async () => {
    await context.close();
  });

  test('multiple long links across items cause no horizontal overflow', async () => {
    await page.goto('/');
    await expect(panel()).toBeVisible({ timeout: 10_000 });
    const cards = page.locator('[data-tier-card]');
    await cards.nth(0).getByRole('button', { name: /^pay$/i }).click();
    await cards.nth(1).getByRole('button', { name: /^pay$/i }).click();
    for (const inp of await panel()
      .getByLabel(/add a link/i)
      .all())
      await inp.fill(LONG);
    expect(await docOverflow(page)).toBeLessThanOrEqual(1);
    const payBtn = panel().getByRole('button', { name: /pay \$/i });
    const box = await payBtn.boundingBox();
    const vw = page.viewportSize()!.width;
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);
  });
});
