// Temporary dev-only verification route — deleted after testing.
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { listRecentJobs } from "@/lib/repositories/jobs.repo";
import { enqueuePostFromTrend } from "@/lib/services/job-queue.service";
import type { Trend } from "@/lib/types/content";

export async function GET(request: Request) {
  const check = new URL(request.url).searchParams.get("check");
  if (check) {
    return NextResponse.json({
      jobs: listRecentJobs(5).map((j) => ({
        id: j.id,
        status: j.status,
        label: j.label.slice(0, 60),
        post: j.post_id,
        error: j.error?.slice(0, 80) ?? null,
      })),
    });
  }
  const trends = getDb()
    .prepare(
      `select * from trends where url is not null and category = 'news'
       order by id desc limit 3`,
    )
    .all() as Trend[];
  const queued = trends
    .slice(1)
    .map((t) => enqueuePostFromTrend(t.id));
  return NextResponse.json({ queued: queued.length });
}
