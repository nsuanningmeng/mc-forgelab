import { test, expect } from '@playwright/test';

test.describe('New Project Creation (API-First)', () => {
  test('should create project via API', async ({ request }) => {
    const projectName = `e2e-api-project-${Date.now()}`;

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
    expect(project.target_id).toBe('paper');
  });

  test('should list project via API after creation', async ({ request }) => {
    const projectName = `e2e-list-project-${Date.now()}`;

    await request.post('/api/projects', {
      data: {
        name: projectName,
        targetId: 'spigot',
        minecraftVersion: '1.20.1',
        packageName: 'com.example.list'
      }
    });

    const listRes = await request.get('/api/projects');
    expect(listRes.status()).toBe(200);
    const projects = await listRes.json();
    const found = projects.find((p: { name: string }) => p.name === projectName);
    expect(found).toBeTruthy();
  });
});
