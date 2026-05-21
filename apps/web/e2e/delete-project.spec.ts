import { test, expect } from '@playwright/test';

test.describe('Project Deletion (API-First)', () => {
  let projectId: string;
  let projectName: string;

  test.beforeEach(async ({ request }) => {
    projectName = `delete-me-${Date.now()}`;
    // Seed data via API
    const res = await request.post('/api/projects', {
      data: { 
        name: projectName, 
        targetId: 'paper', 
        minecraftVersion: '1.21.4',
        packageName: 'com.example.delete'
      }
    });
    const project = await res.json();
    projectId = project.id;
  });

  test('should delete project via UI and verify via API', async ({ page, request }) => {
    await page.goto('/');
    await page.getByTestId('nav-projects').click();

    const card = page.getByTestId('project-card').filter({ hasText: projectName }).first();
    await expect(card).toBeVisible({ timeout: 10000 });

    // Setup dialog listener before clicking delete
    page.once('dialog', dialog => dialog.accept());
    
    // Click delete button inside the card
    await card.getByTestId('delete-project-btn').click();

    // Verify card is gone from UI
    await expect(card).not.toBeVisible({ timeout: 10000 });

    // Verify gone from API
    const res = await request.get(`/api/projects/${projectId}`);
    expect(res.status()).toBe(404);
  });
});
