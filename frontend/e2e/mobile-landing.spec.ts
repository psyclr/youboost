import { test, expect, type Page, type BrowserContext, type Locator } from '@playwright/test';

// A pathological link with no break opportunities — the kind that blows out
// flex/grid layouts when an ancestor still has the default min-width:auto.
const LONG_LINK =
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLuperlongplaylistidentifierxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&index=1&t=120s';

let context: BrowserContext;
let page: Page;

function panel(): Locator {
  return page.getByTestId('order-panel');
}

/** Returns horizontal overflow in px of the document (0 = no overflow). */
async function docOverflow(p: Page): Promise<number> {
  return p.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
}

test.describe.serial('Mobile landing layout', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/');
    await expect(panel()).toBeVisible({ timeout: 15_000 });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('1. Home page has no horizontal overflow on mobile', async () => {
    // The platform tab strip must not push the page wider than the viewport.
    expect(await docOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('1b. No horizontal overflow on narrow (360px) viewports', async () => {
    // Common small Android width — the fixed-width search input and the order
    // panel both used to force the shared grid column wider than the screen.
    const narrow = await context.newPage();
    try {
      await narrow.setViewportSize({ width: 360, height: 800 });
      await narrow.goto('/');
      await expect(narrow.getByTestId('order-panel')).toBeVisible({ timeout: 15_000 });
      expect(await docOverflow(narrow)).toBeLessThanOrEqual(1);
    } finally {
      await narrow.close();
    }
  });

  test('2. A long link in the order panel does not cause page overflow', async () => {
    // Add a service so the link input appears
    const cards = page.locator('[data-tier-card]');
    await cards.first().getByRole('button', { name: /^pay$/i }).click();
    await panel()
      .getByLabel(/add a link/i)
      .first()
      .fill(LONG_LINK);
    expect(await docOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('3. Order panel Pay button stays within viewport with a long link', async () => {
    await panel()
      .getByLabel(/add a link/i)
      .first()
      .fill(LONG_LINK);
    const payBtn = panel().getByRole('button', { name: /pay \$/i });
    await expect(payBtn).toBeVisible();

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const vw = viewport!.width;

    // Pay button must be fully within the viewport.
    const box = await payBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);

    // The panel must not introduce horizontal page overflow.
    expect(await docOverflow(page)).toBeLessThanOrEqual(1);
  });
});
