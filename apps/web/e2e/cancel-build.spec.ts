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
  test('should start build via API', async ({ request }) => {
    const project = await createProject(request, uniqueName('api-build'));
    const build = await startBuild(request, project.id);
    expect(build.projectId).toBe(project.id);
    expect(build.buildId).toBeTruthy();
  });

  test('should cancel build via API and reach terminal state', async ({ request }) => {
    const project = await createProject(request, uniqueName('api-cancel'));
    const build = await startBuild(request, project.id);

    const cancelRes = await request.delete(`/api/projects/${project.id}/builds/${build.buildId}`);
    expect([202, 409]).toContain(cancelRes.status());

    const finalBuild = await waitForCancelOutcome(request, project.id, build.buildId);
    expect(Array.from(TERMINAL_CANCEL_OUTCOMES)).toContain(finalBuild.status);
  });
});
