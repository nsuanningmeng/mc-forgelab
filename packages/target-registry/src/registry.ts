import { AppError, ErrorCode } from "@mc-forgelab/app-error";
import type { Target, TargetSummary, TargetType } from "./target.js";
import { summarize } from "./target.js";
import { builtinTargets } from "./builtin.js";

export class TargetRegistry {
  private readonly byId = new Map<string, Target>();

  constructor(initial: ReadonlyArray<Target> = []) {
    for (const t of initial) this.register(t);
  }

  register(target: Target): void {
    if (this.byId.has(target.id)) {
      throw new AppError(ErrorCode.TARGET_DUPLICATE_ID, {
        details: { id: target.id }
      });
    }
    this.byId.set(target.id, target);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  get(id: string): Target {
    const t = this.byId.get(id);
    if (!t) {
      throw new AppError(ErrorCode.TARGET_NOT_FOUND, { details: { id } });
    }
    return t;
  }

  find(id: string): Target | undefined {
    return this.byId.get(id);
  }

  list(filter?: { type?: TargetType; includeLegacy?: boolean; includeDeprecated?: boolean }): Target[] {
    const includeLegacy = filter?.includeLegacy ?? false;
    const includeDeprecated = filter?.includeDeprecated ?? false;
    return Array.from(this.byId.values())
      .filter((t) => (filter?.type ? t.type === filter.type : true))
      .filter((t) => (includeLegacy ? true : !t.legacy))
      .filter((t) => (includeDeprecated ? true : !t.deprecated))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  summaries(filter?: { type?: TargetType }): TargetSummary[] {
    return this.list(filter).map(summarize);
  }

  get version(): string {
    return "1.0.0";
  }
}

/** 工厂：使用阶段 1 内置目标 */
export function createDefaultRegistry(): TargetRegistry {
  return new TargetRegistry(builtinTargets);
}
