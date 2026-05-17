import { readFileSync } from "node:fs";
import type { ErrorAnalysis, BuildErrorFinding, BuildErrorLocation } from "./types.js";

const MAX_CHARS = 20_000;
const MAX_FINDINGS = 50;

// Patterns: Java compiler, Gradle task failure, dependency resolution
const ERROR_PATTERNS: Array<{ re: RegExp; type: string; severity: "error" | "warning" }> = [
  { re: /^(.+\.(?:java|kt)):(\d+):\s+error:\s+(.+)$/m, type: "compile", severity: "error" },
  { re: /^(.+\.(?:java|kt)):(\d+):\s+warning:\s+(.+)$/m, type: "compile", severity: "warning" },
  { re: /FAILURE:\s+Build failed with an exception/m, type: "gradle", severity: "error" },
  { re: /Could not resolve (.+)/m, type: "dependency", severity: "error" },
  { re: /error:\s+cannot find symbol/m, type: "symbol", severity: "error" },
  { re: /error:\s+package (.+) does not exist/m, type: "import", severity: "error" },
  { re: /Exception in thread/m, type: "runtime", severity: "error" },
  { re: /Caused by:\s+(.+)/m, type: "cause", severity: "error" },
];

export function analyzeLog(buildLog: string, maxChars = MAX_CHARS): ErrorAnalysis {
  const truncated = buildLog.length > maxChars;
  const log = truncated ? buildLog.slice(0, maxChars) : buildLog;
  const lines = log.split("\n");

  const findings: BuildErrorFinding[] = [];
  const focusFiles = new Set<string>();

  for (const line of lines) {
    if (findings.length >= MAX_FINDINGS) break;
    for (const { re, type, severity } of ERROR_PATTERNS) {
      const m = line.match(re);
      if (!m) continue;
      const location: BuildErrorLocation = { filePath: m[1] ?? null, line: m[2] ? parseInt(m[2], 10) : null, column: null };
      if (location.filePath) focusFiles.add(location.filePath);
      findings.push({ message: m[3] ?? m[0] ?? line.trim(), type, severity, location, rawLine: line.trim() });
      break;
    }
  }

  // Compress: keep error blocks + last 20 lines
  const errorLines = lines.filter((l) => /error:|FAILED|Exception|Could not/i.test(l));
  const tail = lines.slice(-20);
  const compressedLog = [...new Set([...errorLines.slice(0, 30), ...tail])].join("\n");

  const likelyCause = findings.find((f) => f.type === "dependency")?.message
    ?? findings.find((f) => f.severity === "error")?.message
    ?? null;

  return {
    summary: findings.length > 0 ? `${findings.length} error(s) found` : "Build failed (no structured errors detected)",
    compressedLog,
    findings,
    likelyCause,
    suggestedFocusFiles: [...focusFiles].slice(0, 10),
    truncated,
  };
}

export async function analyzeLogFile(logPath: string, maxChars = MAX_CHARS): Promise<ErrorAnalysis> {
  const content = readFileSync(logPath, "utf8");
  return analyzeLog(content, maxChars);
}
