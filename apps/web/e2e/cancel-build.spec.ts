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

const TERMINAL_CANCEL_OUTCOMES = new Set<BuildStatus>(['failed', 'canceled', 'success']);

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
  }, { timeout: 15_000 }).toBe(true);

  return latest as BuildSummary;
}

test.describe('Build Lifecycle (API-First)', () => {
  test('should start build via UI and verify via API', async ({ page, request }) => {
    // 1. Seed project via API
    const projectName = uniqueName('ui-build');
    const project = await createProject(request, projectName);

    // 2. Go to Projects and select the project to activate it
    await page.goto('/');
    await page.getByTestId('nav-projects').click();
    await page.getByTestId('project-card').filter({ hasText: projectName }).first().click();

    // 3. Go to Workspace (InspectorColumn is there)
    await page.getByTestId('nav-workspace').click();

    // 4. Go to Build tab in InspectorColumn
    await page.getByRole('button', { name: /Build/i }).click();

    const startBtn = page.getByTestId('start-build-btn');
    await expect(startBtn).toBeVisible({ timeout: 5_000 });
    
    // 5. Click start build
    await startBtn.click();

    // 6. Verify build created via API
    await expect.poll(async () => {
      const res = await request.get(`/api/projects/${project.id}/builds`);
      const list = (await res.json()) as BuildSummary[];
      return list.length;
    }, { timeout: 10_000 }).toBeGreaterThan(0);
  });

  test('should cancel build via API and reach terminal state', async ({ request }) => {
    const projectName = uniqueName('api-cancel');
    const project = await createProject(request, projectName);
    const build = await startBuild(request, project.id);

    // Cancel
    const cancelRes = await request.delete(`/api/projects/${project.id}/builds/${build.buildId}`);
    expect([202, 409]).toContain(cancelRes.status());

    // Verify terminal state
    const finalBuild = await waitForCancelOutcome(request, project.id, build.buildId);
    expect(Array.from(TERMINAL_CANCEL_OUTCOMES)).toContain(finalBuild.status);
  });
});
