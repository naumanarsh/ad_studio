import { ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { RetryImage } from "@/components/retry-image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { IdeaCreation } from "@/features/dashboard/idea-list";
import { QueuePostButton } from "@/features/research/queue-post-button";
import type { Trend } from "@/lib/types/content";

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Rich trend cards with image and details — the Research page view. */
export function TrendCards({
  trends,
  createdByTrend = {},
  pendingTrendIds = [],
}: {
  trends: Trend[];
  createdByTrend?: Record<number, IdeaCreation>;
  pendingTrendIds?: number[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {trends.map((trend) => {
        const published = formatDate(trend.published_at);
        const created = createdByTrend[trend.id];
        const pending = pendingTrendIds.includes(trend.id);
        return (
          <Card key={trend.id} className="flex flex-col">
            {trend.image_url && (
              /* Remote hosts vary per feed; next/image would need an open allowlist. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={trend.image_url}
                alt=""
                loading="lazy"
                className="aspect-video w-full object-cover"
              />
            )}
            <CardContent className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {trend.topic && (
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-flame">
                    {trend.topic}
                  </span>
                )}
                <Badge variant="outline">{trend.source_name}</Badge>
                {published && (
                  <span className="text-xs text-muted-foreground">
                    {published}
                  </span>
                )}
              </div>
              <p className="font-heading text-base font-medium leading-snug">
                {trend.url ? (
                  <a
                    href={trend.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {trend.title}
                    <ExternalLink className="ml-1 inline size-3 text-muted-foreground" />
                  </a>
                ) : (
                  trend.title
                )}
              </p>
              {trend.summary && (
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {trend.summary}
                </p>
              )}
              {created ? (
                <Link
                  href={`/post/${created.postId}`}
                  className="mt-auto inline-flex items-center gap-2 self-start pt-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  {created.imageId !== null && (
                    <RetryImage
                      src={`/api/images/${created.imageId}`}
                      alt=""
                      className="size-8 shrink-0 border object-cover"
                    />
                  )}
                  Open the created post <ExternalLink className="size-3" />
                </Link>
              ) : pending ? (
                <span className="mt-auto inline-flex items-center gap-1 self-start pt-1 text-xs font-medium text-flame">
                  <RefreshCw className="size-3 animate-spin" /> Creating…
                </span>
              ) : (
                <QueuePostButton trendId={trend.id} />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
