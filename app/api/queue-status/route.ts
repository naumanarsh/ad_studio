import { todaySpendUsd } from "@/lib/repositories/ai-logs.repo";
import {
  countPendingJobs,
  countRecentFailedJobs,
} from "@/lib/repositories/jobs.repo";
import { dailyBudgetUsd } from "@/lib/services/budget.service";

/** Poll target for the header pill: live work, failures, and spend. */
export async function GET() {
  return Response.json({
    pending: countPendingJobs(),
    failed: countRecentFailedJobs(),
    todayUsd: todaySpendUsd(),
    budgetUsd: dailyBudgetUsd(),
  });
}
