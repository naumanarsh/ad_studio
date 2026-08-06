"use client";

import { RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  regenerateBriefAction,
  runMorningBriefAction,
} from "@/lib/actions/brief.actions";

export function RunBriefButton({ hasContent }: { hasContent: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await runMorningBriefAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Brief ready: ${result.data.trends} trends, ${result.data.ideas} ideas, ${result.data.posts} drafts`,
      );
      router.refresh();
    });
  }

  return (
    <Button onClick={run} disabled={pending} size={hasContent ? "sm" : "lg"}>
      {pending ? (
        <>
          <RefreshCw className="size-4 animate-spin" />
          Generating…
        </>
      ) : (
        <>
          <Sparkles className="size-4" />
          {hasContent ? "Fill in missing pieces" : "Generate today's brief"}
        </>
      )}
    </Button>
  );
}

/** Discards today's ideas + drafts (approvals included) and rewrites them. */
export function RegenerateBriefButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function regenerate() {
    const confirmed = window.confirm(
      "Regenerate today's ideas and drafts from the current trends? " +
        "Existing drafts — including approved ones — will be replaced.",
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = await regenerateBriefAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Regenerated: ${result.data.ideas} ideas, ${result.data.posts} drafts`,
      );
      router.refresh();
    });
  }

  return (
    <Button
      onClick={regenerate}
      disabled={pending}
      size="sm"
      variant="outline"
    >
      {pending ? (
        <>
          <RefreshCw className="size-4 animate-spin" />
          Regenerating…
        </>
      ) : (
        <>
          <RotateCcw className="size-4" />
          Regenerate today
        </>
      )}
    </Button>
  );
}
