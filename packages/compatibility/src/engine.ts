import { AppError, ErrorCode } from "@mc-forgelab/app-error";
import type { TargetRegistry } from "@mc-forgelab/target-registry";
import type { CheckResult, CompatibilityContext, CompatibilityRule } from "./model.js";
import { builtinRules } from "./rules.js";

export interface EngineResult {
  readonly context: CompatibilityContext;
  readonly results: ReadonlyArray<CheckResult>;
  readonly hasBlocking: boolean;
  readonly counts: { info: number; warning: number; error: number; blocking: number };
}

export class CompatibilityEngine {
  constructor(
    private readonly registry: TargetRegistry,
    private readonly rules: ReadonlyArray<CompatibilityRule> = builtinRules
  ) {}

  evaluate(context: CompatibilityContext): EngineResult {
    const target = this.registry.find(context.targetId);
    if (!target) {
      throw new AppError(ErrorCode.TARGET_NOT_FOUND, { details: { id: context.targetId } });
    }

    const results: CheckResult[] = [];
    for (const rule of this.rules) {
      if (rule.appliesToTargetIds && !rule.appliesToTargetIds.includes(target.id)) {
        continue;
      }
      try {
        const ruleResults = rule.evaluate(context, target);
        for (const r of ruleResults) results.push(r);
      } catch (cause) {
        // 单条规则失败不影响其他规则；记入结果方便排查。
        results.push({
          level: "warning",
          code: "COMPAT_RULE_FAILED",
          messageZh: `规则 ${rule.id} 执行失败。`,
          messageEn: `Rule ${rule.id} failed to evaluate.`,
          blocking: false
        });
        void cause;
      }
    }

    let info = 0;
    let warning = 0;
    let error = 0;
    let blocking = 0;
    for (const r of results) {
      if (r.level === "info") info++;
      else if (r.level === "warning") warning++;
      else error++;
      if (r.blocking) blocking++;
    }

    return {
      context,
      results,
      hasBlocking: blocking > 0,
      counts: { info, warning, error, blocking }
    };
  }

  get version(): string {
    return "1.0.0";
  }
}

export function createDefaultEngine(registry: TargetRegistry): CompatibilityEngine {
  return new CompatibilityEngine(registry, builtinRules);
}
