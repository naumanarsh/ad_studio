import "server-only";

import { ClaudeProvider } from "@/lib/ai/claude-provider";
import { MockProvider } from "@/lib/ai/mock-provider";
import type {
  AIProvider,
  CompletionRequest,
  CompletionResult,
} from "@/lib/ai/types";
import { recordAiRequest } from "@/lib/repositories/ai-logs.repo";

/**
 * Wraps any adapter so every call — success or failure — lands in
 * ai_request_logs with tokens, latency and cost.
 */
class LoggedProvider implements AIProvider {
  constructor(private readonly inner: AIProvider) {}

  get name(): string {
    return this.inner.name;
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const prompt = JSON.stringify(request.messages);
    const start = Date.now();
    try {
      const result = await this.inner.complete(request);
      recordAiRequest({
        provider: this.inner.name,
        model: result.model,
        purpose: request.purpose,
        prompt,
        response: result.text,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        latency_ms: Date.now() - start,
        cost_usd: result.costUsd,
        error: null,
      });
      return result;
    } catch (error) {
      recordAiRequest({
        provider: this.inner.name,
        model: "unknown",
        purpose: request.purpose,
        prompt,
        response: "",
        input_tokens: 0,
        output_tokens: 0,
        latency_ms: Date.now() - start,
        cost_usd: 0,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Real adapters (OpenAI, Gemini, Grok, DeepSeek) register here as they are
// added — selected by env, never imported by callers.
const ADAPTERS: Record<string, () => AIProvider> = {
  mock: () => new MockProvider(),
  claude: () => new ClaudeProvider(),
};

export function getAIProvider(): AIProvider {
  // Explicit AI_PROVIDER wins; otherwise use Claude when a key is present.
  const name =
    process.env.AI_PROVIDER ??
    (process.env.ANTHROPIC_API_KEY ? "claude" : "mock");
  const factory = ADAPTERS[name];
  if (!factory) {
    const known = Object.keys(ADAPTERS).join(", ");
    throw new Error(`Unknown AI_PROVIDER "${name}". Available: ${known}`);
  }
  return new LoggedProvider(factory());
}
