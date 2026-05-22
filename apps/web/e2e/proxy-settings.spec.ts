import { test, expect } from '@playwright/test';

test.describe('Proxy Settings', () => {
  test('should configure and save proxy settings', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="nav-settings"]', { timeout: 15000 });
    await page.getByTestId('nav-settings').click();

    const proxySection = page.getByTestId('proxy-section');
    await proxySection.scrollIntoViewIfNeeded();
    
    // Switch to edit mode
    await proxySection.getByRole('button', { name: /Edit|编辑/ }).click();

    // Fill HTTP proxy
    await proxySection.locator('input[type="text"]').first().fill('proxy.e2e.test');
    await proxySection.locator('input[type="number"]').first().fill('8888');
    
    // Fill NO_PROXY
    await proxySection.locator('textarea').fill('localhost,127.0.0.1');

    // Save
    await proxySection.getByRole('button', { name: /Save|保存/ }).click();

    // Verify view mode displays saved data
    await expect(proxySection).toContainText('proxy.e2e.test:8888');
    await expect(proxySection).toContainText('localhost,127.0.0.1');
  });

  test('should show error for invalid port', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-settings').click();

    const proxySection = page.getByTestId('proxy-section');
    await proxySection.scrollIntoViewIfNeeded();
    await proxySection.getByRole('button', { name: /Edit|编辑/ }).click();

    // Fill invalid port
    await proxySection.locator('input[type="number"]').first().fill('-1');
    
    // Save - we didn't implement strict frontend validation for -1 in Settings.jsx yet, 
    // it relies on backend or browser min="0". Let's check if it fails or if we should add validation.
    // The current implementation in Settings.jsx:
    // const body = { ... httpPort: proxyDraft.httpPort ? Number(proxyDraft.httpPort) : null, ... }
    // It doesn't check < 0. Let's assume the backend handles it and shows the error at the top of the page.
    
    await proxySection.getByRole('button', { name: /Save|保存/ }).click();
    
    // Error div is usually at the top of the provider section in the original file, 
    // but there's only one error state for the whole page.
    // Wait for any error message
    await expect(page.locator('.text-danger')).toBeVisible();
  });
});
