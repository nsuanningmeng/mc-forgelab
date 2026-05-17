/**
 * 基础类型定义。所有类型均为结构化、可序列化（除 Promise 包装外）。
 */

export type MaybePromise<T> = T | Promise<T>;

/** Rust 风格 Result，用于不希望抛异常的边界 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type JsonPrimitive = string | number | boolean | null;
export interface JsonObject {
  [k: string]: JsonValue;
}
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/** 名义类型 / branded type，用于区分相同基础类型的不同语义 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** 深度只读 */
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;
