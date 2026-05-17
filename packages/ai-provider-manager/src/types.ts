/** Types de base pour le gestionnaire de fournisseurs AI */

export type ProviderType = "openai-compatible";

export type ModelRole =
  | "general"
  | "planner"
  | "architect"
  | "coder"
  | "reviewer"
  | "fixer"
  | "docs"
  | "summarizer";

export interface ModelCapabilities {
  readonly supportsStreaming: boolean;
  readonly supportsToolCalling: boolean;
  readonly supportsJsonMode: boolean;
  readonly supportsLongContext: boolean;
  readonly supportsVision: boolean;
  readonly supportsReasoning: boolean;
  readonly maxContextTokens: number | null;
  readonly maxOutputTokens: number | null;
}

export interface ProviderRecord {
  readonly id: string;
  readonly displayName: string;
  readonly type: ProviderType;
  readonly baseUrl: string;
  /** Clé chiffrée — jamais exposée au frontend */
  readonly apiKeyEncrypted: string;
  readonly defaultModel: string;
  readonly availableModels: readonly string[];
  readonly customHeaders: Readonly<Record<string, string>>;
  readonly customQueryParams: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly proxyUrl: string | null;
  readonly enableStreaming: boolean;
  readonly enableToolCalling: boolean;
  readonly enableJsonMode: boolean;
  readonly enableVision: boolean;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ModelProfileRecord {
  readonly id: string;
  readonly name: string;
  readonly providerId: string;
  readonly model: string;
  readonly role: ModelRole;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly topP: number;
  readonly timeoutMs: number;
  readonly systemPrompt: string | null;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface ChatOptions {
  readonly messages: readonly ChatMessage[];
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly topP?: number;
  readonly timeoutMs?: number;
}

export interface ChatResult {
  readonly content: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly finishReason: "stop" | "length" | "content_filter" | "error" | string;
}

export interface StreamChunk {
  readonly delta: string;
  readonly done: boolean;
}

export interface ModelInfo {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: Partial<ModelCapabilities>;
}

export interface ConnectionTestResult {
  readonly ok: boolean;
  readonly latencyMs: number;
  readonly model: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
}

export interface ProviderAdapter {
  listModels(): Promise<ModelInfo[]>;
  chat(opts: ChatOptions): Promise<ChatResult>;
  streamChat(opts: ChatOptions): AsyncIterable<StreamChunk>;
  generateJson<T>(opts: ChatOptions & { schema?: object }): Promise<T>;
  testConnection(): Promise<ConnectionTestResult>;
  estimateTokens(text: string): number;
  getCapabilities(): ModelCapabilities;
}
