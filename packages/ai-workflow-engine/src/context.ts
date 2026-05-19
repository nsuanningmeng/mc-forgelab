export interface WorkflowContextSnapshot {
  userPrompt?: string;
  projectId?: string;
  projectContext?: string;
  requirementSpec?: string;
  projectPlan?: string;
  initialFiles?: string;
  filePatch?: string;
  patchResult?: string;
  buildLog?: string;
  artifacts?: string;
  finalSummary?: string;
  buildResult?: {
    status: "success" | "failed";
    log?: string;
    errorSummary?: string;
  };
}

type WorkflowContextKey = keyof WorkflowContextSnapshot;

const KNOWN_KEYS = new Set<string>([
  "userPrompt",
  "projectId",
  "projectContext",
  "requirementSpec",
  "projectPlan",
  "initialFiles",
  "filePatch",
  "patchResult",
  "buildLog",
  "artifacts",
  "finalSummary",
  "buildResult"
]);

export function createContext(initial: Partial<WorkflowContextSnapshot>): WorkflowContextSnapshot {
  return { ...initial };
}

export function resolveStepInputs(snapshot: WorkflowContextSnapshot, inputKeys: readonly string[] = []): Record<string, string> {
  const result: Record<string, string> = {};
  const record = snapshot as Record<string, unknown>;

  for (const key of inputKeys) {
    const value = record[key];
    if (value === undefined || value === null) {
      result[key] = "";
    } else if (typeof value === "object") {
      result[key] = JSON.stringify(value);
    } else {
      result[key] = String(value);
    }
  }

  return result;
}

export function applyStepOutput(snapshot: WorkflowContextSnapshot, outputKey: string | undefined, value: unknown): void {
  if (!outputKey || !KNOWN_KEYS.has(outputKey)) return;

  if (outputKey === "buildResult") {
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value) as WorkflowContextSnapshot["buildResult"];
        snapshot.buildResult = parsed;
      } catch {
        snapshot.buildResult = { status: "failed", errorSummary: value };
      }
    } else if (value && typeof value === "object") {
      snapshot.buildResult = value as WorkflowContextSnapshot["buildResult"];
    }
    return;
  }

  const key = outputKey as WorkflowContextKey;
  if (key !== "buildResult") {
    snapshot[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
}
