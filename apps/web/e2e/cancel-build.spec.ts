import { test, expect, type APIRequestContext } from '@playwright/test';

type BuildStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled' | 'interrupted';

interface ProjectSummary {
  readonly id: string;
}

interface BuildSummary {
  readonly buildId: string;
  readonly projectId: string;
  readonly status: BuildStatus;
}

const TERMINAL_CANCEL_OUTCOMES = new Set<BuildStatus>(['failed', 'canceled']);

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createProject(request: APIRequestContext, name: string): Promise<ProjectSummary> {
  const projectRes = await request.post('/api/projects', {
    data: {
      name,
      targetId: 'paper',
      minecraftVersion: '1.21.4',
      packageName: 'com.example.cancelbuild',
    },
  });
  expect(projectRes.status()).toBe(201);
  return (await projectRes.json()) as ProjectSummary;
}

async function startBuild(request: APIRequestContext, projectId: string): Promise<BuildSummary> {
  const buildRes = await request.post(`/api/projects/${projectId}/builds`);
  expect(buildRes.status()).toBe(202);
  return (await buildRes.json()) as BuildSummary;
}

async function getBuild(request: APIRequestContext, projectId: string, buildId: string): Promise<BuildSummary> {
  const buildRes = await request.get(`/api/projects/${projectId}/builds/${buildId}`);
  expect(buildRes.status()).toBe(200);
  return (await buildRes.json()) as BuildSummary;
}

async function waitForCancelOutcome(
  request: APIRequestContext,
  projectId: string,
  buildId: string
): Promise<BuildSummary> {
  let latest: BuildSummary | undefined;

  await expect.poll(async () => {
    latest = await getBuild(request, projectId, buildId);
    return TERMINAL_CANCEL_OUTCOMES.has(latest.status);
  }, { timeout: 10_000 }).toBe(true);

  return latest as BuildSummary;
}

// cancel-build.spec.ts — anti-regression for the Builds page wiring.
// Verifies: project selection reaches the Builds page, start-build-btn is
// present and triggers POST /api/projects/:id/builds, and DELETE responds
// correctly whether the build is still running or already terminal.
//
// We deliberately do NOT click `cancel-build-btn` and assert the SSE-driven
// UI flip from "running" → "canceled". The host (and the e2e-web runner)
// has no JDK/Gradle, so runBuild() can fail within milliseconds. The API
// coverage below validates cancel semantics without depending on the UI's
// SSE timing window.
test.describe('Cancel Build (Anti-Regression)', () => {
  test('start-build UI wires through to /api/projects/:id/builds and cancel endpoint responds', async ({ page, request }) => {
    // Auto-accept any window.confirm() that the UI might raise.
    page.on('dialog', (dialog) => { void dialog.accept(); });

    // 1. Seed project via API.
    const projectName = uniqueName('cancel-build-target');
    const project = await createProject(request, projectName);

    // 2. Navigate to Projects, select our card. `.first()` is required:
    //    ProjectCard renders in both the Projects list AND the Builds page's
    //    own internal picker, so getByTestId('project-card').filter(...)
    //    matches twice and trips Playwright's strict-mode check otherwise.
    await page.goto('/');
    await page.getByTestId('nav-projects').click();
    await page.getByTestId('project-card').filter({ hasText: projectName }).first().click();

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
      const list = (await res.json()) as BuildSummary[];
      return list.length;
    }, { timeout: 10_000 }).toBeGreaterThan(0);

    const buildsRes = await request.get(`/api/projects/${project.id}/builds`);
    const list = (await buildsRes.json()) as BuildSummary[];
    const build = list[0];
    expect(build.projectId).toBe(project.id);

    // 5. Cancel endpoint reachable: 202 if still running, 409 if already terminal.
    const cancelRes = await request.delete(`/api/projects/${project.id}/builds/${build.buildId}`);
    expect([202, 409]).toContain(cancelRes.status());
  });

  test('API cancel leaves the build in a valid terminal status', async ({ request }) => {
    const project = await createProject(request, uniqueName('cancel-build-api'));
    const build = await startBuild(request, project.id);

    const cancelRes = await request.delete(`/api/projects/${project.id}/builds/${build.buildId}`);
    expect([202, 409]).toContain(cancelRes.status());

    const finalBuild = await waitForCancelOutcome(request, project.id, build.buildId);
    expect(Array.from(TERMINAL_CANCEL_OUTCOMES)).toContain(finalBuild.status);
  });
});
