import { test, expect } from '@playwright/test';

test.describe('AI Settings CRUD', () => {
  test('should manage Providers and Profiles', async ({ page }) => {
    await page.goto('/');
    // Wait for Babel Standalone to finish transpiling
    await page.waitForSelector('[data-testid="nav-settings"]', { timeout: 15000 });
    await page.getByTestId('nav-settings').click();

    // 1. Create Provider
    const providerSection = page.getByTestId('ai-providers-section');
    await providerSection.scrollIntoViewIfNeeded({ timeout: 10000 });
    await expect(providerSection).toBeVisible({ timeout: 10000 });
    await providerSection.getByTestId('add-provider-btn').click();

    await page.getByTestId('provider-displayName').fill('E2E Provider');
    await page.getByTestId('provider-baseUrl').fill('http://localhost:9999/v1');
    await page.getByTestId('provider-apiKey').fill('mock-key');
    await page.getByTestId('provider-save-btn').click();

    await expect(providerSection).toContainText('E2E Provider', { timeout: 10000 });

    // 2. Create Model Profile
    const profileSection = page.getByTestId('model-profiles-section');
    await profileSection.getByTestId('add-profile-btn').click();

    await page.getByTestId('profile-name').fill('E2E Profile');

    // Select Provider (custom dropdown) — use .first() in case of duplicates from shared :memory: DB
    await page.getByTestId('profile-providerId-trigger').click();
    await page.getByRole('listbox').getByText('E2E Provider').first().click();

    await page.getByTestId('profile-model').fill('gpt-4o-mock');

    // Select Role (custom dropdown) — Chinese locale: "编码模型" for codeModel
    await page.getByTestId('profile-role-trigger').click();
    await page.getByRole('listbox').getByText('编码模型').click();

    await page.getByTestId('profile-save-btn').click();

    await expect(profileSection).toContainText('E2E Profile', { timeout: 10000 });

    // 3. Delete all E2E Profiles (persistent DB may have leftovers from prior runs)
    page.on('dialog', dialog => dialog.accept());
    const deleteBtns = profileSection.getByTestId('delete-profile-btn');
    while (await deleteBtns.count() > 0) {
      await deleteBtns.first().click();
      await page.waitForTimeout(300);
    }

    await expect(profileSection).not.toContainText('E2E Profile', { timeout: 10000 });
  });
});
