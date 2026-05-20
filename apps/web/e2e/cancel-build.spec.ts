import { test, expect } from '@playwright/test';

// cancel-build.spec.ts — anti-regression for the Builds page wiring.
// Verifies: project selection reaches the Builds page, start-build-btn is
// present and triggers POST /api/projects/:id/builds, and DELETE responds
// correctly whether the build is still running or already terminal.
//
// We deliberately do NOT click `cancel-build-btn` and assert the SSE-driven
// UI flip from "running" → "canceled". The host (and the e2e-web runner)
// has no JDK/Gradle, so runBuild() errors within milliseconds and the
// build is already `failed` by the time the test could reach it. Real
// cancel-while-running coverage lands in v0.3.9 with the Toolchains bootstrap.
test.describe('Cancel Build (Anti-Regression)', () => {
  test('start-build UI wires through to /api/projects/:id/builds and cancel endpoint responds', async ({ page, request }) => {
    // Auto-accept any window.confirm() that the UI might raise.
    page.on('dialog', (dialog) => { void dialog.accept(); });

    // 1. Seed project via API.
    const projectRes = await request.post('/api/projects', {
      data: {
        name: 'cancel-build-target',
        targetId: 'paper',
        minecraftVersion: '1.21.4',
        packageName: 'com.example.cancelbuild',
      },
    });
    expect(projectRes.status()).toBe(201);
    const project = await projectRes.json();

    // 2. Navigate to Projects, select our card. `.first()` is required:
    //    ProjectCard renders in both the Projects list AND the Builds page's
    //    own internal picker, so getByTestId('project-card').filter(...)
    //    matches twice and trips Playwright's strict-mode check otherwise.
    await page.goto('/');
    await page.getByTestId('nav-projects').click();
    await page.getByTestId('project-card').filter({ hasText: 'cancel-build-target' }).first().click();

    // 3. Jump to Builds. The Builds page consumes `selectedProject` (via
    //    the v0.3.6 prop-name fix in app.jsx) so start-build-btn renders.
    await page.getByTestId('nav-builds').click();

    const startBtn = page.getByTestId('start-build-btn');
    await expect(startBtn).toBeVisible({ timeout: 5_000 });
    await expect(startBtn).toBeEnabled();

    // 4. Click start: a build row must be created via POST.
    await startBtn.click();
    await expect.poll(async () => {
      const res = await request.get(`/api/projects/${project.id}/builds`);
      const list = await res.json();
      return list.length;
    }, { timeout: 10_000 }).toBeGreaterThan(0);

    const list = await (await request.get(`/api/projects/${project.id}/builds`)).json();
    const build = list[0];
    expect(build.projectId).toBe(project.id);

    // 5. Cancel endpoint reachable: 202 if still running, 409 if already terminal.
    const cancelRes = await request.delete(`/api/projects/${project.id}/builds/${build.buildId}`);
    expect([202, 409]).toContain(cancelRes.status());
  });
});
