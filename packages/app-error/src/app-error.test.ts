import { describe, it, expect } from "vitest";
import { AppError, isAppError, toHttpError, wrapUnknown, ErrorCode } from "./index.js";

describe("AppError", () => {
  it("uses default catalog entry when no overrides", () => {
    const e = new AppError(ErrorCode.TARGET_NOT_FOUND);
    expect(e.code).toBe("MCF_TARGET_NOT_FOUND");
    expect(e.httpStatus).toBe(404);
    expect(e.messageZh).toContain("目标端");
    expect(e.messageEn).toContain("Target");
    expect(e.severity).toBe("error");
  });

  it("respects overrides", () => {
    const e = new AppError(ErrorCode.CORE_INVALID_INPUT, {
      messageZh: "自定义中文",
      messageEn: "Custom EN",
      httpStatus: 418,
      severity: "warning",
      details: { field: "minecraftVersion" }
    });
    expect(e.messageZh).toBe("自定义中文");
    expect(e.messageEn).toBe("Custom EN");
    expect(e.message).toBe("Custom EN");
    expect(e.httpStatus).toBe(418);
    expect(e.severity).toBe("warning");
    expect(e.details).toEqual({ field: "minecraftVersion" });
  });

  it("preserves cause", () => {
    const cause = new Error("boom");
    const e = new AppError(ErrorCode.STORAGE_QUERY_FAILED, { cause });
    expect(e.cause).toBe(cause);
  });

  it("toJSON returns serialisable shape", () => {
    const e = new AppError(ErrorCode.CONFIG_LOAD_FAILED);
    const json = e.toJSON();
    expect(json.name).toBe("AppError");
    expect(json.code).toBe("MCF_CONFIG_LOAD_FAILED");
    expect(JSON.stringify(json)).toContain("MCF_CONFIG_LOAD_FAILED");
  });
});

describe("isAppError / wrapUnknown / toHttpError", () => {
  it("isAppError distinguishes AppError vs Error", () => {
    expect(isAppError(new AppError(ErrorCode.CORE_INTERNAL))).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
    expect(isAppError("string")).toBe(false);
  });

  it("wrapUnknown preserves AppError", () => {
    const original = new AppError(ErrorCode.CORE_INTERNAL);
    expect(wrapUnknown(original)).toBe(original);
  });

  it("wrapUnknown converts Error", () => {
    const wrapped = wrapUnknown(new Error("io"));
    expect(wrapped).toBeInstanceOf(AppError);
    expect(wrapped.messageEn).toBe("io");
    expect(wrapped.cause).toBeInstanceOf(Error);
  });

  it("toHttpError hides stack by default", () => {
    const { status, body } = toHttpError(new AppError(ErrorCode.API_NOT_FOUND));
    expect(status).toBe(404);
    expect(body.stack).toBeUndefined();
  });

  it("toHttpError includes stack when requested", () => {
    const { body } = toHttpError(new AppError(ErrorCode.API_NOT_FOUND), { includeStack: true });
    expect(typeof body.stack).toBe("string");
  });
});
