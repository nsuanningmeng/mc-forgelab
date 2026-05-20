import { test, expect } from '@playwright/test';

test.describe('New Project Form (Anti-Regression)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-projects').click();
  });

  test.afterEach(async ({ page }) => {
    // Clean up: close form if still open
    try {
      const closeBtn = page.getByTestId('close-project-form');
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click({ timeout: 2000 });
      }
    } catch {
      // Form already closed or page navigated away
    }
  });

  test('v0.3.5 Regression: Select MC Version THEN Target', async ({ page }) => {
    await page.getByTestId('new-project-btn').click();

    // 1. Select MC Version first (custom dropdown)
    await page.getByTestId('project-mcVersion-trigger').click();
    await page.getByRole('listbox').getByText('1.21.4').click();
    await expect(page.getByTestId('project-mcVersion-trigger')).toContainText('1.21.4');

    // 2. Select Target (custom dropdown) — displayName is "Paper" (capital P)
    await page.getByTestId('project-targetId-trigger').click();
    await page.getByRole('listbox').getByText('Paper', { exact: true }).click();
    await expect(page.getByTestId('project-targetId-trigger')).toContainText('Paper');

    // 3. Fill name and submit
    await page.getByTestId('project-name').fill('e2e-order-mc-first');
    await page.getByTestId('project-create-btn').click();

    // 4. Verify card appears — use .first() to handle duplicates from shared :memory: DB
    await expect(page.getByTestId('project-card').filter({ hasText: 'e2e-order-mc-first' }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Standard Flow: Select Target THEN MC Version', async ({ page }) => {
    await page.getByTestId('new-project-btn').click();

    // 1. Select Target first (custom dropdown) — displayName is "Spigot" (capital S)
    await page.getByTestId('project-targetId-trigger').click();
    await page.getByRole('listbox').getByText('Spigot', { exact: true }).click();
    await expect(page.getByTestId('project-targetId-trigger')).toContainText('Spigot');

    // 2. Select MC Version (custom dropdown)
    await page.getByTestId('project-mcVersion-trigger').click();
    await page.getByRole('listbox').getByText('1.20.1').click();
    await expect(page.getByTestId('project-mcVersion-trigger')).toContainText('1.20.1');

    // 3. Fill name and submit
    await page.getByTestId('project-name').fill('e2e-order-target-first');
    await page.getByTestId('project-create-btn').click();

    // 4. Verify card appears — use .first() to handle duplicates from shared :memory: DB
    await expect(page.getByTestId('project-card').filter({ hasText: 'e2e-order-target-first' }).first()).toBeVisible({ timeout: 10000 });
  });
});
