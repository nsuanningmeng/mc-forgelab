/**
 * MC-ForgeLab SSE 构建事件契约
 *
 * 路径：GET /api/projects/:projectId/builds/:buildId/stream
 * Content-Type: text/event-stream
 * 客户端使用 EventSource API；服务器附 Last-Event-ID 支持。
 *
 * 此文件定义所有可能的 event 类型 + 各自 data payload。
 * 后端发出 / 前端消费 / 测试均共享此契约。
 *
 * @stage 5
 */

export type BuildEventType =
  | "build.queued"
  | "build.started"
  | "build.progress"
  | "build.log"
  | "build.compat"
  | "build.error"
  | "build.done";

export interface BuildQueuedEvent {
  readonly type: "build.queued";
  readonly buildId: string;
  readonly projectId: string;
  readonly queuePosition: number;
  readonly enqueuedAt: string;
}

export interface BuildStartedEvent {
  readonly type: "build.started";
  readonly buildId: string;
  readonly projectId: string;
  readonly startedAt: string;
  readonly stages: ReadonlyArray<{ id: string; displayName: string }>;
}

export interface BuildProgressEvent {
  readonly type: "build.progress";
  readonly buildId: string;
  /** Current stage id (matches stages[].id from `build.started`) */
  readonly stage: string;
  /** 0-100 inclusive; -1 if unknown */
  readonly percent: number;
}

export interface BuildLogEvent {
  readonly type: "build.log";
  readonly buildId: string;
  readonly line: string;
  readonly stream: "stdout" | "stderr";
  readonly ts: string;
}

export interface BuildCompatEvent {
  readonly type: "build.compat";
  readonly buildId: string;
  readonly code: string;
  readonly level: "info" | "warning" | "error";
  readonly messageZh: string;
  readonly messageEn: string;
  readonly fixSuggestionZh?: string;
  readonly fixSuggestionEn?: string;
  readonly blocking: boolean;
}

export interface BuildErrorEvent {
  readonly type: "build.error";
  readonly buildId: string;
  readonly code: string;
  readonly messageZh: string;
  readonly messageEn: string;
  readonly errorSummary: string;
}

export interface BuildDoneEvent {
  readonly type: "build.done";
  readonly buildId: string;
  readonly status: "success" | "failed" | "canceled" | "interrupted";
  readonly finishedAt: string;
  readonly artifacts: ReadonlyArray<{
    readonly artifactId: string;
    readonly fileName: string;
    readonly type: "jar" | "zip" | "source" | "log" | "manifest";
    readonly sha256: string;
    readonly sizeBytes: number;
  }>;
  readonly durationMs: number;
}

export type BuildEvent =
  | BuildQueuedEvent
  | BuildStartedEvent
  | BuildProgressEvent
  | BuildLogEvent
  | BuildCompatEvent
  | BuildErrorEvent
  | BuildDoneEvent;

/**
 * SSE 帧封装格式（用于服务端 serializer 与客户端 parser）：
 *
 *   id: <monotonic-seq>\n
 *   event: build.log\n
 *   data: <JSON.stringify(payload)>\n
 *   \n
 *
 * - Last-Event-ID 头由客户端断线重连发送
 * - 服务端必须在该 build 的内存环形缓冲（默认 2000 条）中能 replay 该 ID 之后的事件
 */
export const SSE_BUFFER_SIZE = 2000;
