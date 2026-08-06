import "server-only";

import { todaySpendUsd } from "@/lib/repositories/ai-logs.repo";
import { AppError } from "@/lib/services/errors";

const DEFAULT_DAILY_BUDGET_USD = 25;

/** The hard daily ceiling on AI spend — overridable via env. */
export function dailyBudgetUsd(): number {
  const raw = Number(process.env.AI_DAILY_BUDGET_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_BUDGET_USD;
}

/**
 * The circuit breaker every generation path calls first: once today's
 * logged spend reaches the cap, nothing else can burn credits until
 * tomorrow (or the cap is raised deliberately).
 */
export function assertWithinDailyBudget(): void {
  const spent = todaySpendUsd();
  const cap = dailyBudgetUsd();
  if (spent >= cap) {
    throw new AppError(
      `Daily AI budget reached ($${spent.toFixed(2)} of $${cap.toFixed(2)}). ` +
        `Generation is paused until tomorrow — raise AI_DAILY_BUDGET_USD in .env to continue today.`,
    );
  }
}
