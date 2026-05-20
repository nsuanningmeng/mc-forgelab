import { test, expect } from '@playwright/test';

test.describe('AI Settings CRUD', () => {
  test('should manage Providers and Profiles', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-settings').click();

    // 1. Create Provider
    const providerSection = page.getByTestId('ai-providers-section');
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
    await page.getByTestId('profile-providerId').selectOption({ label: 'E2E Provider' });
    await page.getByTestId('profile-model').fill('gpt-4o-mock');
    await page.getByTestId('profile-role').selectOption('codeModel');
    await page.getByTestId('profile-save-btn').click();

    await expect(profileSection).toContainText('E2E Profile', { timeout: 10000 });

    // 3. Delete Profile
    // Handle dialog
    page.once('dialog', dialog => dialog.accept());
    await profileSection.getByTestId('delete-profile-btn').click();
    
    await expect(profileSection).not.toContainText('E2E Profile', { timeout: 10000 });
  });
});
