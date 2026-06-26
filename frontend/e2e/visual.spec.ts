import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * Visual-regression smoke against the isolated test stack (deterministic seeded
 * data). Element-scoped screenshots with animations disabled keep the baseline
 * stable. This is the foundation of the visual layer — what presence tests can't
 * do ("looks right / in place"), not broad coverage.
 *
 *   scripts/e2e-stack.sh visual                       # compare
 *   E2E_REAL_BACKEND=1 E2E_BASE_URL=http://localhost:3301 \
 *     npx playwright test visual --update-snapshots   # refresh baselines
 *
 * Guarded by E2E_REAL_BACKEND so it never runs against the non-deterministic dev
 * data.
 */
const RUN_REAL = process.env['E2E_REAL_BACKEND'] === '1';

test.describe.serial('Visual regression (isolated stack)', () => {
  test.skip(!RUN_REAL, 'requires the isolated test stack (E2E_REAL_BACKEND=1)');
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

  test('order cart panel with an item looks right', async () => {
    await page.goto('/');
    await expect(panel()).toBeVisible({ timeout: 10_000 });

    // Deterministic content: one seeded service, a fixed link and quantity.
    await cards().nth(0).getByRole('button', { name: /^pay$/i }).click();
    await panel()
      .getByLabel(/add a link/i)
      .first()
      .fill('https://youtube.com/watch?v=visual');
    await expect(panel().getByRole('button', { name: /pay \$/i })).toBeVisible();

    await expect(panel()).toHaveScreenshot('order-panel-with-item.png', {
      animations: 'disabled',
    });
  });
});
