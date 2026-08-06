"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  queuePostFromIdeaAction,
  queuePostFromTrendAction,
} from "@/lib/actions/jobs.actions";

/**
 * Queues the trend/idea → post job; progress shows in Creator → Queue and
 * the finished post lands back on this card (and in Creator → Ready).
 */
export function QueuePostButton({
  trendId,
  ideaId,
}: {
  trendId?: number;
  ideaId?: number;
}) {
  const router = useRouter();
  const [queued, setQueued] = useState(false);
  const [pending, startTransition] = useTransition();

  function queue() {
    startTransition(async () => {
      const result = trendId
        ? await queuePostFromTrendAction({ trendId })
        : await queuePostFromIdeaAction({ ideaId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setQueued(true);
      toast.success(
        result.data.position <= 1
          ? "Creating your post — track it in Creator → Queue."
          : `Queued — #${result.data.position} in line — track it in Creator → Queue.`,
      );
      router.refresh();
    });
  }

  if (queued) {
    return (
      <span className="mt-auto inline-flex items-center gap-1 self-start pt-1 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3" /> Queued
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={queue}
      disabled={pending}
      className="mt-auto inline-flex items-center gap-1 self-start pt-1 text-xs font-medium text-flame hover:underline disabled:opacity-60"
    >
      {pending ? (
        <RefreshCw className="size-3 animate-spin" />
      ) : (
        <Sparkles className="size-3" />
      )}
      Create post
    </button>
  );
}
