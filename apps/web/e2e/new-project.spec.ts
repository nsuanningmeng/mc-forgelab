import { test, expect } from '@playwright/test';

test.describe('New Project Form (Anti-Regression)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-projects').click();
  });

  test.afterEach(async ({ page }) => {
    // Clean up: close form if still open
    const closeBtn = page.getByTestId('close-project-form');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test('v0.3.5 Regression: Select MC Version THEN Target', async ({ page }) => {
    await page.getByTestId('new-project-btn').click();
    
    // 1. Select MC Version first
    const mcSelect = page.getByTestId('project-mcVersion');
    await mcSelect.selectOption('1.21.4');
    await expect(mcSelect).toHaveValue('1.21.4');

    // 2. Select Target
    const targetSelect = page.getByTestId('project-targetId');
    await targetSelect.selectOption('paper');
    await expect(targetSelect).toHaveValue('paper');

    // 3. Fill name and submit
    await page.getByTestId('project-name').fill('e2e-order-mc-first');
    await page.getByTestId('project-create-btn').click();

    // 4. Verify card appears
    await expect(page.getByTestId('project-card').filter({ hasText: 'e2e-order-mc-first' })).toBeVisible({ timeout: 10000 });
  });

  test('Standard Flow: Select Target THEN MC Version', async ({ page }) => {
    await page.getByTestId('new-project-btn').click();

    // 1. Select Target first
    const targetSelect = page.getByTestId('project-targetId');
    await targetSelect.selectOption('spigot');
    await expect(targetSelect).toHaveValue('spigot');

    // 2. Select MC Version
    const mcSelect = page.getByTestId('project-mcVersion');
    await mcSelect.selectOption('1.20.1');
    await expect(mcSelect).toHaveValue('1.20.1');

    // 3. Fill name and submit
    await page.getByTestId('project-name').fill('e2e-order-target-first');
    await page.getByTestId('project-create-btn').click();

    // 4. Verify card appears
    await expect(page.getByTestId('project-card').filter({ hasText: 'e2e-order-target-first' })).toBeVisible({ timeout: 10000 });
  });
});
