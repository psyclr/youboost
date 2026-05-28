import { test, expect, type Page, type BrowserContext, type Route, type Locator } from '@playwright/test';

const CALCULATE_PATTERN = /\/api\/landing\/[^/]+\/calculate$/;

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
    await page.route(CALCULATE_PATTERN, async (route: Route) => {
      const body = JSON.parse((route.request().postData() ?? '{}') as string) as {
        serviceId: string;
        quantity: number;
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          price: 12.5,
          serviceId: body.serviceId,
          quantity: body.quantity,
          reason: null,
        }),
      });
    });
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
    await panel().getByLabel(/add a link/i).fill(LONG_LINK);
    expect(await docOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('3. Payment modal stays within viewport with a long link', async () => {
    await panel().getByLabel(/add a link/i).fill(LONG_LINK);
    await panel().getByRole('button', { name: /pay \$/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const vw = viewport!.width;

    // Both payment buttons must be fully within the viewport (not pushed right).
    for (const name of [/pay with card/i, /pay with crypto/i]) {
      const btn = dialog.getByRole('button', { name });
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);
    }

    // The dialog itself must not introduce horizontal page overflow.
    expect(await docOverflow(page)).toBeLessThanOrEqual(1);
  });
});
