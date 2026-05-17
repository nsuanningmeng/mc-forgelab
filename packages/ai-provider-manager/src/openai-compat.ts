import { AppError, ErrorCode } from "@mc-forgelab/app-error";
import type {
  ProviderAdapter, ChatOptions, ChatResult, StreamChunk,
  ModelInfo, ConnectionTestResult, ModelCapabilities
} from "./types.js";

interface OpenAIModel { id: string; }
interface OpenAIChoice { message?: { content?: string }; delta?: { content?: string }; finish_reason?: string; }
interface OpenAIResponse { choices: OpenAIChoice[]; usage?: { prompt_tokens: number; completion_tokens: number }; model: string; }

export interface OpenAICompatConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly defaultModel: string;
  readonly customHeaders?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly proxyUrl?: string | null;
}

export function createOpenAICompatAdapter(cfg: OpenAICompatConfig): ProviderAdapter {
  const base = cfg.baseUrl.replace(/\/$/, "");
  const timeout = cfg.timeoutMs ?? 60_000;

  function headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
      ...cfg.customHeaders
    };
  }

  async function fetchJson<T>(path: string, body: unknown): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
    } catch (cause) {
      if ((cause as Error).name === "AbortError") {
        throw new AppError(ErrorCode.AI_PROVIDER_UPSTREAM_TIMEOUT, { cause });
      }
      throw new AppError(ErrorCode.AI_PROVIDER_CONNECT_FAILED, { cause });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      normalizeHttpError(res.status, text);
    }
    return res.json() as Promise<T>;
  }

  function normalizeHttpError(status: number, body: string): never {
    if (status === 401 || status === 403) throw new AppError(ErrorCode.AI_PROVIDER_AUTH_FAILED, { details: { status } });
    if (status === 402) throw new AppError(ErrorCode.AI_PROVIDER_INSUFFICIENT_QUOTA, { details: { status } });
    if (status === 429) throw new AppError(ErrorCode.AI_PROVIDER_RATE_LIMITED, { details: { status } });
    if (status === 404) throw new AppError(ErrorCode.AI_PROVIDER_MODEL_NOT_FOUND, { details: { status } });
    if (status === 413) throw new AppError(ErrorCode.AI_PROVIDER_CONTEXT_TOO_LONG, { details: { status } });
    throw new AppError(ErrorCode.AI_PROVIDER_INVALID_RESPONSE, { details: { status, body: body.slice(0, 200) } });
  }

  return {
    async listModels(): Promise<ModelInfo[]> {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      try {
        const res = await fetch(`${base}/models`, { headers: headers(), signal: ctrl.signal });
        if (!res.ok) return [];
        const data = await res.json() as { data?: OpenAIModel[] };
        return (data.data ?? []).map((m) => ({ id: m.id, displayName: m.id, capabilities: {} }));
      } catch {
        return [];
      } finally {
        clearTimeout(timer);
      }
    },

    async chat(opts: ChatOptions): Promise<ChatResult> {
      const data = await fetchJson<OpenAIResponse>("/chat/completions", {
        model: opts.model ?? cfg.defaultModel,
        messages: opts.messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        top_p: opts.topP,
        stream: false
      });
      const choice = data.choices[0];
      return {
        content: choice?.message?.content ?? "",
        model: data.model,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        finishReason: choice?.finish_reason ?? "stop"
      };
    },

    async *streamChat(opts: ChatOptions): AsyncIterable<StreamChunk> {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      let res: Response;
      try {
        res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            model: opts.model ?? cfg.defaultModel,
            messages: opts.messages,
            temperature: opts.temperature,
            max_tokens: opts.maxTokens,
            stream: true
          }),
          signal: ctrl.signal
        });
      } catch (cause) {
        clearTimeout(timer);
        throw new AppError(ErrorCode.AI_PROVIDER_CONNECT_FAILED, { cause });
      }
      if (!res.ok) {
        clearTimeout(timer);
        const text = await res.text().catch(() => "");
        normalizeHttpError(res.status, text);
      }
      const reader = res.body?.getReader();
      if (!reader) { clearTimeout(timer); throw new AppError(ErrorCode.AI_PROVIDER_STREAM_INTERRUPTED); }
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") { yield { delta: "", done: true }; return; }
            try {
              const chunk = JSON.parse(payload) as { choices: OpenAIChoice[] };
              const delta = chunk.choices[0]?.delta?.content ?? "";
              if (delta) yield { delta, done: false };
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        clearTimeout(timer);
        reader.releaseLock();
      }
      yield { delta: "", done: true };
    },

    async generateJson<T>(opts: ChatOptions & { schema?: object }): Promise<T> {
      const result = await this.chat({
        ...opts,
        messages: [
          ...opts.messages,
          ...(opts.schema ? [{ role: "system" as const, content: `Respond with valid JSON matching this schema: ${JSON.stringify(opts.schema)}` }] : [])
        ]
      });
      const text = result.content.trim();
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
      try {
        return JSON.parse(jsonMatch[1] ?? text) as T;
      } catch (cause) {
        throw new AppError(ErrorCode.AI_PROVIDER_JSON_PARSE_FAILED, { cause, details: { preview: text.slice(0, 200) } });
      }
    },

    async testConnection(): Promise<ConnectionTestResult> {
      const start = Date.now();
      try {
        const models = await this.listModels();
        return { ok: true, latencyMs: Date.now() - start, model: models[0]?.id ?? cfg.defaultModel, errorCode: null, errorMessage: null };
      } catch (err) {
        const e = err as AppError;
        return { ok: false, latencyMs: Date.now() - start, model: null, errorCode: e.code ?? "UNKNOWN", errorMessage: e.messageEn ?? String(err) };
      }
    },

    estimateTokens(text: string): number {
      return Math.ceil(text.length / 4);
    },

    getCapabilities(): ModelCapabilities {
      return {
        supportsStreaming: true, supportsToolCalling: true, supportsJsonMode: true,
        supportsLongContext: false, supportsVision: false, supportsReasoning: false,
        maxContextTokens: null, maxOutputTokens: null
      };
    }
  };
}
