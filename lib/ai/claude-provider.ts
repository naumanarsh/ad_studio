import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type {
  AIProvider,
  CompletionRequest,
  CompletionResult,
} from "@/lib/ai/types";

const DEFAULT_MODEL = "claude-opus-5";

/** USD per million tokens, keyed by model. */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/**
 * Claude adapter. Notes on request shape:
 * - `temperature` from CompletionRequest is intentionally not forwarded —
 *   sampling params are rejected (400) on current Claude models; variety
 *   is steered through the prompts instead.
 * - Thinking is left at its default (adaptive) — no `thinking` param.
 * - `fallbacks: "default"` retries safety-classifier declines on Anthropic's
 *   recommended fallback model server-side instead of failing the brief.
 */
export class ClaudeProvider implements AIProvider {
  readonly name = "claude";
  private readonly client = new Anthropic();
  private readonly model = process.env.AI_MODEL ?? DEFAULT_MODEL;

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const system = request.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const user = request.messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n\n");

    const response = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: user }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error(
        "The model declined this request; try rephrasing the topic or trend.",
      );
    }

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    const pricing = PRICING[response.model] ?? PRICING[DEFAULT_MODEL];
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    return {
      text,
      model: response.model,
      inputTokens,
      outputTokens,
      costUsd:
        (inputTokens * pricing.input + outputTokens * pricing.output) / 1e6,
    };
  }
}
