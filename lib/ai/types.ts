export type AIMessage = {
  role: "system" | "user";
  content: string;
};

export type CompletionRequest = {
  /** Stable identifier for what this call does, e.g. "ideas.generate". */
  purpose: string;
  messages: AIMessage[];
  /** Ask the model for a pure-JSON response. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
};

export type CompletionResult = {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

/**
 * The AI port. Everything outside lib/ai talks to this interface only —
 * OpenAI, Claude, Gemini, Grok, DeepSeek and future models are adapters
 * selected by the registry, never imported directly.
 */
export interface AIProvider {
  readonly name: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}
