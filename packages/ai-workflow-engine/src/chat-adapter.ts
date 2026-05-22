import type {
  ChatMessage,
  ChatOptions,
  ModelProfileRecord,
  ProviderAdapter,
  StreamChunk
} from "@mc-forgelab/ai-provider-manager";
import { createFakeProviderAdapter } from "./fake-provider-adapter.js";
import type { StepRole } from "./types.js";

export interface ChatAdapterResult {
  readonly text: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
}

export interface ChatAdapterInvokeOptions {
  readonly onDelta?: (chunk: string) => void;
  readonly signal?: AbortSignal;
  readonly contextMessages?: readonly ChatMessage[];
}

export interface ChatAdapter {
  invoke(
    role: StepRole,
    prompt: string,
    context: Record<string, string>,
    opts?: ChatAdapterInvokeOptions
  ): Promise<ChatAdapterResult>;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Workflow run canceled");
  }
}

function contextToPrompt(context: Record<string, string>): string {
  return Object.entries(context).map(([key, value]) => `## ${key}\n${value}`).join("\n\n");
}

function buildMessages(
  role: StepRole,
  prompt: string,
  context: Record<string, string>,
  systemPrompt: string | null,
  contextMessages: readonly ChatMessage[] = []
): readonly ChatMessage[] {
  const messages: ChatMessage[] = [];
  const system = systemPrompt?.trim();
  if (system) {
    messages.push({ role: "system", content: system });
  }

  for (const message of contextMessages) {
    const content = message.content.trim();
    if (message.role === "system" && content.length > 0) {
      messages.push({ role: "system", content });
    }
  }

  const body = prompt.trim().length > 0 ? prompt : contextToPrompt(context);
  messages.push({
    role: "user",
    content: [`Workflow role: ${role}`, body].filter((part) => part.length > 0).join("\n\n")
  });
  return messages;
}

function estimateMessagesTokens(adapter: ProviderAdapter, messages: readonly ChatMessage[]): number {
  return adapter.estimateTokens(messages.map((message) => message.content).join("\n"));
}

async function consumeStream(
  stream: AsyncIterable<StreamChunk>,
  onDelta?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  let text = "";
  for await (const chunk of stream) {
    throwIfAborted(signal);
    if (chunk.done || chunk.delta.length === 0) continue;
    text += chunk.delta;
    onDelta?.(chunk.delta);
  }
  throwIfAborted(signal);
  return text;
}

function emitFakeDeltas(text: string, onDelta?: (chunk: string) => void, signal?: AbortSignal): void {
  if (!onDelta) return;
  const chunkSize = 80;
  for (let i = 0; i < text.length; i += chunkSize) {
    throwIfAborted(signal);
    onDelta(text.slice(i, i + chunkSize));
  }
}

export function createRealChatAdapter(adapter: ProviderAdapter, profile: ModelProfileRecord): ChatAdapter {
  return {
    async invoke(role, prompt, context, opts = {}) {
      throwIfAborted(opts.signal);
      const messages = buildMessages(role, prompt, context, profile.systemPrompt, opts.contextMessages);
      const chatOptions: ChatOptions = {
        messages,
        model: profile.model,
        temperature: profile.temperature,
        maxTokens: profile.maxTokens,
        topP: profile.topP,
        timeoutMs: profile.timeoutMs
      };

      if (opts.onDelta && adapter.getCapabilities().supportsStreaming) {
        const text = await consumeStream(adapter.streamChat(chatOptions), opts.onDelta, opts.signal);
        return {
          text,
          tokensIn: estimateMessagesTokens(adapter, messages),
          tokensOut: adapter.estimateTokens(text)
        };
      }

      const result = await adapter.chat(chatOptions);
      throwIfAborted(opts.signal);
      return {
        text: result.content,
        tokensIn: result.inputTokens,
        tokensOut: result.outputTokens
      };
    }
  };
}

export function createFakeChatAdapter(): ChatAdapter {
  const provider = createFakeProviderAdapter();
  return {
    async invoke(role, prompt, context, opts = {}) {
      throwIfAborted(opts.signal);
      const response = await provider.invoke(role, prompt, context);
      throwIfAborted(opts.signal);
      emitFakeDeltas(response.text, opts.onDelta, opts.signal);
      return response;
    }
  };
}
