import "server-only";

import { getIdea } from "@/lib/repositories/ideas.repo";
import * as jobsRepo from "@/lib/repositories/jobs.repo";
import { getTrend } from "@/lib/repositories/trends.repo";
import {
  createPostFromIdea,
  createPostFromTrend,
} from "@/lib/services/generation.service";

// One in-process worker: jobs run strictly one at a time, in order.
const globalForQueue = globalThis as unknown as { __adStudioQueueBusy?: boolean };

/** Start draining the queue if no worker is already on it. */
export function kickJobQueue(): void {
  if (globalForQueue.__adStudioQueueBusy) return;
  globalForQueue.__adStudioQueueBusy = true;

  void (async () => {
    try {
      for (;;) {
        const job = jobsRepo.claimNextJob();
        if (!job) break;
        try {
          if (job.type === "post_from_trend" && job.trend_id) {
            const result = await createPostFromTrend(job.trend_id);
            jobsRepo.markJobDone(job.id, result.post.id);
          } else if (job.type === "post_from_idea" && job.idea_id) {
            const result = await createPostFromIdea(job.idea_id);
            jobsRepo.markJobDone(job.id, result.post.id);
          } else {
            jobsRepo.markJobFailed(job.id, "Unknown job type or missing source.");
          }
        } catch (error) {
          jobsRepo.markJobFailed(
            job.id,
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    } finally {
      globalForQueue.__adStudioQueueBusy = false;
    }
  })();
}

/** Recover after restarts: requeue stalled work and resume draining. */
export function resumeJobQueue(): void {
  jobsRepo.requeueStalledJobs();
  kickJobQueue();
}

export function enqueuePostFromTrend(trendId: number): {
  position: number;
} {
  const trend = getTrend(trendId);
  if (!trend) throw new Error("That trend no longer exists.");
  jobsRepo.enqueueJob({
    type: "post_from_trend",
    label: trend.title,
    trend_id: trendId,
  });
  const position = jobsRepo.countPendingJobs();
  kickJobQueue();
  return { position };
}

export function enqueuePostFromIdea(ideaId: number): {
  position: number;
} {
  const idea = getIdea(ideaId);
  if (!idea) throw new Error("That idea no longer exists.");
  jobsRepo.enqueueJob({
    type: "post_from_idea",
    label: idea.title,
    idea_id: ideaId,
  });
  const position = jobsRepo.countPendingJobs();
  kickJobQueue();
  return { position };
}
