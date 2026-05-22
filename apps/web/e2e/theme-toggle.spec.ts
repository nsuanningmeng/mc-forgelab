import { test, expect } from '@playwright/test';

// theme-toggle.spec.ts — mc-forgelab uses `<html data-theme="dark|light">`
// (set by apps/web/public/ui/lib/theme.js) — NOT a class. localStorage key
// is "mcfl.theme". Default theme is "system" which resolves to dark/light
// based on prefers-color-scheme.
test.describe('Theme Toggle Persistence', () => {
  test('switching theme persists across reload', async ({ page }) => {
    await page.goto('/');

    // Wait for Babel Standalone to process scripts and initialize MCFL namespace
    await page.waitForFunction(() => window['MCFL'] && window['MCFL'].theme, { timeout: 15000 });

    const html = page.locator('html');

    // Navigate to Settings and set dark theme explicitly.
    await page.waitForSelector('[data-testid="nav-settings"]', { timeout: 15000 });
    await page.getByTestId('nav-settings').click();
    const themeDark = page.getByTestId('theme-dark');
    await themeDark.scrollIntoViewIfNeeded({ timeout: 10000 });
    await expect(themeDark).toBeVisible({ timeout: 5000 });
    await themeDark.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Switch to light.
    const themeLight = page.getByTestId('theme-light');
    await themeLight.scrollIntoViewIfNeeded({ timeout: 10000 });
    await expect(themeLight).toBeVisible({ timeout: 5000 });
    await themeLight.click();
    await expect(html).toHaveAttribute('data-theme', 'light');

    // localStorage key is `mcfl.theme` (NOT `mcfl-theme`) — see theme.js:3.
    const stored = await page.evaluate(() => localStorage.getItem('mcfl.theme'));
    expect(stored).toBe('light');

    // Persist across reload.
    await page.reload();
    await page.waitForFunction(() => window['MCFL'] && window['MCFL'].theme, { timeout: 15000 });
    await expect(html).toHaveAttribute('data-theme', 'light');

    // Reset to system for subsequent tests.
    await page.waitForSelector('[data-testid="nav-settings"]', { timeout: 15000 });
    await page.getByTestId('nav-settings').click();
    const themeSystem = page.getByTestId('theme-system');
    await themeSystem.scrollIntoViewIfNeeded({ timeout: 10000 });
    await expect(themeSystem).toBeVisible({ timeout: 5000 });
    await themeSystem.click();
  });
});
