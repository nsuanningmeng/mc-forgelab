import { test, expect } from '@playwright/test';

test.describe('Project Deletion (API-First)', () => {
  test('should delete project via API', async ({ request }) => {
    const projectName = `delete-me-${Date.now()}`;

    // Create
    const createRes = await request.post('/api/projects', {
      data: {
        name: projectName,
        targetId: 'paper',
        minecraftVersion: '1.21.4',
        packageName: 'com.example.delete'
      }
    });
    expect(createRes.status()).toBe(201);
    const project = await createRes.json();

    // Verify exists
    const getRes = await request.get(`/api/projects/${project.id}`);
    expect(getRes.status()).toBe(200);

    // Delete
    const deleteRes = await request.delete(`/api/projects/${project.id}`);
    expect([200, 204]).toContain(deleteRes.status());

    // Verify gone
    const goneRes = await request.get(`/api/projects/${project.id}`);
    expect(goneRes.status()).toBe(404);
  });
});
