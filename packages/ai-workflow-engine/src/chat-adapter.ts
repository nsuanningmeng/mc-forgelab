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

const FILE_PATCH_JSON_SCHEMA_EXAMPLE = `{
  "type": "file_patch",
  "summary": "Short description of the intended changes.",
  "operations": [
    {
      "op": "create",
      "path": "src/main/java/com/example/Main.java",
      "content": "Full file content for create or update operations."
    },
    {
      "op": "update",
      "path": "src/main/resources/plugin.yml",
      "content": "Full replacement file content."
    },
    {
      "op": "move",
      "path": "src/main/java/com/example/OldName.java",
      "newPath": "src/main/java/com/example/NewName.java"
    },
    {
      "op": "delete",
      "path": "src/main/java/com/example/Unused.java"
    }
  ],
  "notes": ["Optional implementation notes."]
}`;

const ROLE_SYSTEM_PROMPTS: Record<string, string> = {
  code_generator: `You are the code generation step in the MC ForgeLab workflow.
Return ONLY valid JSON matching the FilePatch schema. Do not wrap the JSON in markdown fences and do not include prose outside the JSON.
The root object must have type "file_patch", a summary string, and an operations array.
Each operation must use a relative path. Use op "create", "update", "delete", or "move".
For create and update operations, include complete file content in the content field.
For move operations, include newPath and do not include content.
For delete operations, include only op and path.

FilePatch JSON schema example:
${FILE_PATCH_JSON_SCHEMA_EXAMPLE}`,

  auto_fixer: `You are the automatic build fixer in the MC ForgeLab workflow.
Analyze the supplied build errors, previous patch failures, build logs, and project files.
Return ONLY valid JSON matching the FilePatch schema. Do not wrap the JSON in markdown fences and do not include prose outside the JSON.
Produce the smallest patch that can reasonably fix the reported build failure.
Use relative paths only. Preserve unrelated files and behavior.
For create and update operations, include complete file content in the content field.
For move operations, include newPath and do not include content.
For delete operations, include only op and path.

FilePatch JSON schema example:
${FILE_PATCH_JSON_SCHEMA_EXAMPLE}`,

  build_error_analyzer: `You are the build error analysis step in the MC ForgeLab workflow.
Analyze the supplied build result, compiler output, runtime logs, and previous patch failure details.
Return ONLY valid JSON. Do not wrap the JSON in markdown fences and do not include prose outside the JSON.
Use this structure: {"summary":"short error summary","errorCode":"BUILD_FAILED or TOOLCHAIN_UNAVAILABLE or UNKNOWN","likelyCause":"most likely root cause","evidence":["specific log excerpts or facts"],"suggestedFocusFiles":["relative/path/File.java"],"recommendedFix":"concise fix strategy"}.
Keep evidence concise and avoid inventing files that are not supported by the input.`
};

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
  const system = (systemPrompt?.trim() || ROLE_SYSTEM_PROMPTS[role])?.trim();
  if (system) {
    messages.push({ role: "system", content: system });
  }

  for (const message of contextMessages) {
    const content = message.content.trim();
    if (content.length === 0) continue;
    if (message.role === "system" || message.role === "user" || message.role === "assistant") {
      messages.push({ role: message.role, content });
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
