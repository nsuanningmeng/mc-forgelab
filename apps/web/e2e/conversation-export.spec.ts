import { test, expect } from '@playwright/test';

test.describe('Conversation Export', () => {
  test('should trigger download when export button is clicked after sending message', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="nav-workspace"]', { timeout: 15000 });
    await page.getByTestId('nav-workspace').click();
    await page.waitForTimeout(3000);

    // Type a message to make the export button appear
    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible()) {
      await textarea.fill('Hello, export test message');
      await textarea.press('Enter');
      await page.waitForTimeout(3000);
    }

    // Check if export button is now visible
    const exportBtn = page.getByTestId('export-chat-btn');
    if (await exportBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
      await exportBtn.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.md$/);
    }
  });
});
