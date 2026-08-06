"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const POLL_MS = 8000;

type Status = {
  pending: number;
  failed: number;
  todayUsd: number;
  budgetUsd: number;
};

/**
 * Global visibility strip: work in flight, recent failures, and today's
 * live AI spend against the daily budget — from any page, always.
 */
export function ActivityPill() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/queue-status");
        if (!res.ok) return;
        const body = (await res.json()) as Status;
        if (alive) setStatus(body);
      } catch {
        // Transient network hiccup — keep the last known state.
      }
    }
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!status) return null;

  return (
    <div className="flex items-center gap-1.5">
      {status.pending > 0 && (
        <Link
          href="/studio?tab=queue"
          className="inline-flex items-center gap-1.5 border border-flame/40 bg-flame/10 px-2.5 py-1 text-xs font-medium text-flame hover:bg-flame/20"
          title="Posts being created — open the queue"
        >
          <RefreshCw className="size-3 animate-spin" />
          {status.pending} creating…
        </Link>
      )}
      {status.failed > 0 && (
        <Link
          href="/studio?tab=queue"
          className="inline-flex items-center gap-1 border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/20 dark:text-red-400"
          title="Failed in the last 24h — open the queue to retry"
        >
          <AlertCircle className="size-3" />
          {status.failed} failed
        </Link>
      )}
      {status.todayUsd >= status.budgetUsd * 0.8 && (
        <Link
          href="/insights"
          className="inline-flex items-center gap-1 border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
          title={`Today's AI spend $${status.todayUsd.toFixed(2)} is near the $${status.budgetUsd.toFixed(0)} daily budget.`}
        >
          Budget {Math.round((status.todayUsd / status.budgetUsd) * 100)}%
        </Link>
      )}
    </div>
  );
}
