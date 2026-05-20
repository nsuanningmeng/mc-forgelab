import { test, expect } from '@playwright/test';

test.describe('Project Deletion', () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    // Seed data via API
    const res = await request.post('/api/projects', {
      data: { 
        name: 'delete-me', 
        targetId: 'paper', 
        minecraftVersion: '1.21.4',
        packageName: 'com.example.delete'
      }
    });
    const project = await res.json();
    projectId = project.id;
  });

  test('should delete project from listing', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to Projects page if not already there
    await page.getByTestId('nav-projects').click();

    const card = page.getByTestId('project-card').filter({ hasText: 'delete-me' });
    await expect(card).toBeVisible({ timeout: 10000 });

    // Setup dialog listener before clicking delete
    page.once('dialog', dialog => dialog.accept());
    
    // Click delete button inside the card
    await card.getByTestId('delete-project-btn').click();

    // Verify card is gone
    await expect(card).not.toBeVisible({ timeout: 10000 });
  });
});
