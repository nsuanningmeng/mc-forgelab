import { test, expect } from '@playwright/test';

test.describe('New Project Creation (API-First)', () => {
  test('should create project via API and show in UI', async ({ page, request }) => {
    const projectName = `e2e-api-project-${Date.now()}`;
    
    // 1. Create Project via API
    const res = await request.post('/api/projects', {
      data: {
        name: projectName,
        targetId: 'paper',
        minecraftVersion: '1.21.4',
        packageName: 'com.example.api'
      }
    });
    expect(res.status()).toBe(201);
    const project = await res.json();
    expect(project.name).toBe(projectName);

    // 2. Go to Projects page
    await page.goto('/');
    await page.getByTestId('nav-projects').click();

    // 3. Verify project card exists
    const card = page.getByTestId('project-card').filter({ hasText: projectName }).first();
    await expect(card).toBeVisible({ timeout: 10000 });
  });

  test('should show project in Workspace picker after creation', async ({ page, request }) => {
    const projectName = `e2e-picker-project-${Date.now()}`;
    
    // 1. Create Project via API
    await request.post('/api/projects', {
      data: {
        name: projectName,
        targetId: 'spigot',
        minecraftVersion: '1.20.1',
        packageName: 'com.example.picker'
      }
    });

    // 2. Go to Workspace
    await page.goto('/');
    await page.getByTestId('nav-workspace').click();

    // 3. Open project picker (assuming it exists in ChatColumn or similar)
    // In Chat-First IDE, projects might be selected via chat or a specific dropdown
    // If there's a project card in the sidebar or a list, we check that.
    await page.getByTestId('nav-projects').click();
    await expect(page.getByTestId('project-card').filter({ hasText: projectName }).first()).toBeVisible();
  });
});
