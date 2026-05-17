/**
 * @mc-forgelab/core
 * 仅放无副作用的基础类型与工具。禁止从此包再导出业务包内容。
 */
export type { Result, MaybePromise, JsonValue, JsonObject, JsonArray, Brand, DeepReadonly } from "./types.js";
export { ok, err, isOk, isErr, unwrap, unwrapOr, map, mapErr } from "./result.js";
export {
  resolveInsideBase,
  isPathInsideBase,
  normalizeSlashes,
  isSafeFileName,
  PathEscapeError
} from "./paths.js";
export { sleep, never } from "./misc.js";
