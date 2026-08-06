"use client";

import { AlertCircle, Clock, RefreshCw, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";
import { retryJobAction } from "@/lib/actions/jobs.actions";
import type { Job } from "@/lib/repositories/jobs.repo";

const STATUS: Record<
  Job["status"],
  { label: string; className: string }
> = {
  queued: { label: "queued", className: "text-muted-foreground" },
  running: { label: "creating…", className: "text-flame" },
  done: { label: "ready", className: "text-emerald-600 dark:text-emerald-400" },
  failed: { label: "failed", className: "text-red-600 dark:text-red-400" },
};

/** In-flight and failed jobs — finished ones move to the Ready tab. */
export function JobQueueList({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const hasPending = jobs.some(
    (j) => j.status === "queued" || j.status === "running",
  );

  function retry(jobId: number) {
    startRetry(async () => {
      const result = await retryJobAction({ jobId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Back in the queue.");
      router.refresh();
    });
  }

  // Live progress: refresh while work is in flight.
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [hasPending, router]);

  if (jobs.length === 0) {
    return (
      <p className="border px-4 py-6 text-sm text-muted-foreground">
        Nothing queued — hit “Create post” on any trend in the Market tab
        and it lands here, then moves to Ready when it&apos;s done.
      </p>
    );
  }

  return (
    <ul className="divide-y border">
      {jobs.map((job) => {
        const status = STATUS[job.status];
        return (
          <li key={job.id} className="flex items-center gap-3 px-4 py-3">
            {job.status === "failed" ? (
              <AlertCircle className="size-5 shrink-0 text-red-500" />
            ) : job.status === "running" ? (
              <RefreshCw className="size-5 shrink-0 animate-spin text-flame" />
            ) : (
              <Clock className="size-5 shrink-0 text-muted-foreground" />
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{job.label}</p>
              <p className={`text-xs ${status.className}`}>
                {status.label}
                {job.status === "failed" && job.error
                  ? ` — ${job.error.slice(0, 120)}`
                  : ""}
              </p>
            </div>

            {job.status === "failed" && (
              <button
                type="button"
                onClick={() => retry(job.id)}
                disabled={retrying}
                className="inline-flex shrink-0 items-center gap-1 border px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-60"
              >
                <RotateCcw className="size-3" /> Retry
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
