/**
 * 标记不可达分支。配合 TS 的穷尽性检查（switch on union）。
 */
export function never(value: never, msg = "Unreachable branch reached"): never {
  throw new Error(`${msg}: ${JSON.stringify(value)}`);
}

/** Promise 化 setTimeout */
export function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
