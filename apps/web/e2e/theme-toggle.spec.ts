import { test, expect } from '@playwright/test';

// theme-toggle.spec.ts — mc-forgelab uses `<html data-theme="dark|light">`
// (set by apps/web/public/ui/lib/theme.js) — NOT a class. localStorage key
// is "mcfl.theme". Default theme is dark (see apps/web/public/index.html).
test.describe('Theme Toggle Persistence', () => {
  test('switching to light persists across reload', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');

    // Baseline: dark by default.
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Theme chips live on the Settings page.
    await page.waitForSelector('[data-testid="nav-settings"]', { timeout: 15000 });
    await page.getByTestId('nav-settings').click();
    await page.waitForSelector('[data-testid="theme-light"]', { timeout: 10000 });
    await page.getByTestId('theme-light').click();
    await expect(html).toHaveAttribute('data-theme', 'light');

    // localStorage key is `mcfl.theme` (NOT `mcfl-theme`) — see theme.js:3.
    const stored = await page.evaluate(() => localStorage.getItem('mcfl.theme'));
    expect(stored).toBe('light');

    // Persist across reload.
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'light');

    // Reset for any subsequent tests (workers=1 → shared browser state).
    await page.getByTestId('nav-settings').click();
    await page.getByTestId('theme-dark').click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });
});
