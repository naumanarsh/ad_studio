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

const IMAGE_PURPOSES = "('post.image', 'studio.image')";

export type DailySpend = { day: string; usd: number; calls: number };

/** Total AI spend per day (all purposes), oldest first, gaps included. */
export function listDailySpend(days = 14): DailySpend[] {
  const rows = getDb()
    .prepare(
      `select date(created_at) day, sum(cost_usd) usd, count(*) calls
         from ai_request_logs
        where created_at >= datetime('now', ?)
        group by day order by day asc`,
    )
    .all(`-${days} days`) as DailySpend[];
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: DailySpend[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    out.push(byDay.get(d) ?? { day: d, usd: 0, calls: 0 });
  }
  return out;
}

export type ModelStats = {
  model: string;
  images: number;
  avg_ms: number;
  usd: number;
};

/** Successful image generations per model — the model-comparison table. */
export function listImageModelStats(days = 30): ModelStats[] {
  return getDb()
    .prepare(
      `select model, count(*) images, avg(latency_ms) avg_ms, sum(cost_usd) usd
         from ai_request_logs
        where purpose in ${IMAGE_PURPOSES} and error is null
          and created_at >= datetime('now', ?)
        group by model order by images desc`,
    )
    .all(`-${days} days`) as ModelStats[];
}

export type SpendSummary = {
  totalUsd: number;
  imageOk: number;
  imageFailed: number;
};

/** Headline numbers: total AI spend + image success/failure counts. */
export function spendSummary(days = 30): SpendSummary {
  const row = getDb()
    .prepare(
      `select
         coalesce(sum(cost_usd), 0) totalUsd,
         coalesce(sum(case when purpose in ${IMAGE_PURPOSES} and error is null then 1 else 0 end), 0) imageOk,
         coalesce(sum(case when purpose in ${IMAGE_PURPOSES} and error is not null then 1 else 0 end), 0) imageFailed
       from ai_request_logs
       where created_at >= datetime('now', ?)`,
    )
    .get(`-${days} days`) as SpendSummary;
  return row;
}

/** Spend since local midnight — the number the daily budget guards. */
export function todaySpendUsd(): number {
  return (
    getDb()
      .prepare(
        `select coalesce(sum(cost_usd), 0) usd from ai_request_logs
          where created_at >= date('now')`,
      )
      .get() as { usd: number }
  ).usd;
}
