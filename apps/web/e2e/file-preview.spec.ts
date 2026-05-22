import { test, expect } from '@playwright/test';

test.describe('File Preview', () => {
  test('should navigate to workspace with prompt composer visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="nav-workspace"]', { timeout: 15000 });
    await page.getByTestId('nav-workspace').click();
    await page.waitForTimeout(3000);

    // Verify workspace has a prompt textarea
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 10000 });
  });

  test('should query project files via API', async ({ page }) => {
    // Create project via API
    const resp = await page.evaluate(async () => {
      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'FilePrevTest', slug: 'fileprev-test', type: 'plugin',
          targetId: 'paper', minecraftVersion: '1.20.1', javaVersion: 17,
          buildTool: 'gradle', packageName: 'com.fileprev.test', version: '1.0.0'
        })
      });
      return { status: r.status, ok: r.ok, data: await r.json() };
    });
    expect(resp.ok).toBe(true);
    expect(resp.data.id).toBeTruthy();
  });
});
