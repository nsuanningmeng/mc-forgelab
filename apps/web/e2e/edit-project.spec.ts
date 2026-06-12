import { test, expect } from '@playwright/test';

test.describe('Project Editing', () => {
  test('should update target/version/name via API', async ({ request }) => {
    const createRes = await request.post('/api/projects', {
      data: {
        name: `edit-me-${Date.now()}`,
        targetId: 'paper',
        minecraftVersion: '1.20.1',
        packageName: 'com.example.editme'
      }
    });
    expect(createRes.status()).toBe(201);
    const project = await createRes.json();
    expect(project.java_version).toBe(17);

    // PATCH target + version + name; java version must follow the MC version
    const patchRes = await request.patch(`/api/projects/${project.id}`, {
      data: { name: 'Renamed Plugin', targetId: 'purpur', minecraftVersion: '1.21.4' }
    });
    expect(patchRes.status()).toBe(200);
    const updated = await patchRes.json();
    expect(updated.name).toBe('Renamed Plugin');
    expect(updated.target_id).toBe('purpur');
    expect(updated.minecraft_version).toBe('1.21.4');
    expect(updated.java_version).toBe(21);

    // Validation: bad version is rejected, project untouched
    const badRes = await request.patch(`/api/projects/${project.id}`, {
      data: { minecraftVersion: 'not-a-version' }
    });
    expect(badRes.status()).toBe(400);
    const after = await (await request.get(`/api/projects/${project.id}`)).json();
    expect(after.minecraft_version).toBe('1.21.4');

    await request.delete(`/api/projects/${project.id}`);
  });

  test('should edit project from the detail page UI', async ({ page, request }) => {
    const projectName = `ui-edit-${Date.now()}`;
    const createRes = await request.post('/api/projects', {
      data: {
        name: projectName,
        targetId: 'paper',
        minecraftVersion: '1.20.1',
        packageName: 'com.example.uiedit'
      }
    });
    expect(createRes.status()).toBe(201);
    const project = await createRes.json();

    await page.goto('/');
    // Select the project from the sidebar, then open the editor via the
    // workspace header chip (the only project-edit entry point in the UI).
    await page.waitForSelector('[data-testid="project-card"]', { timeout: 15000 });
    await page.getByTestId('project-card').filter({ hasText: projectName }).first().click();

    const chip = page.getByTestId('project-chip-edit');
    await expect(chip).toContainText(projectName, { timeout: 10000 });
    await chip.click();

    const form = page.getByTestId('project-edit-form');
    await expect(form).toBeVisible();

    await form.getByTestId('edit-project-name').fill(`${projectName}-renamed`);

    // Switch target via the custom dropdown
    await form.getByTestId('edit-project-targetId-trigger').click();
    await page.getByRole('listbox').getByText('Purpur', { exact: false }).first().click();

    await page.getByTestId('edit-project-save-btn').click();
    await expect(form).not.toBeVisible({ timeout: 10000 });
    await expect(chip).toContainText(`${projectName}-renamed`);
    await expect(chip).toContainText('Purpur');

    const after = await (await request.get(`/api/projects/${project.id}`)).json();
    expect(after.name).toBe(`${projectName}-renamed`);
    expect(after.target_id).toBe('purpur');

    await request.delete(`/api/projects/${project.id}`);
  });
});
