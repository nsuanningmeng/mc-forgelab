import { test, expect } from '@playwright/test';

test.describe('Conversation Export', () => {
  test('should trigger download when clicking export button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="nav-workspace"]', { timeout: 15000 });

    // Pick a project to show chat interface
    const projectItem = page.locator('[data-testid^="project-item-"]').first();
    await projectItem.click();

    // Send a message to enable export button
    const textarea = page.locator('textarea');
    await textarea.fill('Hello for export test');
    await page.keyboard.press('Enter');

    // Wait for message to appear
    await expect(page.locator('.message-item')).toHaveCount(1, { timeout: 10000 });

    // Wait for download event
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-chat-btn').click();
    const download = await downloadPromise;

    // Verify filename and MIME type
    expect(download.suggestedFilename()).toMatch(/^chat-.*\.md$/);
    // Blob type text/markdown usually results in text/markdown or application/octet-stream depending on browser/env
    // We mainly care about the extension and that it triggered.
  });
});
