import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, unwrap, unwrapOr, map, mapErr } from "./result.js";
import { resolveInsideBase, isPathInsideBase, isSafeFileName, PathEscapeError } from "./paths.js";

describe("Result", () => {
  it("ok / err", () => {
    expect(isOk(ok(1))).toBe(true);
    expect(isErr(err("x"))).toBe(true);
  });

  it("unwrap throws on err", () => {
    expect(() => unwrap(err(new Error("boom")))).toThrow("boom");
  });

  it("unwrapOr returns fallback on err", () => {
    expect(unwrapOr(err("x"), 42)).toBe(42);
    expect(unwrapOr(ok(7), 42)).toBe(7);
  });

  it("map / mapErr", () => {
    expect(unwrap(map(ok(2), (x) => x * 10))).toBe(20);
    expect(isErr(map(err("e"), () => 1))).toBe(true);
    const mapped = mapErr(err(new Error("a")), (e) => e.message);
    expect(isErr(mapped) ? mapped.error : null).toBe("a");
  });
});

describe("paths", () => {
  it("resolveInsideBase accepts relative paths", () => {
    const base = process.cwd();
    expect(resolveInsideBase(base, "foo/bar.txt").includes("foo")).toBe(true);
  });

  it("resolveInsideBase rejects parent traversal", () => {
    const base = process.cwd();
    expect(() => resolveInsideBase(base, "../escape.txt")).toThrow(PathEscapeError);
  });

  it("resolveInsideBase rejects absolute path outside base", () => {
    const base = process.cwd();
    const outside = process.platform === "win32" ? "C:\\Windows\\System32" : "/etc/passwd";
    expect(() => resolveInsideBase(base, outside)).toThrow(PathEscapeError);
  });

  it("isPathInsideBase does not throw", () => {
    const base = process.cwd();
    expect(isPathInsideBase(base, "../x")).toBe(false);
    expect(isPathInsideBase(base, "sub/x")).toBe(true);
  });

  it("isSafeFileName rejects dangerous inputs", () => {
    expect(isSafeFileName("ok.txt")).toBe(true);
    expect(isSafeFileName("")).toBe(false);
    expect(isSafeFileName(".")).toBe(false);
    expect(isSafeFileName("..")).toBe(false);
    expect(isSafeFileName("a/b")).toBe(false);
    expect(isSafeFileName("a\\b")).toBe(false);
    expect(isSafeFileName("CON.txt")).toBe(false);
    expect(isSafeFileName("PRN")).toBe(false);
    expect(isSafeFileName("trail. ")).toBe(false);
    expect(isSafeFileName("ok-name_2.jar")).toBe(true);
  });
});
