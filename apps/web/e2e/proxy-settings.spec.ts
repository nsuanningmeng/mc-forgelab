import { test, expect } from '@playwright/test';

test.describe('Proxy Settings', () => {
  test('should display proxy section on settings page', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="nav-settings"]', { timeout: 15000 });
    await page.getByTestId('nav-settings').click();

    const proxySection = page.getByTestId('proxy-section');
    await expect(proxySection).toBeVisible({ timeout: 10000 });
    await expect(proxySection).toContainText(/代理|Proxy/);
  });

  test('should open edit form and cancel returns to view', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="nav-settings"]', { timeout: 15000 });
    await page.getByTestId('nav-settings').click();

    const proxySection = page.getByTestId('proxy-section');
    await proxySection.scrollIntoViewIfNeeded();

    // Open edit form
    await proxySection.getByTestId('proxy-edit-btn').click();
    await expect(proxySection.getByTestId('proxy-http-input')).toBeVisible({ timeout: 5000 });

    // Cancel
    await proxySection.getByTestId('proxy-cancel-btn').click();
    await expect(proxySection.getByTestId('proxy-edit-btn')).toBeVisible({ timeout: 5000 });
  });
});
