import "server-only";

import { getDb } from "@/lib/db/client";
import type { AiRequestLog } from "@/lib/types/content";

export function recordAiRequest(
  entry: Omit<AiRequestLog, "id" | "created_at">,
): void {
  getDb()
    .prepare(
      `insert into ai_request_logs
         (provider, model, purpose, prompt, response,
          input_tokens, output_tokens, latency_ms, cost_usd, error)
       values
         (@provider, @model, @purpose, @prompt, @response,
          @input_tokens, @output_tokens, @latency_ms, @cost_usd, @error)`,
    )
    .run(entry);
}

/** Recent successful responses for a purpose — e.g. to avoid repeating concepts. */
export function listRecentResponses(purpose: string, limit = 3): string[] {
  return (
    getDb()
      .prepare(
        `select response from ai_request_logs
          where purpose = ? and error is null and response != ''
          order by id desc limit ?`,
      )
      .all(purpose, limit) as Array<{ response: string }>
  ).map((r) => r.response);
}
