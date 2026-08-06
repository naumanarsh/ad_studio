"use client";

import { ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/features/dashboard/post-card";
import { createPostFromTrendAction } from "@/lib/actions/post.actions";
import type { TrendPostResult } from "@/lib/services/generation.service";
import type { Trend } from "@/lib/types/content";

/**
 * The one-click trend → publish-ready post flow: deep-reads the source
 * article, writes the caption in the brand voice, art-directs the image.
 */
export function TrendPostCreator({ trend }: { trend: Trend }) {
  const router = useRouter();
  const [result, setResult] = useState<TrendPostResult | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const response = await createPostFromTrendAction({ trendId: trend.id });
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      setResult(response.data);
      toast.success("Post ready — review it below, then approve.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 border bg-card p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-flame">
            From the trend
          </p>
          <p className="mt-1 font-heading text-base font-medium leading-snug">
            {trend.title}
          </p>
          {trend.summary && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {trend.summary}
            </p>
          )}
          {trend.url && (
            <a
              href={trend.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
            >
              {trend.source_name} <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={create} disabled={pending}>
            {pending ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Reading article &amp; creating…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Create full post
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Deep-reads the source article, writes the caption in your brand
            voice, and designs the on-brand visual — about a minute.
          </p>
        </div>
      </div>

      {result && (
        <div className="max-w-xl">
          <PostCard post={result.post} images={result.images} />
        </div>
      )}
    </div>
  );
}
