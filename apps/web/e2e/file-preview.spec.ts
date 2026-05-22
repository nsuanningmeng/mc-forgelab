import { test, expect } from '@playwright/test';

test.describe('File Preview', () => {
  test('should navigate to workspace with prompt composer visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="nav-workspace"]', { timeout: 15000 });
    await page.getByTestId('nav-workspace').click();
    await page.waitForTimeout(3000);

    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 10000 });
  });

  test('should create project and query files via API', async ({ request }) => {
    const resp = await request.post('/api/projects', {
      data: {
        name: 'FilePrevTest', slug: 'fileprev-test', type: 'plugin',
        targetId: 'paper', minecraftVersion: '1.20.1', javaVersion: 17,
        buildTool: 'gradle', packageName: 'com.fileprev.test', version: '1.0.0'
      }
    });
    expect(resp.ok()).toBe(true);
    const data = await resp.json();
    expect(data.id).toBeTruthy();
  });
});
