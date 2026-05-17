import { describe, it, expect } from "vitest";
import { queryKnowledge, formatKnowledgeContext } from "./index.js";

describe("knowledge-base", () => {
  it("finds paper entries by keyword", () => {
    const r = queryKnowledge(["paper"]);
    expect(r.length).toBeGreaterThan(0);
    expect(r.some(e => e.id === "paper-main-class")).toBe(true);
  });
  it("finds fabric entries", () => {
    const r = queryKnowledge(["fabric"]);
    expect(r.some(e => e.id === "fabric-mod-json")).toBe(true);
  });
  it("returns empty for unknown keyword", () => {
    expect(queryKnowledge(["unknownxyz"])).toHaveLength(0);
  });
  it("formats context string", () => {
    const r = queryKnowledge(["folia"]);
    const ctx = formatKnowledgeContext(r);
    expect(ctx).toContain("Folia");
  });
});
