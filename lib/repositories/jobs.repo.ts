import "server-only";

import { getDb } from "@/lib/db/client";

export type Job = {
  id: number;
  type: string;
  label: string;
  trend_id: number | null;
  idea_id: number | null;
  status: "queued" | "running" | "done" | "failed";
  post_id: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export function enqueueJob(input: {
  type: string;
  label: string;
  trend_id?: number | null;
  idea_id?: number | null;
}): Job {
  return getDb()
    .prepare(
      `insert into jobs (type, label, trend_id, idea_id)
       values (@type, @label, @trend_id, @idea_id) returning *`,
    )
    .get({ trend_id: null, idea_id: null, ...input }) as Job;
}

/** Atomically claim the oldest queued job, marking it running. */
export function claimNextJob(): Job | null {
  const row = getDb()
    .prepare(
      `update jobs set status = 'running', updated_at = datetime('now')
        where id = (select id from jobs where status = 'queued' order by id asc limit 1)
        returning *`,
    )
    .get();
  return (row as Job | undefined) ?? null;
}

export function markJobDone(id: number, postId: number): void {
  getDb()
    .prepare(
      `update jobs set status = 'done', post_id = ?, updated_at = datetime('now') where id = ?`,
    )
    .run(postId, id);
}

export function markJobFailed(id: number, error: string): void {
  getDb()
    .prepare(
      `update jobs set status = 'failed', error = ?, updated_at = datetime('now') where id = ?`,
    )
    .run(error.slice(0, 500), id);
}

/** Put a failed job back in line. */
export function requeueJob(id: number): boolean {
  return (
    getDb()
      .prepare(
        `update jobs set status = 'queued', error = null, updated_at = datetime('now')
          where id = ? and status = 'failed'`,
      )
      .run(id).changes > 0
  );
}

/** Jobs stuck in `running` (e.g. after a server restart) → back to queued. */
export function requeueStalledJobs(): void {
  getDb()
    .prepare(
      `update jobs set status = 'queued', updated_at = datetime('now')
        where status = 'running' and updated_at < datetime('now', '-30 minutes')`,
    )
    .run();
}

export function listRecentJobs(limit = 30): Job[] {
  return getDb()
    .prepare(`select * from jobs order by id desc limit ?`)
    .all(limit) as Job[];
}

export function countPendingJobs(): number {
  return (
    getDb()
      .prepare(
        `select count(*) n from jobs where status in ('queued', 'running')`,
      )
      .get() as { n: number }
  ).n;
}

/** An already-waiting or running job for the same source — dedupe guard. */
export function findActiveJobForSource(
  source: { trend_id?: number; idea_id?: number },
): Job | null {
  const row = source.trend_id
    ? getDb()
        .prepare(
          `select * from jobs where trend_id = ? and status in ('queued', 'running') limit 1`,
        )
        .get(source.trend_id)
    : getDb()
        .prepare(
          `select * from jobs where idea_id = ? and status in ('queued', 'running') limit 1`,
        )
        .get(source.idea_id);
  return (row as Job | undefined) ?? null;
}

/** Failed jobs in the last day — surfaced in the header pill. */
export function countRecentFailedJobs(): number {
  return (
    getDb()
      .prepare(
        `select count(*) n from jobs
          where status = 'failed' and updated_at >= datetime('now', '-1 day')`,
      )
      .get() as { n: number }
  ).n;
}
