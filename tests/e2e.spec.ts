/**
 * Optional Playwright smoke test. Run via `npx playwright test tests/e2e.spec.ts`.
 * Skipped automatically by scripts/launch_check.sh when playwright is not
 * installed (keeps the base toolchain light).
 *
 * What it verifies:
 *   1. Homepage loads
 *   2. Some P(win) cell renders a non-zero percentage after hydration +
 *      initial sim fetch (covers the "frontend shows 0.0% forever" bug class)
 *   3. Changing the pace scenario updates the probabilities
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.DEPLOY_URL || 'https://derby1m.vercel.app';

test.describe('Derby/1M homepage', () => {
  test('renders non-zero probabilities and updates on scenario change', async ({
    page,
  }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });

    // After initial /api/simulate response, some P(win) cell > 0%
    const pctCell = page.locator('span', { hasText: /\d{1,2}\.\d%/ }).first();
    await expect(pctCell).toBeVisible({ timeout: 20_000 });
    const before = await pctCell.innerText();
    expect(before).not.toBe('0.0%');
    expect(before).not.toBe('—');

    // Click "Fast" in the Pace control row (label comes from the segmented
    // control in components/scenario-controls.tsx).
    const paceFast = page.getByRole('radio', { name: 'Fast' }).last();
    await paceFast.click();

    // Wait for a different value in the same cell. Debounced 400ms + sim.
    await expect(pctCell).not.toHaveText(before, { timeout: 10_000 });
  });
});
